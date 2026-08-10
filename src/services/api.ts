import { pakistanJobs } from '../data/pakistanJobs'
import { Job, JobFilter, JobResponse } from '../types/job'

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
  const remoteJobs = await safeFetchJobs()
  const allJobs: Job[] = [...pakistanJobs, ...remoteJobs]

  if (!filters) {
    return allJobs
  }

  const query = (filters.searchQuery || '').trim()
  const categoryFilter = (filters.category || '').trim().toLowerCase()
  const jobTypeFilter = (filters.jobType || '').trim().toLowerCase()

  const filteredJobs = allJobs.filter((job) => {
    const title = job.title ?? ''
    const company = job.company_name ?? ''
    const category = job.category ?? ''
    const location = job.candidate_required_location ?? ''
    const jobType = job.job_type ?? ''
    const tags = flattenTags(job)

    if (categoryFilter && categoryFilter !== 'all') {
      const categoryMatches =
        matches(category, categoryFilter) ||
        matches(title, categoryFilter) ||
        tags.some((tag) => matches(tag, categoryFilter))

      if (!categoryMatches) {
        return false
      }
    }

    if (jobTypeFilter && jobTypeFilter !== 'all') {
      if (['intern', 'internship'].includes(jobTypeFilter)) {
        const isInternRole =
          jobType.toLowerCase().includes('intern') ||
          title.toLowerCase().includes('intern') ||
          tags.some((tag) => tag.includes('intern'))

        if (!isInternRole) {
          return false
        }
      } else if (['onsite', 'hybrid'].includes(jobTypeFilter)) {
        const locationMatches =
          location.toLowerCase().includes('onsite') ||
          location.toLowerCase().includes('hybrid')

        if (!locationMatches) {
          return false
        }
      } else {
        const jobTypeMatches =
          matches(jobType, jobTypeFilter) ||
          matches(title, jobTypeFilter) ||
          tags.some((tag) => matches(tag, jobTypeFilter))

        if (!jobTypeMatches) {
          return false
        }
      }
    }

    if (query) {
      const queryMatches =
        matches(title, query) ||
        matches(company, query) ||
        matches(category, query) ||
        matches(location, query) ||
        tags.some((tag) => matches(tag, query))

      if (!queryMatches) {
        return false
      }
    }

    return true
  })

  return filteredJobs.length > 0 ? filteredJobs : allJobs
}
