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

const getJobText = (job: Job): string => {
  const fields = [
    job.title,
    job.company_name,
    job.category,
    job.candidate_required_location,
    job.description,
    job.job_type,
  ]
  return normalizeText([...fields.filter(Boolean), ...flattenTags(job)].join(' '))
}

const getTypeKeywords = (filterValue: string): string[] => {
  const normalized = normalizeText(filterValue)
  if (normalized.includes('intern')) return ['intern', 'internship', 'trainee', 'graduate', 'entry level']
  if (normalized.includes('part')) return ['part', 'part-time', 'part time', 'temporary', 'gig']
  if (normalized.includes('contract')) return ['contract', 'freelance', 'temporary', 'short-term']
  if (normalized.includes('remote')) return ['remote', 'work from home', 'wfh', 'distributed', 'anywhere']
  if (normalized.includes('full')) return ['full', 'full-time', 'full time', 'permanent']
  return [normalized]
}

const matchesCategory = (job: Job, filterValue: string): boolean => {
  if (!filterValue || filterValue === 'all') return true
  const normalized = normalizeText(filterValue)
  const text = getJobText(job)
  return text.includes(normalized)
}

const matchesJobType = (job: Job, filterValue: string): boolean => {
  if (!filterValue || filterValue === 'all') return true
  const normalized = normalizeText(filterValue)
  const keywords = getTypeKeywords(filterValue)
  const text = getJobText(job)
  return keywords.some((keyword) => text.includes(keyword)) || text.includes(normalized)
}

const matchesLocation = (job: Job, filterValue: string): boolean => {
  if (!filterValue) return true
  const normalized = normalizeText(filterValue)
  const location = normalizeText(job.candidate_required_location)
  return location.includes(normalized) || getJobText(job).includes(normalized)
}

const matchesSearchQuery = (job: Job, query: string): boolean => {
  if (!query) return true
  return getJobText(job).includes(normalizeText(query))
}

const filterJobs = (jobs: Job[], filters: JobFilter): Job[] => {
  const categoryFilter = normalizeText(filters.category)
  const jobTypeFilter = normalizeText(filters.jobType)
  const locationFilter = normalizeText(filters.location)
  const searchQuery = normalizeText(filters.searchQuery)

  const primaryMatches = jobs.filter((job) => {
    if (!matchesCategory(job, categoryFilter)) return false
    if (!matchesJobType(job, jobTypeFilter)) return false
    if (!matchesLocation(job, locationFilter)) return false
    if (!matchesSearchQuery(job, searchQuery)) return false
    return true
  })

  if (primaryMatches.length >= 5) return mergeJobs(primaryMatches)

  const relaxedMatches = jobs.filter((job) => {
    const text = getJobText(job)
    const categoryMatch = !categoryFilter || matchesCategory(job, categoryFilter)
    const typeMatch = !jobTypeFilter || matchesJobType(job, jobTypeFilter)
    const locationMatch = !locationFilter || matchesLocation(job, locationFilter)
    const queryMatch = !searchQuery || text.includes(searchQuery)
    const tagMatch = flattenTags(job).some((tag) => tag.includes(categoryFilter) || tag.includes(jobTypeFilter))
    return categoryMatch && typeMatch && locationMatch && queryMatch && (tagMatch || text.includes(categoryFilter) || text.includes(jobTypeFilter))
  })

  return mergeJobs(primaryMatches.length > 0 ? [...primaryMatches, ...relaxedMatches] : relaxedMatches)
}

export class JobRepository {
  static async getJobsFast(filters: JobFilter): Promise<{ jobs: Job[]; source: string }> {
    const { jobs, source } = await getFastJobsFromEngine()
    const isRestrictive = Boolean(
      (filters.searchQuery && filters.searchQuery.trim() !== '') ||
      (filters.category && filters.category !== '' && filters.category !== 'all') ||
      (filters.jobType && filters.jobType !== '' && filters.jobType !== 'all') ||
      (filters.location && filters.location.trim() !== '')
    )

    return {
      jobs: isRestrictive ? filterJobs(jobs, filters) : mergeJobs(jobs),
      source,
    }
  }

  static async getJobs(filters: JobFilter): Promise<{ jobs: Job[]; source: string }> {
    const { jobs, source } = await getJobsFromEngine()
    const isRestrictive = Boolean(
      (filters.searchQuery && filters.searchQuery.trim() !== '') ||
      (filters.category && filters.category !== '' && filters.category !== 'all') ||
      (filters.jobType && filters.jobType !== '' && filters.jobType !== 'all') ||
      (filters.location && filters.location.trim() !== '')
    )

    return {
      jobs: isRestrictive ? filterJobs(jobs, filters) : mergeJobs(jobs),
      source,
    }
  }
}
