import type { Job, JobFilter } from '../types/job'
import {
  getJobsFromEngine,
  getFastJobsFromEngine,
  mergeJobs,
} from '../services/jobEngine'

/* -------------------------------------------------------------------------- */
/* TEXT NORMALIZATION                                                         */
/* -------------------------------------------------------------------------- */

const normalizeText = (value?: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[–—―]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')

/* -------------------------------------------------------------------------- */
/* TAGS                                                                       */
/* -------------------------------------------------------------------------- */

const flattenTags = (job: Job): string[] => {
  const raw = (job as any).tags

  if (Array.isArray(raw)) {
    return raw
      .map((tag: unknown) => normalizeText(tag))
      .filter(Boolean)
  }

  if (typeof raw === 'string') {
    return raw
      .split(/[,;|]/)
      .map((tag) => normalizeText(tag))
      .filter(Boolean)
  }

  return []
}

/* -------------------------------------------------------------------------- */
/* SEARCHABLE TEXT                                                            */
/* -------------------------------------------------------------------------- */

const getJobText = (job: Job): string => {
  const fields = [
    job.title,
    job.company_name,
    job.category,
    job.candidate_required_location,
    job.description,
    job.job_type,

    // Extra fields that may exist in API responses
    (job as any).location,
    (job as any).employment_type,
    (job as any).job_category,
    (job as any).department,
    (job as any).skills,
    (job as any).job_function,
  ]

  return normalizeText(
    [...fields.filter(Boolean), ...flattenTags(job)].join(' ')
  )
}

/* -------------------------------------------------------------------------- */
/* CATEGORY KEYWORDS                                                          */
/* -------------------------------------------------------------------------- */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  frontend: [
    'frontend',
    'front end',
    'front-end',
    'react',
    'reactjs',
    'angular',
    'vue',
    'vuejs',
    'nextjs',
    'javascript',
    'typescript',
    'web developer',
    'web development',
  ],

  backend: [
    'backend',
    'back end',
    'back-end',
    'node',
    'nodejs',
    'express',
    'nestjs',
    'django',
    'flask',
    'fastapi',
    'spring',
    'spring boot',
    'laravel',
    'php',
    'api developer',
    'api engineer',
    'server side',
    'server-side',
    'microservices',
    'rest api',
    'restful',
    'graphql',
  ],

  'full stack': [
    'full stack',
    'fullstack',
    'full-stack',
    'software engineer',
    'software developer',
    'web developer',
    'application developer',
  ],

  mobile: [
    'mobile',
    'android',
    'ios',
    'flutter',
    'react native',
    'kotlin',
    'swift',
    'mobile developer',
    'mobile engineer',
  ],

  'ui/ux design': [
    'ui ux',
    'ui/ux',
    'ux designer',
    'ui designer',
    'product designer',
    'visual designer',
    'figma',
    'user experience',
    'user interface',
  ],

  devops: [
    'devops',
    'docker',
    'kubernetes',
    'aws',
    'azure',
    'gcp',
    'terraform',
    'sre',
    'site reliability',
    'cloud engineer',
    'cloud infrastructure',
  ],

  'data science': [
    'data science',
    'data scientist',
    'data analyst',
    'machine learning',
    'data engineer',
    'analytics',
    'python',
  ],

  'cyber security': [
    'cyber security',
    'cybersecurity',
    'security engineer',
    'security analyst',
    'information security',
    'infosec',
    'soc analyst',
  ],

  'quality assurance (qa)': [
    'qa',
    'quality assurance',
    'software tester',
    'test engineer',
    'testing',
    'selenium',
    'cypress',
    'automation tester',
  ],

  'product management': [
    'product manager',
    'product owner',
    'product management',
    'product lead',
  ],

  'ai/ml': [
    'ai',
    'artificial intelligence',
    'machine learning',
    'deep learning',
    'nlp',
    'natural language processing',
    'computer vision',
    'ml engineer',
    'ai engineer',
  ],

  marketing: [
    'marketing',
    'digital marketing',
    'seo',
    'social media',
    'content marketing',
    'growth marketing',
  ],
}

/* -------------------------------------------------------------------------- */
/* CATEGORY ALIASES                                                          */
/* -------------------------------------------------------------------------- */

const CATEGORY_ALIASES: Record<string, string> = {
  'front end': 'frontend',
  'front-end': 'frontend',

  'back end': 'backend',
  'back-end': 'backend',

  fullstack: 'full stack',
  'full-stack': 'full stack',

  'ui ux': 'ui/ux design',
  'ui/ux': 'ui/ux design',

  qa: 'quality assurance (qa)',

  cybersecurity: 'cyber security',
  'cyber security': 'cyber security',

  'data science': 'data science',

  'ai ml': 'ai/ml',
  'ai/ml': 'ai/ml',
}

/* -------------------------------------------------------------------------- */
/* JOB TYPE KEYWORDS                                                          */
/* -------------------------------------------------------------------------- */

const getTypeKeywords = (value: string): string[] => {
  const normalized = normalizeText(value)

  if (normalized.includes('intern')) {
    return [
      'intern',
      'internship',
      'trainee',
      'graduate',
      'fresh graduate',
      'entry level',
      'entry-level',
    ]
  }

  if (normalized.includes('full')) {
    return [
      'full time',
      'full-time',
      'fulltime',
      'permanent',
    ]
  }

  if (normalized.includes('part')) {
    return [
      'part time',
      'part-time',
      'parttime',
      'temporary',
    ]
  }

  if (normalized.includes('contract')) {
    return [
      'contract',
      'freelance',
      'freelancer',
      'temporary',
      'short term',
      'short-term',
    ]
  }

  if (normalized.includes('remote')) {
    return [
      'remote',
      'work from home',
      'wfh',
      'distributed',
      'anywhere',
    ]
  }

  return [normalized]
}

/* -------------------------------------------------------------------------- */
/* CATEGORY MATCHING                                                         */
/* -------------------------------------------------------------------------- */

const matchesCategory = (
  job: Job,
  filterValue: string
): boolean => {
  const filter = normalizeText(filterValue)

  if (!filter || filter === 'all') {
    return true
  }

  const canonicalCategory =
    CATEGORY_ALIASES[filter] ?? filter

  const keywords =
    CATEGORY_KEYWORDS[canonicalCategory] ?? [canonicalCategory]

  const text = getJobText(job)

  /*
   * IMPORTANT:
   *
   * We check the complete searchable job text instead of only
   * job.category. Many APIs do not populate category correctly.
   */

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword)

    if (!normalizedKeyword) {
      return false
    }

    return text.includes(normalizedKeyword)
  })
}

/* -------------------------------------------------------------------------- */
/* JOB TYPE MATCHING                                                          */
/* -------------------------------------------------------------------------- */

const matchesJobType = (
  job: Job,
  filterValue: string
): boolean => {
  const filter = normalizeText(filterValue)

  if (!filter || filter === 'all') {
    return true
  }

  const text = normalizeText(
    [
      job.job_type,
      job.title,
      job.category,
      job.description,
      (job as any).employment_type,
      (job as any).type,
      ...flattenTags(job),
    ]
      .filter(Boolean)
      .join(' ')
  )

  return getTypeKeywords(filter).some((keyword) => {
    const normalizedKeyword = normalizeText(keyword)

    return (
      normalizedKeyword.length > 0 &&
      text.includes(normalizedKeyword)
    )
  })
}

/* -------------------------------------------------------------------------- */
/* LOCATION MATCHING                                                         */
/* -------------------------------------------------------------------------- */

const matchesLocation = (
  job: Job,
  filterValue: string
): boolean => {
  const filter = normalizeText(filterValue)

  if (!filter) {
    return true
  }

  const locationText = normalizeText(
    [
      job.candidate_required_location,
      (job as any).location,
      (job as any).job_city,
      (job as any).job_state,
      (job as any).job_country,
    ]
      .filter(Boolean)
      .join(' ')
  )

  /*
   * "remote" should also match jobs whose title/description
   * explicitly says remote.
   */

  if (locationText.includes(filter)) {
    return true
  }

  if (filter === 'remote') {
    const text = getJobText(job)

    return (
      text.includes('remote') ||
      text.includes('work from home') ||
      text.includes('wfh') ||
      text.includes('distributed')
    )
  }

  return false
}

/* -------------------------------------------------------------------------- */
/* SEARCH MATCHING                                                            */
/* -------------------------------------------------------------------------- */

const matchesSearchQuery = (
  job: Job,
  query: string
): boolean => {
  const normalizedQuery = normalizeText(query)

  if (!normalizedQuery) {
    return true
  }

  const text = getJobText(job)

  /*
   * First try exact phrase.
   */

  if (text.includes(normalizedQuery)) {
    return true
  }

  /*
   * Then allow individual meaningful words.
   *
   * Example:
   * "android developer"
   *
   * can match a job containing:
   * "Android Engineer"
   */

  const words = normalizedQuery
    .split(' ')
    .filter((word) => word.length >= 2)

  if (words.length === 0) {
    return false
  }

  /*
   * Require at least one meaningful search word.
   *
   * This keeps search useful without becoming excessively strict.
   */

  return words.some((word) =>
    text.includes(word)
  )
}

/* -------------------------------------------------------------------------- */
/* FILTER JOBS                                                                */
/* -------------------------------------------------------------------------- */

const filterJobs = (
  jobs: Job[],
  filters: JobFilter
): Job[] => {
  /*
   * Always start with merged jobs.
   * This prevents duplicate API results from affecting filtering.
   */

  const uniqueJobs = mergeJobs(jobs)

  if (uniqueJobs.length === 0) {
    return []
  }

  const categoryFilter =
    normalizeText(filters.category)

  const jobTypeFilter =
    normalizeText(filters.jobType)

  const locationFilter =
    normalizeText(filters.location)

  const searchQuery =
    normalizeText(filters.searchQuery)

  /*
   * No active filters -> return everything.
   */

  const hasCategory =
    Boolean(
      categoryFilter &&
      categoryFilter !== 'all'
    )

  const hasJobType =
    Boolean(
      jobTypeFilter &&
      jobTypeFilter !== 'all'
    )

  const hasLocation =
    Boolean(locationFilter)

  const hasSearch =
    Boolean(searchQuery)

  if (
    !hasCategory &&
    !hasJobType &&
    !hasLocation &&
    !hasSearch
  ) {
    return uniqueJobs
  }

  /* ---------------------------------------------------------------------- */
  /* PRIMARY FILTER                                                         */
  /* ---------------------------------------------------------------------- */

  const primaryMatches = uniqueJobs.filter((job) => {
    if (
      hasCategory &&
      !matchesCategory(
        job,
        categoryFilter
      )
    ) {
      return false
    }

    if (
      hasJobType &&
      !matchesJobType(
        job,
        jobTypeFilter
      )
    ) {
      return false
    }

    if (
      hasLocation &&
      !matchesLocation(
        job,
        locationFilter
      )
    ) {
      return false
    }

    if (
      hasSearch &&
      !matchesSearchQuery(
        job,
        searchQuery
      )
    ) {
      return false
    }

    return true
  })

  /*
   * Return exact matches first.
   */

  if (primaryMatches.length > 0) {
    return mergeJobs(primaryMatches)
  }

  /* ---------------------------------------------------------------------- */
  /* SMART FALLBACK                                                         */
  /* ---------------------------------------------------------------------- */

  /*
   * If strict filtering produces zero jobs, don't break the app.
   *
   * We progressively relax the filters:
   *
   * 1. Search + category
   * 2. Category only
   * 3. Search only
   * 4. Job type only
   * 5. Location only
   *
   * This is especially useful because different job APIs expose
   * incomplete category/type/location metadata.
   */

  let relaxedMatches: Job[] = []

  if (hasCategory && hasSearch) {
    relaxedMatches = uniqueJobs.filter((job) => {
      return (
        matchesCategory(
          job,
          categoryFilter
        ) &&
        matchesSearchQuery(
          job,
          searchQuery
        )
      )
    })

    if (relaxedMatches.length > 0) {
      return mergeJobs(relaxedMatches)
    }
  }

  if (hasCategory) {
    relaxedMatches = uniqueJobs.filter((job) =>
      matchesCategory(
        job,
        categoryFilter
      )
    )

    if (relaxedMatches.length > 0) {
      return mergeJobs(relaxedMatches)
    }
  }

  if (hasSearch) {
    relaxedMatches = uniqueJobs.filter((job) =>
      matchesSearchQuery(
        job,
        searchQuery
      )
    )

    if (relaxedMatches.length > 0) {
      return mergeJobs(relaxedMatches)
    }
  }

  if (hasJobType) {
    relaxedMatches = uniqueJobs.filter((job) =>
      matchesJobType(
        job,
        jobTypeFilter
      )
    )

    if (relaxedMatches.length > 0) {
      return mergeJobs(relaxedMatches)
    }
  }

  if (hasLocation) {
    relaxedMatches = uniqueJobs.filter((job) =>
      matchesLocation(
        job,
        locationFilter
      )
    )

    if (relaxedMatches.length > 0) {
      return mergeJobs(relaxedMatches)
    }
  }

  /*
   * Nothing matched.
   *
   * Return [] rather than throwing an exception.
   */

  return []
}

/* -------------------------------------------------------------------------- */
/* REPOSITORY                                                                 */
/* -------------------------------------------------------------------------- */

export class JobRepository {
  static async getJobsFast(
    filters: JobFilter
  ): Promise<{
    jobs: Job[]
    source: string
  }> {
    try {
      const {
        jobs,
        source,
      } = await getFastJobsFromEngine()

      const hasFilters = Boolean(
        filters.searchQuery?.trim() ||
          (
            filters.category &&
            filters.category !== 'all' &&
            filters.category.trim()
          ) ||
          (
            filters.jobType &&
            filters.jobType !== 'all' &&
            filters.jobType.trim()
          ) ||
          filters.location?.trim()
      )

      const result = hasFilters
        ? filterJobs(jobs, filters)
        : mergeJobs(jobs)

      return {
        jobs: result,
        source,
      }
    } catch (error) {
      console.error(
        '[JobRepository] getJobsFast failed:',
        error
      )

      return {
        jobs: [],
        source: 'error',
      }
    }
  }

  static async getJobs(
    filters: JobFilter
  ): Promise<{
    jobs: Job[]
    source: string
  }> {
    try {
      const {
        jobs,
        source,
      } = await getJobsFromEngine()

      const hasFilters = Boolean(
        filters.searchQuery?.trim() ||
          (
            filters.category &&
            filters.category !== 'all' &&
            filters.category.trim()
          ) ||
          (
            filters.jobType &&
            filters.jobType !== 'all' &&
            filters.jobType.trim()
          ) ||
          filters.location?.trim()
      )

      const result = hasFilters
        ? filterJobs(jobs, filters)
        : mergeJobs(jobs)

      return {
        jobs: result,
        source,
      }
    } catch (error) {
      console.error(
        '[JobRepository] getJobs failed:',
        error
      )

      return {
        jobs: [],
        source: 'error',
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* DEFAULT EXPORT                                                             */
/* -------------------------------------------------------------------------- */

export default JobRepository