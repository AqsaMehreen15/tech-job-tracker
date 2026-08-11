import type { Job } from '../types/job'
import { fetchCustomJobs, firebaseApp } from './firebase'
import { fetchRozeeJobs } from './rozeeFeed'
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

const REMOTIVE_ENDPOINT = 'https://remotive.com/api/remote-jobs'
const ARBEITNOW_ENDPOINT = 'https://www.arbeitnow.com/api/job-board'
const JOBICY_ENDPOINT = 'https://jobicy.com/api/v2/remote-jobs?count=50'
const JSEARCH_ENDPOINT = 'https://jsearch.p.rapidapi.com/search'
const JSEARCH_API_KEY = String(import.meta.env.VITE_JSEARCH_API_KEY ?? '')
const FETCH_TIMEOUT_MS = 5000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const normalizeText = (value?: string): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[–—―]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')

const normalizeJobKey = (job: Job): string => {
  const company = normalizeText(job.company_name)
  const title = normalizeText(job.title)
  const location = normalizeText((job as any).candidate_required_location ?? (job as any).location ?? job.url ?? '')
  return `${company}|${title}|${location}`
}

const makeFallbackUrl = (job: Job): string => {
  const title = job.title?.trim() || 'job'
  const company = job.company_name?.trim() || 'company'
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company}`)}`
}

const normalizeJob = (job: Job): Job => {
  const title = job.title?.trim() || 'Job'
  const company_name = job.company_name?.trim() || 'Unknown'
  const candidate_required_location =
    job.candidate_required_location?.trim() || (job as any).location?.trim() || 'Remote'
  const url = job.url?.trim() || makeFallbackUrl({ title, company_name } as Job)
  const company_logo = job.company_logo?.trim() || ''
  const id = String(job.id ?? `${title}-${company_name}-${candidate_required_location}`).trim()

  return {
    ...job,
    id,
    title,
    company_name,
    candidate_required_location,
    url,
    company_logo,
  }
}

export const mergeJobs = (jobs: Job[]): Job[] => {
  const seen = new Map<string, Job>()
  for (const job of jobs.map(normalizeJob)) {
    const key = normalizeJobKey(job)
    if (!seen.has(key)) {
      seen.set(key, job)
    }
  }
  return Array.from(seen.values())
}

const safeFetchCustomJobs = async (): Promise<Job[]> => {
  try {
    return await Promise.race([fetchCustomJobs(), new Promise<Job[]>((resolve) => setTimeout(() => resolve([]), 1500))])
  } catch (err: unknown) {
    console.warn('[jobEngine] fetchCustomJobs failed:', err)
    return []
  }
}

const safeFetchRemotiveJobs = async (): Promise<Job[]> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const proxied = `https://corsproxy.io/?${encodeURIComponent(REMOTIVE_ENDPOINT)}`
    const response = await fetch(proxied, { signal: controller.signal })
    if (!response.ok) return []

    const data = (await response.json()) as { jobs?: Job[] }
    return Array.isArray(data.jobs) ? data.jobs : []
  } catch (err: unknown) {
    console.warn('[jobEngine] Remotive fetch failed (CORS/Network):', err)
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const safeFetchArbeitnowJobs = async (): Promise<Job[]> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const proxied = `https://corsproxy.io/?${encodeURIComponent(ARBEITNOW_ENDPOINT)}`
    const response = await fetch(proxied, { signal: controller.signal })
    if (!response.ok) return []

    const json = await response.json()
    const items = Array.isArray(json.data) ? json.data : []
    if (!Array.isArray(items)) return []

    return items.map((item: any): Job => ({
      id: item.slug ?? item.id ?? `${item.title}-${item.company_name ?? item.company}`,
      title: item.title ?? 'Job',
      company_name: item.company_name ?? item.company ?? 'Unknown',
      candidate_required_location:
        item.location || (item.remote ? 'Remote' : undefined) || item.candidate_required_location,
      url: item.url ?? item.redirect_url ?? item.job_ad_link,
      publication_date: item.created_at ?? item.publication_date,
      description: item.description ?? item.details,
      category: item.tags ? (Array.isArray(item.tags) ? String(item.tags[0] ?? '') : String(item.tags)) : item.job_type,
      job_type: Array.isArray(item.job_types)
        ? item.job_types.join(', ')
        : item.job_type ?? item.employment_type,
      company_logo: item.company_logo,
      tags: Array.isArray(item.tags)
        ? item.tags.map((tag: any) => String(tag))
        : typeof item.tags === 'string'
        ? item.tags.split(/[,;|]/).map((tag: string) => tag.trim()).filter(Boolean)
        : undefined,
    }))
  } catch (err: unknown) {
    console.warn('[jobEngine] Arbeitnow fetch failed (CORS/Network):', err)
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const safeFetchJobicyJobs = async (): Promise<Job[]> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const proxied = `https://corsproxy.io/?${encodeURIComponent(JOBICY_ENDPOINT)}`
    const response = await fetch(proxied, { signal: controller.signal })
    if (!response.ok) return []

    const json = await response.json()
    const items =
      Array.isArray(json.jobs) ? json.jobs : Array.isArray(json.results) ? json.results : Array.isArray(json.data) ? json.data : []
    if (!Array.isArray(items)) return []

    return items.map((item: any): Job => ({
      id: item.id ?? item.uuid ?? `${item.title}-${item.company_name ?? item.company}`,
      title: item.title ?? item.role ?? 'Job',
      company_name: item.company_name ?? item.company ?? item.employer_name ?? 'Unknown',
      candidate_required_location:
        item.location || item.candidate_required_location || (item.remote ? 'Remote' : undefined),
      url: item.url ?? item.apply_url ?? item.job_url ?? item.link,
      publication_date: item.created_at ?? item.posted_at ?? item.publication_date,
      description: item.description ?? item.summary,
      category: item.category ?? item.job_category,
      job_type: item.job_type ?? item.employment_type ?? item.type,
      company_logo: item.company_logo,
      tags: Array.isArray(item.tags)
        ? item.tags.map((tag: any) => String(tag))
        : typeof item.tags === 'string'
        ? item.tags.split(/[,;|]/).map((tag: string) => tag.trim()).filter(Boolean)
        : undefined,
    }))
  } catch (err: unknown) {
    console.warn('[jobEngine] Jobicy fetch failed (CORS/Network):', err)
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const isCacheFresh = (timestamp: unknown): boolean => {
  if (!timestamp) return false
  if (timestamp instanceof Timestamp) {
    const millis = timestamp.toMillis()
    return Date.now() - millis < CACHE_TTL_MS
  }

  const parsed = new Date(String(timestamp))
  if (Number.isNaN(parsed.getTime())) return false
  return Date.now() - parsed.getTime() < CACHE_TTL_MS
}

const fetchCachedJSearchJobs = async (): Promise<Job[]> => {
  if (!JSEARCH_API_KEY) {
    return []
  }

  try {
    const db = getFirestore(firebaseApp)
    const cacheRef = doc(collection(db, 'cached_jsearch_results'), 'latest')
    const cacheSnap = await getDoc(cacheRef)

    if (cacheSnap.exists()) {
      const cached = cacheSnap.data() as { jobs?: Job[]; updatedAt?: unknown }
      if (Array.isArray(cached.jobs) && isCacheFresh(cached.updatedAt)) {
        return cached.jobs
      }
    }

    const url = new URL(JSEARCH_ENDPOINT)
    url.searchParams.set('query', 'software developer jobs pakistan')
    url.searchParams.set('num_pages', '1')

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': JSEARCH_API_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    })

    if (!response.ok) {
      return []
    }

    const json = await response.json()
    const jobs = Array.isArray(json.data)
      ? json.data.map((item: any): Job => ({
          id: item.job_id ?? item.id ?? `${item.title}-${item.company_name ?? item.company}`,
          title: item.job_title ?? item.title ?? 'Job',
          company_name: item.employer_name ?? item.company_name ?? item.company ?? 'Unknown',
          candidate_required_location:
            item.job_city ?? item.location ?? item.candidate_required_location ?? 'Remote',
          url: item.job_apply_link ?? item.job_link ?? item.url,
          publication_date: item.job_posted_at ?? item.publication_date,
          description: item.job_description ?? item.description,
          category: item.job_category ?? item.category,
          job_type:
            item.job_employment_type ?? item.job_type ?? item.job_employment_type ?? 'Remote',
        }))
      : []

    await setDoc(cacheRef, {
      jobs,
      updatedAt: serverTimestamp(),
    })

    return jobs
  } catch (err: unknown) {
    console.warn('[jobEngine] fetchCachedJSearchJobs failed:', err)
    return []
  }
}

export async function getFastJobsFromEngine(): Promise<{ jobs: Job[]; source: string }> {
  return getJobsFromEngine()
}

export async function getJobsFromEngine(): Promise<{ jobs: Job[]; source: string }> {
  const sources = [
    { name: 'firebase', promise: safeFetchCustomJobs() },
    { name: 'rozee', promise: fetchRozeeJobs() },
    { name: 'remotive', promise: safeFetchRemotiveJobs() },
    { name: 'arbeitnow', promise: safeFetchArbeitnowJobs() },
    { name: 'jobicy', promise: safeFetchJobicyJobs() },
    { name: 'cached_jsearch', promise: fetchCachedJSearchJobs() },
  ]

  const results = await Promise.allSettled(sources.map((source) => source.promise))
  const rawJobs = results.flatMap((result) => {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) return []
    return result.value
  })

  const sourceParts = results
    .map((result, index) => ({ result, name: sources[index].name }))
    .filter((item) => item.result.status === 'fulfilled' && Array.isArray(item.result.value) && item.result.value.length > 0)
    .map((item) => item.name)

  const source = sourceParts.length > 0 ? sourceParts.join('+') : 'none'
  const combinedJobs = mergeJobs(rawJobs)

  return { jobs: combinedJobs, source }
}
