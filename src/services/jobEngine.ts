import type { Job } from '../types/job'
import { fetchCustomJobs, firebaseApp } from './firebase'
import { pakistanJobs } from '../data/pakistanJobs'
import { fetchRozeeJobs } from './rozeeFeed'
import { getFirestore, collection, doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

const REMOTIVE_ENDPOINT = 'https://remotive.com/api/remote-jobs'
const ARBEITNOW_ENDPOINT = 'https://www.arbeitnow.com/api/job-board'
const JOBICY_ENDPOINT = 'https://jobicy.com/api/v2/remote-jobs?count=50'
const JSEARCH_ENDPOINT = 'https://jsearch.p.rapidapi.com/search'
const JSEARCH_API_KEY = String(import.meta.env.VITE_JSEARCH_API_KEY ?? '')
const FETCH_TIMEOUT_MS = 7000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const SESSION_TTL_MS = 10 * 60 * 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2, delay = 1000): Promise<Response> {
  try {
    const res = await fetch(url, options)
    if (res.ok) return res
    if ((res.status === 429 || (res.status >= 500 && res.status < 600)) && retries > 0) {
      await sleep(delay)
      return fetchWithRetry(url, options, retries - 1, delay * 2)
    }
    return res
  } catch (err) {
    if (retries > 0) {
      await sleep(delay)
      return fetchWithRetry(url, options, retries - 1, delay * 2)
    }
    throw err
  }
}

const normalizeText = (value?: string): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[–—―]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')

const normalizeUrl = (rawUrl?: string): string | undefined => {
  if (!rawUrl) return undefined
  const url = String(rawUrl).trim()
  if (!url || url.includes('google.com/search')) return undefined
  return url
}

const normalizeTags = (rawTags: unknown): string[] | undefined => {
  if (Array.isArray(rawTags)) {
    return rawTags.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof rawTags === 'string' && rawTags.trim()) {
    return rawTags
      .split(/[,;|]/)
      .map((item) => String(item).trim())
      .filter(Boolean)
  }
  return undefined
}

const normalizeJobKey = (job: Job & { source?: string }): string => {
  const source = normalizeText(job.source ?? 'unknown')
  const identity = String(job.id ?? job.url ?? '').trim()
  if (identity) return `${source}|${identity}`

  const company = normalizeText(job.company_name)
  const title = normalizeText(job.title)
  const location = normalizeText(job.candidate_required_location)
  return `${source}|${company}|${title}|${location}`
}

const normalizeJob = (job: Job & { source?: string }): Job => {
  const title = String(job.title ?? 'Job').trim() || 'Job'
  const company_name = String(job.company_name ?? 'Unknown').trim() || 'Unknown'
  const candidate_required_location =
    String(job.candidate_required_location ?? (job as any).location ?? 'Remote').trim() || 'Remote'
  const url = normalizeUrl(job.url) ?? '/apply'
  const id = !['', 'undefined', 'null'].includes(String(job.id ?? '').trim())
    ? String(job.id)
    : `${normalizeText(title)}-${normalizeText(company_name)}-${normalizeText(candidate_required_location)}`

  return {
    ...job,
    id,
    title,
    company_name,
    candidate_required_location,
    url,
    category: String(job.category ?? (job as any).job_category ?? 'Other').trim() || 'Other',
    job_type: String(job.job_type ?? (job as any).employment_type ?? (job as any).type ?? 'Remote').trim() || 'Remote',
    publication_date: String(job.publication_date ?? '').trim() || undefined,
    company_logo: String(job.company_logo ?? '').trim() || undefined,
    description: String(job.description ?? (job as any).details ?? '').trim() || undefined,
    tags: normalizeTags((job as any).tags) ?? normalizeTags((job as any).tag_list) ?? undefined,
    source: job.source,
  }
}

const sessionCacheKey = (key: string): string => `jobEngine_cache_${key}`

const readSessionCache = <T>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (Date.now() - Number(parsed.ts) > SESSION_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    return Array.isArray(parsed.data) ? parsed.data : null
  } catch {
    return null
  }
}

const writeSessionCache = <T>(key: string, data: T): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    /* ignore cache failures */
  }
}

const clearSessionCaches = (): void => {
  ['remotive', 'arbeitnow', 'jobicy', 'rozee'].forEach((key) => {
    try {
      sessionStorage.removeItem(sessionCacheKey(key))
    } catch {
      /* ignore */
    }
  })
}

const getAbortController = () => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return { controller, timeoutId }
}

const fetchWithProxy = async (endpoint: string, signal: AbortSignal): Promise<Response | null> => {
  const primary = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`
  const fallback = `https://corsproxy.io/?${encodeURIComponent(endpoint)}`

  try {
    return await fetchWithRetry(primary, { method: 'GET', signal }, 2, 1000)
  } catch {
    try {
      return await fetchWithRetry(fallback, { method: 'GET', signal }, 1, 1000)
    } catch (err) {
      console.warn('[jobEngine] proxy fetch failed:', endpoint, err)
      return null
    }
  }
}

const safeFetchCustomJobs = async (): Promise<Job[]> => {
  try {
    return await Promise.race([fetchCustomJobs(), new Promise<Job[]>((resolve) => setTimeout(() => resolve([]), 1500))])
  } catch (err) {
    console.warn('[jobEngine] fetchCustomJobs failed:', err)
    return []
  }
}

const safeFetchRemotiveJobs = async (): Promise<Job[]> => {
  const cacheKey = sessionCacheKey('remotive')
  const cached = readSessionCache<Job[]>(cacheKey)
  if (cached) return cached

  const { controller, timeoutId } = getAbortController()
  try {
    const response = await fetchWithProxy(REMOTIVE_ENDPOINT, controller.signal)
    if (!response?.ok) return []
    const json = (await response.json()) as { jobs?: Job[] }
    const jobs = Array.isArray(json.jobs) ? json.jobs : []
    writeSessionCache(cacheKey, jobs)
    return jobs
  } catch (err) {
    console.warn('[jobEngine] Remotive fetch failed:', err)
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const safeFetchArbeitnowJobs = async (): Promise<Job[]> => {
  const cacheKey = sessionCacheKey('arbeitnow')
  const cached = readSessionCache<Job[]>(cacheKey)
  if (cached) return cached

  const { controller, timeoutId } = getAbortController()
  try {
    const response = await fetchWithProxy(ARBEITNOW_ENDPOINT, controller.signal)
    if (!response?.ok) return []
    const json = await response.json()
    const items = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []
    const jobs = items.map((item: any): Job => ({
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
    writeSessionCache(cacheKey, jobs)
    return jobs
  } catch (err) {
    console.warn('[jobEngine] Arbeitnow fetch failed:', err)
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const safeFetchJobicyJobs = async (): Promise<Job[]> => {
  const cacheKey = sessionCacheKey('jobicy')
  const cached = readSessionCache<Job[]>(cacheKey)
  if (cached) return cached

  const { controller, timeoutId } = getAbortController()
  try {
    const response = await fetchWithProxy(JOBICY_ENDPOINT, controller.signal)
    if (!response?.ok) return []
    const json = await response.json()
    const items = Array.isArray(json.jobs)
      ? json.jobs
      : Array.isArray(json.results)
      ? json.results
      : Array.isArray(json.data)
      ? json.data
      : []
    const jobs = items.map((item: any): Job => ({
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
    writeSessionCache(cacheKey, jobs)
    return jobs
  } catch (err) {
    console.warn('[jobEngine] Jobicy fetch failed:', err)
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const safeFetchRozeeCached = async (): Promise<Job[]> => {
  const cacheKey = sessionCacheKey('rozee')
  const cached = readSessionCache<Job[]>(cacheKey)
  if (cached) return cached

  const { controller, timeoutId } = getAbortController()
  try {
    const jobs = await fetchRozeeJobs()
    writeSessionCache(cacheKey, jobs)
    return jobs
  } catch (err) {
    console.warn('[jobEngine] Rozee fetch failed:', err)
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const isCacheFresh = (timestamp: unknown): boolean => {
  if (!timestamp) return false
  if (timestamp instanceof Timestamp) {
    return Date.now() - timestamp.toMillis() < CACHE_TTL_MS
  }
  const parsed = new Date(String(timestamp))
  return !Number.isNaN(parsed.getTime()) && Date.now() - parsed.getTime() < CACHE_TTL_MS
}

const fetchCachedJSearchJobs = async (): Promise<Job[]> => {
  if (!JSEARCH_API_KEY) return []

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

    const queries = [
      'remote software developer',
      'react developer',
      'data science remote',
      'product manager',
      'marketing remote',
    ]

    const collected: Job[] = []
    for (const query of queries) {
      const url = new URL(JSEARCH_ENDPOINT)
      url.searchParams.set('query', query)
      url.searchParams.set('num_pages', '2')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': JSEARCH_API_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      })
      if (!response.ok) continue

      const json = await response.json()
      const items = Array.isArray(json.data) ? json.data : []
      for (const item of items) {
        collected.push({
          id: item.job_id ?? item.id ?? `${item.title}-${item.company_name ?? item.company}`,
          title: item.job_title ?? item.title ?? 'Job',
          company_name: item.employer_name ?? item.company_name ?? item.company ?? 'Unknown',
          candidate_required_location:
            item.job_city ?? item.location ?? item.candidate_required_location ?? 'Remote',
          url: item.job_apply_link ?? item.job_link ?? item.url,
          publication_date: item.job_posted_at ?? item.publication_date,
          description: item.job_description ?? item.description,
          category: item.job_category ?? item.category,
          job_type: item.job_employment_type ?? item.job_type ?? 'Remote',
          company_logo: item.company_logo,
          tags: normalizeTags(item.tags) ?? undefined,
          source: 'jsearch',
        })
      }
    }

    try {
      await setDoc(cacheRef, {
        jobs: collected,
        updatedAt: serverTimestamp(),
      })
    } catch {
      /* ignore */
    }
    return collected
  } catch (err) {
    console.warn('[jobEngine] fetchCachedJSearchJobs failed:', err)
    return []
  }
}

export const mergeJobs = (jobs: Job[]): Job[] => {
  const seen = new Map<string, Job>()
  for (const rawJob of jobs) {
    const normalized = normalizeJob(rawJob as Job & { source?: string })
    const key = normalizeJobKey(normalized)
    if (!seen.has(key)) {
      seen.set(key, normalized)
    }
  }
  return Array.from(seen.values())
}

export async function getFastJobsFromEngine(): Promise<{ jobs: Job[]; source: string }> {
  return getJobsFromEngine()
}

export async function getJobsFromEngine(): Promise<{ jobs: Job[]; source: string }> {
  const sources = [
    { name: 'firebase', promise: safeFetchCustomJobs() },
    { name: 'rozee', promise: safeFetchRozeeCached() },
    { name: 'remotive', promise: safeFetchRemotiveJobs() },
    { name: 'arbeitnow', promise: safeFetchArbeitnowJobs() },
    { name: 'jobicy', promise: safeFetchJobicyJobs() },
    { name: 'jsearch', promise: fetchCachedJSearchJobs() },
  ]

  const results = await Promise.allSettled(sources.map((source) => source.promise))
  const rawJobs: Job[] = pakistanJobs.map((job) => ({ ...(job as any), source: 'local' }))
  const sourceParts = new Set<string>(['local'])

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) return
    const sourceName = sources[index].name
    if (result.value.length > 0) {
      sourceParts.add(sourceName)
    }
    result.value.forEach((job) => rawJobs.push({ ...(job as any), source: sourceName }))
  })

  let combinedJobs = mergeJobs(rawJobs)
  if (combinedJobs.length < 100) {
    combinedJobs = mergeJobs([...pakistanJobs.map((job) => ({ ...(job as any), source: 'local' })), ...combinedJobs])
  }

  if (combinedJobs.length < 20) {
    clearSessionCaches()
  }

  return {
    jobs: combinedJobs,
    source: Array.from(sourceParts).join('+'),
  }
}

