import type { Job, JobFilter } from '../types/job'
import { getJobsFromEngine, getFastJobsFromEngine } from '../services/jobEngine'

const matches = (value: string, query: string): boolean =>
  value.toLowerCase().includes(query.toLowerCase())

const flattenTags = (job: Job): string[] => {
  const raw = (job as any).tags
  if (Array.isArray(raw)) return raw.map((tag) => String(tag).toLowerCase())
  if (typeof raw === 'string') {
    return raw
      .split(/[,;|]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

const getLocationCity = (query: string): string => {
  const cities = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'multan']
  const normalized = query.toLowerCase()
  return cities.find((city) => normalized.includes(city)) ?? ''
}

const filterJobs = (jobs: Job[], filters: JobFilter): Job[] => {
  const query = (filters.searchQuery || '').trim().toLowerCase()
  const categoryFilter = (filters.category || '').trim().toLowerCase()
  const jobTypeFilter = (filters.jobType || '').trim().toLowerCase()
  const cityInQuery = getLocationCity(query)
  const remainingQuery = cityInQuery ? query.replace(cityInQuery, '').trim() : query

  return jobs.filter((job) => {
    const title = (job.title || '').toLowerCase()
    const company = (job.company_name || '').toLowerCase()
    const category = (job.category || '').toLowerCase()
    const location = (job.candidate_required_location || '').toLowerCase()
    const description = (job.description || '').toLowerCase()
    const jobType = (job.job_type || '').toLowerCase()
    const tags = flattenTags(job)

    if (cityInQuery && !location.includes(cityInQuery)) {
      return false
    }

    if (categoryFilter && categoryFilter !== 'all') {
      if (!(
        category === categoryFilter ||
        title.includes(categoryFilter) ||
        company.includes(categoryFilter) ||
        tags.some((tag) => tag.includes(categoryFilter))
      )) {
        return false
      }
    }

    if (jobTypeFilter && jobTypeFilter !== 'all') {
      const normalizedJobType = jobTypeFilter.replace(/[^a-z]/g, '')
      const matchesType = (() => {
        if (!normalizedJobType) return true
        if (normalizedJobType.includes('intern')) {
          return jobType.includes('intern') || title.includes('intern') || tags.some((tag) => tag.includes('intern'))
        }
        if (normalizedJobType.includes('remote')) {
          return jobType.includes('remote') || location.includes('remote') || tags.some((tag) => tag.includes('remote'))
        }
        if (normalizedJobType.includes('part')) {
          return jobType.includes('part') || title.includes('part') || tags.some((tag) => tag.includes('part'))
        }
        if (normalizedJobType.includes('full')) {
          return jobType.includes('full') || title.includes('full') || tags.some((tag) => tag.includes('full'))
        }
        if (normalizedJobType.includes('contract')) {
          return jobType.includes('contract') || title.includes('contract') || tags.some((tag) => tag.includes('contract'))
        }
        return (
          jobType.includes(jobTypeFilter) ||
          title.includes(jobTypeFilter) ||
          tags.some((tag) => tag.includes(jobTypeFilter))
        )
      })()

      if (!matchesType) {
        return false
      }
    }

    if (remainingQuery) {
      const queryMatches =
        title.includes(remainingQuery) ||
        company.includes(remainingQuery) ||
        category.includes(remainingQuery) ||
        location.includes(remainingQuery) ||
        description.includes(remainingQuery) ||
        tags.some((tag) => tag.includes(remainingQuery))

      if (!queryMatches) return false
    }

    return true
  })
}

export class JobRepository {
  static async getJobsFast(filters: JobFilter): Promise<{ jobs: Job[]; source: string }> {
    const { jobs, source } = await getFastJobsFromEngine()
    return {
      jobs: filterJobs(jobs, filters),
      source,
    }
  }

  static async getJobs(filters: JobFilter): Promise<{ jobs: Job[]; source: string }> {
    const { jobs, source } = await getJobsFromEngine()
    return {
      jobs: filterJobs(jobs, filters),
      source,
    }
  }
}
