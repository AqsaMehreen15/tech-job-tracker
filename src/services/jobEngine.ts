import type { Job } from '../types/job'
import { JobFilter } from '../types/job'
import { pakistanJobs } from '../data/pakistanJobs'
import { fetchCustomJobs, firebaseApp } from './firebase'
import { fetchRozeeJobs } from './rozeeFeed'
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

const REMOTIVE_ENDPOINT = 'https://remotive.com/api/remote-jobs'
const JSEARCH_ENDPOINT = 'https://jsearch.p.rapidapi.com/search'
const JSEARCH_API_KEY = String(import.meta.env.VITE_JSEARCH_API_KEY ?? '')
const FETCH_TIMEOUT_MS = 5000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const normalizeJobId = (job: Job): string => {
  if (job.id !== undefined && job.id !== null && String(job.id).trim()) {
    return String(job.id).trim()
  }
  return `${job.title || ''}|${job.company_name || ''}`.toLowerCase().trim()
}

const makeFallbackUrl = (job: Job): string => {
  const title = job.title?.trim() || 'job'
  const company = job.company_name?.trim() || 'company'
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company}`)}`
}

const normalizeJob = (job: Job): Job => {
  const url = job.url?.trim() || makeFallbackUrl(job)
  const companyLogo = job.company_logo?.trim() || ''
  const id = job.id ?? `${job.title || ''}-${job.company_name || ''}`

  return {
    ...job,
    id,
    url,
    company_logo: companyLogo,
  }
}

export const mergeJobs = (jobs: Job[]): Job[] => {
  const seen = new Map<string, Job>()
  for (const job of jobs.map(normalizeJob)) {
    const key = normalizeJobId(job)
    if (!seen.has(key)) {
      seen.set(key, job)
    }
  }
  return Array.from(seen.values())
}

const safeFetchCustomJobs = async (): Promise<Job[]> => {
  try {
    return await Promise.race([fetchCustomJobs(), new Promise<Job[]>((resolve) => setTimeout(() => resolve([]), 1500))])
  } catch {
    return []
  }
}

const safeFetchRemotiveJobs = async (): Promise<Job[]> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(REMOTIVE_ENDPOINT, { signal: controller.signal })
    if (!response.ok) return []

    const data = (await response.json()) as { jobs?: Job[] }
    return Array.isArray(data.jobs) ? data.jobs : []
  } catch {
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function getFastJobsFromEngine(): Promise<{ jobs: Job[]; source: string }> {
  const [customJobs, remotiveJobs] = await Promise.all([safeFetchCustomJobs(), safeFetchRemotiveJobs()])
  const source = customJobs.length > 0 ? 'firebase' : remotiveJobs.length > 0 ? 'remotive' : 'static'
  const jobs = mergeJobs([...customJobs, ...remotiveJobs, ...pakistanJobs])
  return { jobs, source }
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
          candidate_required_location: item.job_city ?? item.location ?? item.candidate_required_location ?? 'Remote',
          url: item.job_apply_link ?? item.job_link ?? item.url,
          publication_date: item.job_posted_at ?? item.publication_date,
          description: item.job_description ?? item.description,
          category: item.job_category ?? item.category,
          job_type: item.job_employment_type ?? item.job_type ?? item.job_employment_type ?? 'Remote',
        }))
      : []

    await setDoc(cacheRef, {
      jobs,
      updatedAt: serverTimestamp(),
    })

    return jobs
  } catch {
    return []
  }
}

export async function getJobsFromEngine(): Promise<{ jobs: Job[]; source: string }> {
  const [customJobs, rozeeJobs, remotiveJobs, jsearchJobs] = await Promise.all([
    safeFetchCustomJobs(),
    fetchRozeeJobs(),
    safeFetchRemotiveJobs(),
    fetchCachedJSearchJobs(),
  ])

  let source = 'static'
  if (customJobs.length > 0) {
    source = 'firebase'
  } else if (rozeeJobs.length > 0) {
    source = 'rozee'
  } else if (remotiveJobs.length > 0) {
    source = 'remotive'
  } else if (jsearchJobs.length > 0) {
    source = 'cached_jsearch'
  }

  const combinedJobs = mergeJobs([
    ...customJobs,
    ...rozeeJobs,
    ...remotiveJobs,
    ...jsearchJobs,
    ...pakistanJobs,
  ])

  return { jobs: combinedJobs, source }
}
