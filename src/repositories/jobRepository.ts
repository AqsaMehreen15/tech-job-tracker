import type { Job, JobFilter } from '../types/job'
import { getJobsFromEngine, getFastJobsFromEngine, mergeJobs } from '../services/jobEngine'

const normalizeText = (value?: string): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[–—―]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')

const flattenTags = (job: Job): string[] => {
  const raw = (job as any).tags
  if (Array.isArray(raw)) return raw.map((tag) => normalizeText(String(tag)))
  if (typeof raw === 'string') {
    return raw
      .split(/[,;|]/)
      .map((tag) => normalizeText(tag))
      .filter(Boolean)
  }
  return []
}

const getLocationCity = (query: string): string => {
  const cities = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'multan']
  const normalized = normalizeText(query)
  return cities.find((city) => normalized.includes(city)) ?? ''
}

const getJobText = (job: Job): string => {
  const fields = [
    job.title,
    job.company_name,
    job.category,
    job.candidate_required_location,
    job.description,
    job.job_type,
    (job as any).type,
  ]

  const tagText = flattenTags(job).join(' ')
  return normalizeText([...fields.filter(Boolean), tagText].join(' '))
}

const getTypeKeywords = (filterValue: string): string[] => {
  const normalized = normalizeText(filterValue)
  if (normalized.includes('intern')) {
    return ['intern', 'internship', 'trainee', 'fresh', 'graduate', 'entry level']
  }
  if (normalized.includes('part')) {
    return ['part', 'part-time', 'part time', 'temporary', 'gig']
  }
  if (normalized.includes('contract')) {
    return ['contract', 'freelance', 'temporary', 'short-term']
  }
  if (normalized.includes('remote')) {
    return ['remote', 'work from home', 'wfh', 'distributed', 'anywhere']
  }
  if (normalized.includes('full')) {
    return ['full', 'full-time', 'full time', 'permanent']
  }
  return [normalized]
}

const matchesJobType = (job: Job, filterValue: string): boolean => {
  if (!filterValue || filterValue === 'all') return true
  const normalizedFilter = normalizeText(filterValue)
  const keywords = getTypeKeywords(filterValue)
  const jobText = getJobText(job)
  return keywords.some((keyword) => jobText.includes(keyword)) || jobText.includes(normalizedFilter)
}

const matchesCategory = (job: Job, filterValue: string): boolean => {
  if (!filterValue || filterValue === 'all') return true
  const normalizedFilter = normalizeText(filterValue)
  const jobText = getJobText(job)
  return jobText.includes(normalizedFilter)
}

const matchesSearchQuery = (job: Job, query: string): boolean => {
  if (!query) return true
  const normalizedQuery = normalizeText(query)
  const jobText = getJobText(job)
  return jobText.includes(normalizedQuery)
}

const matchesLocation = (job: Job, locationValue: string): boolean => {
  if (!locationValue) return true
  const normalizedLocation = normalizeText(locationValue)
  const candidateLocation = normalizeText(job.candidate_required_location)
  return candidateLocation.includes(normalizedLocation) || getJobText(job).includes(normalizedLocation)
}

const filterJobs = (jobs: Job[], filters: JobFilter): Job[] => {
  const query = normalizeText(filters.searchQuery)
  const categoryFilter = normalizeText(filters.category)
  const jobTypeFilter = normalizeText(filters.jobType)
  const cityInQuery = getLocationCity(query)
  const remainingQuery = cityInQuery ? query.replace(cityInQuery, '').trim() : query

  const primaryMatches = jobs.filter((job) => {
    if (cityInQuery && !matchesLocation(job, cityInQuery)) {
      return false
    }

    if (!matchesCategory(job, categoryFilter)) {
      return false
    }

    if (!matchesJobType(job, jobTypeFilter)) {
      return false
    }

    if (!matchesSearchQuery(job, remainingQuery)) {
      return false
    }

    return true
  })

  if (primaryMatches.length >= 5) {
    return primaryMatches
  }

  const broadened = jobs.filter((job) => {
    const jobText = getJobText(job)
    const categoryMatch = categoryFilter && categoryFilter !== 'all' ? jobText.includes(categoryFilter) : true
    const typeMatch = jobTypeFilter && jobTypeFilter !== 'all' ? matchesJobType(job, jobTypeFilter) : true
    const queryMatch = remainingQuery ? jobText.includes(remainingQuery) : true
    const locationMatch = cityInQuery ? matchesLocation(job, cityInQuery) : true
    const tagMatch = flattenTags(job).some((tag) => categoryMatch && typeMatch && tag.includes(categoryFilter))
    return categoryMatch && typeMatch && queryMatch && locationMatch && (tagMatch || jobText.includes(categoryFilter) || jobText.includes(jobTypeFilter))
  })

  return primaryMatches.length > 0 ? mergeJobs([...primaryMatches, ...broadened]) : mergeJobs(broadened)
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
