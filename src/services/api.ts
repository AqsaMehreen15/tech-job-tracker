import { pakistanJobs } from '../data/pakistanJobs'
import { Job, JobFilter, JobResponse } from '../types/job'
import { fetchCustomJobs } from './firebase'

const REMOTIVE_ENDPOINT = 'https://remotive.com/api/remote-jobs'
const FETCH_TIMEOUT_MS = 3000

const matches = (text: string, query: string): boolean =>
  text.toLowerCase().trim().includes(query.toLowerCase().trim())

const flattenTags = (job: Job): string[] => {
  const tags = (job as any).tags
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).toLowerCase().trim())
  }
  if (typeof tags === 'string') {
    return tags
      .split(/[,;|]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

const safeFetchJobs = async (): Promise<Job[]> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(REMOTIVE_ENDPOINT, { signal: controller.signal })
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as JobResponse
    return Array.isArray(data.jobs) ? data.jobs : []
  } catch {
    return []
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export const fetchJobs = async (filters?: JobFilter): Promise<Job[]> => {
  try {
    const remoteJobs = await safeFetchJobs()

    // Fetch custom jobs from Firebase with a fail-safe timeout (1.5s)
    let customJobs: Job[] = []
    try {
      customJobs = await Promise.race([
        fetchCustomJobs(),
        new Promise<Job[]>((_, reject) => setTimeout(() => reject(new Error('fetchCustomJobs timeout')), 1500)),
      ])
    } catch (err) {
      // If Firebase hangs, is misconfigured, or errors, log and continue with fallback data
      // Do NOT throw — we want the UI to always receive jobs promptly.
      // eslint-disable-next-line no-console
      console.warn('fetchCustomJobs failed or timed out, falling back to local jobs:', err)
      customJobs = []
    }

    const allJobs: Job[] = [...pakistanJobs, ...remoteJobs, ...customJobs]

  if (!filters) {
    return allJobs
  }

    const query = (filters.searchQuery || '').trim()
    const categoryFilter = (filters.category || '').trim()
    const jobTypeFilter = (filters.jobType || '').trim().toLowerCase()

    const lowerQuery = query.toLowerCase()
    const cities = ['karachi', 'lahore', 'islamabad', 'rawalpindi']
    let locationCity = ''
    let remainingQuery = lowerQuery
    for (const c of cities) {
      if (lowerQuery.includes(c)) {
        locationCity = c
        remainingQuery = lowerQuery.replace(c, '').trim()
        break
      }
    }

    const filteredJobs = allJobs.filter((job) => {
    const title = job.title ?? ''
    const company = job.company_name ?? ''
    const category = job.category ?? ''
    const location = job.candidate_required_location ?? ''
    const description = job.description ?? ''
    const jobType = job.job_type ?? ''
    const tags = flattenTags(job)

    // If user searched for a specific city, require the job location to include it (AND logic)
    if (locationCity) {
      if (!location.toLowerCase().includes(locationCity)) return false
    }

    if (categoryFilter && categoryFilter !== 'all') {
      const cf = categoryFilter.toLowerCase()
      const jobCat = category.toLowerCase()
      const categoryMatches =
        jobCat === cf ||
        matches(title, cf) ||
        tags.some((tag) => tag.includes(cf))

      if (!categoryMatches) {
        return false
      }
    }

    if (jobTypeFilter && jobTypeFilter !== 'all') {
      const jt = jobTypeFilter.toLowerCase()
      const jobTypeLower = jobType.toLowerCase()

      if (jt.includes('intern')) {
        const isInternRole = jobTypeLower.includes('intern') || title.toLowerCase().includes('intern') || tags.some((tag) => tag.includes('intern'))
        if (!isInternRole) return false
      } else if (jt.includes('remote')) {
        // remote can be indicated in jobType or location
        const isRemote = jobTypeLower.includes('remote') || location.toLowerCase().includes('remote')
        if (!isRemote) return false
      } else if (jt.includes('full') || jt.includes('part') || jt.includes('contract')) {
        const matchesType = jobTypeLower.includes(jt.replace(/[^a-z]/g, '')) || tags.some((tag) => tag.includes(jt.replace(/[^a-z]/g, '')))
        if (!matchesType) return false
      } else {
        const jobTypeMatches = matches(jobType, jt) || matches(title, jt) || tags.some((tag) => matches(tag, jt))
        if (!jobTypeMatches) return false
      }
    }

    if (remainingQuery) {
      const q = remainingQuery
      const queryMatches =
        matches(title, q) ||
        matches(company, q) ||
        matches(category, q) ||
        matches(location, q) ||
        matches(description, q) ||
        tags.some((tag) => matches(tag, q))

      if (!queryMatches) return false
    }

    return true
  })

    return filteredJobs.length > 0 ? filteredJobs : allJobs
  } catch (err) {
    // Catch any unexpected errors and return a safe fallback so callers never hang or crash.
    // eslint-disable-next-line no-console
    console.warn('fetchJobs encountered an error, returning fallback jobs:', err)
    return pakistanJobs
  }
}
