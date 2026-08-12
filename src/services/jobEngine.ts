import type { Job } from '../types/job'
import { fetchCustomJobs, firebaseApp } from './firebase'
import { pakistanJobs } from '../data/pakistanJobs'
import { fetchRozeeJobs } from './rozeeFeed'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

const REMOTIVE_ENDPOINT =
  'https://remotive.com/api/remote-jobs'

const ARBEITNOW_ENDPOINT =
  'https://www.arbeitnow.com/api/job-board'

const JOBICY_ENDPOINT =
  'https://jobicy.com/api/v2/remote-jobs?count=100'

const JSEARCH_ENDPOINT =
  'https://jsearch.p.rapidapi.com/search'

const JSEARCH_API_KEY =
  String(import.meta.env.VITE_JSEARCH_API_KEY ?? '')

const FETCH_TIMEOUT_MS = 8000

const SOURCE_CACHE_TTL_MS =
  30 * 60 * 1000

const JSEARCH_CACHE_TTL_MS =
  24 * 60 * 60 * 1000

const AGGREGATE_CACHE_TTL_MS =
  10 * 60 * 1000

const DEBUG_JOB_ENGINE =
  String(import.meta.env.VITE_DEBUG_JOB_ENGINE ?? 'true') ===
  'true'

const AGGREGATE_CACHE_KEY =
  'jobEngine_aggregate_v2'

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const sleep = (
  ms: number
): Promise<void> =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  )

const debugLog = (
  ...args: unknown[]
): void => {
  if (DEBUG_JOB_ENGINE) {
    console.debug('[jobEngine]', ...args)
  }
}

const debugWarn = (
  ...args: unknown[]
): void => {
  if (DEBUG_JOB_ENGINE) {
    console.warn('[jobEngine]', ...args)
  }
}

/* -------------------------------------------------------------------------- */
/* NORMALIZATION                                                              */
/* -------------------------------------------------------------------------- */

const normalizeText = (
  value?: unknown
): string =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[–—―]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')

const normalizeJob = (
  job: Job
): Job => {
  const title =
    String(job.title ?? 'Job').trim()

  const company =
    String(
      job.company_name ?? 'Unknown'
    ).trim()

  const location =
    String(
      job.candidate_required_location ??
        (job as any).location ??
        'Remote'
    ).trim()

  const url =
    String(job.url ?? '').trim()

  const id =
    String(
      job.id ??
        `${title}-${company}-${location}-${url}`
    ).trim()

  return {
    ...job,
    id,
    title,
    company_name: company,
    candidate_required_location:
      location || 'Remote',
    url: url || undefined,
    company_logo:
      String(job.company_logo ?? '').trim(),
  }
}

/* -------------------------------------------------------------------------- */
/* DEDUPLICATION                                                              */
/* -------------------------------------------------------------------------- */

const getJobKey = (
  job: Job
): string => {
  const company =
    normalizeText(job.company_name)

  const title =
    normalizeText(job.title)

  const location =
    normalizeText(
      job.candidate_required_location
    )

  /*
   * URL is used when available.
   * Otherwise title + company + location.
   */
  const url =
    normalizeText(job.url)

  if (url) {
    return `url:${url}`
  }

  return `job:${company}|${title}|${location}`
}

export const mergeJobs = (
  jobs: Job[]
): Job[] => {
  const seen =
    new Map<string, Job>()

  for (const rawJob of jobs) {
    if (!rawJob) {
      continue
    }

    const job =
      normalizeJob(rawJob)

    /*
     * Ignore completely invalid records.
     */
    if (!job.title) {
      continue
    }

    const key =
      getJobKey(job)

    /*
     * Keep first occurrence.
     */
    if (!seen.has(key)) {
      seen.set(key, job)
    }
  }

  return Array.from(
    seen.values()
  )
}

/* -------------------------------------------------------------------------- */
/* FETCH WITH TIMEOUT                                                         */
/* -------------------------------------------------------------------------- */

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> => {
  const controller =
    new AbortController()

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    )

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          options.signal ??
          controller.signal,
      }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

/* -------------------------------------------------------------------------- */
/* PROXY FETCH                                                                */
/* -------------------------------------------------------------------------- */

/*
 * IMPORTANT:
 *
 * Browser applications cannot reliably call every public job API directly
 * because of CORS.
 *
 * We therefore try several public proxy routes.
 *
 * If one proxy returns 429/5xx, we immediately try another route instead
 * of making many repeated retries against the same failing proxy.
 */

const buildProxyUrls = (
  endpoint: string
): string[] => {
  const encoded =
    encodeURIComponent(endpoint)

  return [
    /*
     * Proxy 1
     */
    `https://api.allorigins.win/raw?url=${encoded}`,

    /*
     * Proxy 2
     */
    `https://corsproxy.io/?url=${encoded}`,

    /*
     * Proxy 3
     */
    `https://api.codetabs.com/v1/proxy?quest=${encoded}`,
  ]
}

const fetchThroughProxies = async (
  endpoint: string
): Promise<Response | null> => {
  const proxyUrls =
    buildProxyUrls(endpoint)

  for (
    const proxyUrl of proxyUrls
  ) {
    try {
      debugLog(
        'Trying proxy:',
        proxyUrl
      )

      const response =
        await fetchWithTimeout(
          proxyUrl
        )

      if (response.ok) {
        return response
      }

      debugWarn(
        'Proxy failed:',
        response.status,
        proxyUrl
      )

      /*
       * Do not retry the same proxy when it returns
       * 429 or server errors.
       */
      continue
    } catch (error) {
      debugWarn(
        'Proxy request failed:',
        error
      )
    }
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* SOURCE CACHE                                                               */
/* -------------------------------------------------------------------------- */

type SourceCache = {
  ts: number
  data: Job[]
}

const readSourceCache = (
  key: string
): Job[] | null => {
  try {
    const raw =
      sessionStorage.getItem(key)

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(raw) as SourceCache

    if (
      !parsed ||
      !Array.isArray(parsed.data)
    ) {
      return null
    }

    const age =
      Date.now() -
      Number(parsed.ts ?? 0)

    if (
      age >= SOURCE_CACHE_TTL_MS
    ) {
      return null
    }

    /*
     * NEVER accept an empty cache.
     */
    if (
      parsed.data.length === 0
    ) {
      sessionStorage.removeItem(key)
      return null
    }

    return mergeJobs(parsed.data)
  } catch {
    return null
  }
}

const writeSourceCache = (
  key: string,
  jobs: Job[]
): void => {
  /*
   * NEVER cache [].
   */
  if (
    !Array.isArray(jobs) ||
    jobs.length === 0
  ) {
    return
  }

  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ts: Date.now(),
        data: jobs,
      })
    )
  } catch {
    /*
     * Cache failure is non-fatal.
     */
  }
}

/* -------------------------------------------------------------------------- */
/* FIREBASE                                                                   */
/* -------------------------------------------------------------------------- */

const safeFetchCustomJobs =
  async (): Promise<Job[]> => {
    try {
      const jobs =
        await Promise.race([
          fetchCustomJobs(),

          new Promise<Job[]>(
            (resolve) =>
              setTimeout(
                () => resolve([]),
                5000
              )
          ),
        ])

      return Array.isArray(jobs)
        ? mergeJobs(jobs)
        : []
    } catch (error) {
      debugWarn(
        'Firebase jobs failed:',
        error
      )

      return []
    }
  }

/* -------------------------------------------------------------------------- */
/* REMOTIVE                                                                   */
/* -------------------------------------------------------------------------- */

const safeFetchRemotiveJobs =
  async (): Promise<Job[]> => {
    const cacheKey =
      'jobEngine_cache_remotive_v2'

    const cached =
      readSourceCache(cacheKey)

    if (cached) {
      debugLog(
        'Remotive cache:',
        cached.length
      )

      return cached
    }

    try {
      const response =
        await fetchThroughProxies(
          REMOTIVE_ENDPOINT
        )

      if (!response) {
        return []
      }

      const json =
        await response.json()

      const items =
        Array.isArray(json?.jobs)
          ? json.jobs
          : []

      const jobs: Job[] =
        items.map(
          (item: any): Job => ({
            id:
              item.id ??
              `${item.title}-${item.company_name}`,

            title:
              item.title ??
              'Job',

            company_name:
              item.company_name ??
              'Unknown',

            candidate_required_location:
              item.candidate_required_location ??
              item.location ??
              'Remote',

            url:
              item.url ??
              item.apply_url,

            publication_date:
              item.publication_date ??
              item.created_at,

            description:
              item.description,

            category:
              item.category,

            job_type:
              item.job_type,

            company_logo:
              item.company_logo,

            tags:
              Array.isArray(item.tags)
                ? item.tags
                : undefined,
          })
        )

      const normalized =
        mergeJobs(jobs)

      writeSourceCache(
        cacheKey,
        normalized
      )

      return normalized
    } catch (error) {
      debugWarn(
        'Remotive failed:',
        error
      )

      return []
    }
  }

/* -------------------------------------------------------------------------- */
/* ARBEITNOW                                                                  */
/* -------------------------------------------------------------------------- */

const safeFetchArbeitnowJobs =
  async (): Promise<Job[]> => {
    const cacheKey =
      'jobEngine_cache_arbeitnow_v2'

    const cached =
      readSourceCache(cacheKey)

    if (cached) {
      debugLog(
        'Arbeitnow cache:',
        cached.length
      )

      return cached
    }

    try {
      const response =
        await fetchThroughProxies(
          ARBEITNOW_ENDPOINT
        )

      if (!response) {
        return []
      }

      const json =
        await response.json()

      const items =
        Array.isArray(json?.data)
          ? json.data
          : []

      const jobs: Job[] =
        items.map(
          (item: any): Job => ({
            id:
              item.slug ??
              item.id ??
              `${item.title}-${item.company_name}`,

            title:
              item.title ??
              'Job',

            company_name:
              item.company_name ??
              item.company ??
              'Unknown',

            candidate_required_location:
              item.location ??
              (
                item.remote
                  ? 'Remote'
                  : 'Unknown'
              ),

            url:
              item.url ??
              item.redirect_url ??
              item.job_ad_link,

            publication_date:
              item.created_at ??
              item.publication_date,

            description:
              item.description ??
              item.details,

            category:
              item.job_type ??
              '',

            job_type:
              Array.isArray(
                item.job_types
              )
                ? item.job_types.join(
                    ', '
                  )
                : item.job_type ??
                  item.employment_type,

            company_logo:
              item.company_logo,

            tags:
              Array.isArray(item.tags)
                ? item.tags.map(
                    (tag: unknown) =>
                      String(tag)
                  )
                : undefined,
          })
        )

      const normalized =
        mergeJobs(jobs)

      writeSourceCache(
        cacheKey,
        normalized
      )

      return normalized
    } catch (error) {
      debugWarn(
        'Arbeitnow failed:',
        error
      )

      return []
    }
  }

/* -------------------------------------------------------------------------- */
/* JOBICY                                                                    */
/* -------------------------------------------------------------------------- */

const safeFetchJobicyJobs =
  async (): Promise<Job[]> => {
    const cacheKey =
      'jobEngine_cache_jobicy_v2'

    const cached =
      readSourceCache(cacheKey)

    if (cached) {
      debugLog(
        'Jobicy cache:',
        cached.length
      )

      return cached
    }

    try {
      const response =
        await fetchThroughProxies(
          JOBICY_ENDPOINT
        )

      if (!response) {
        return []
      }

      const json =
        await response.json()

      const items =
        Array.isArray(json?.jobs)
          ? json.jobs
          : Array.isArray(json?.results)
          ? json.results
          : Array.isArray(json?.data)
          ? json.data
          : []

      const jobs: Job[] =
        items.map(
          (item: any): Job => ({
            id:
              item.id ??
              item.uuid ??
              `${item.title}-${item.company_name}`,

            title:
              item.title ??
              item.role ??
              'Job',

            company_name:
              item.company_name ??
              item.company ??
              item.employer_name ??
              'Unknown',

            candidate_required_location:
              item.location ??
              item.candidate_required_location ??
              (
                item.remote
                  ? 'Remote'
                  : 'Unknown'
              ),

            url:
              item.url ??
              item.apply_url ??
              item.job_url ??
              item.link,

            publication_date:
              item.created_at ??
              item.posted_at ??
              item.publication_date,

            description:
              item.description ??
              item.summary,

            category:
              item.category ??
              item.job_category,

            job_type:
              item.job_type ??
              item.employment_type ??
              item.type,

            company_logo:
              item.company_logo,

            tags:
              Array.isArray(item.tags)
                ? item.tags.map(
                    (tag: unknown) =>
                      String(tag)
                  )
                : typeof item.tags ===
                    'string'
                ? item.tags
                    .split(/[,;|]/)
                    .map(
                      (tag: string) =>
                        tag.trim()
                    )
                    .filter(Boolean)
                : undefined,
          })
        )

      const normalized =
        mergeJobs(jobs)

      writeSourceCache(
        cacheKey,
        normalized
      )

      return normalized
    } catch (error) {
      debugWarn(
        'Jobicy failed:',
        error
      )

      return []
    }
  }

/* -------------------------------------------------------------------------- */
/* ROZEE                                                                     */
/* -------------------------------------------------------------------------- */

const safeFetchRozeeJobs =
  async (): Promise<Job[]> => {
    const cacheKey =
      'jobEngine_cache_rozee_v2'

    const cached =
      readSourceCache(cacheKey)

    if (cached) {
      debugLog(
        'Rozee cache:',
        cached.length
      )

      return cached
    }

    try {
      const jobs =
        await fetchRozeeJobs()

      const normalized =
        Array.isArray(jobs)
          ? mergeJobs(jobs)
          : []

      writeSourceCache(
        cacheKey,
        normalized
      )

      return normalized
    } catch (error) {
      debugWarn(
        'Rozee failed:',
        error
      )

      return []
    }
  }

/* -------------------------------------------------------------------------- */
/* JSEARCH FIRESTORE CACHE                                                    */
/* -------------------------------------------------------------------------- */

const isCacheFresh = (
  timestamp: unknown
): boolean => {
  if (!timestamp) {
    return false
  }

  if (
    timestamp instanceof Timestamp
  ) {
    return (
      Date.now() -
        timestamp.toMillis() <
      JSEARCH_CACHE_TTL_MS
    )
  }

  const date =
    new Date(
      String(timestamp)
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false
  }

  return (
    Date.now() -
      date.getTime() <
    JSEARCH_CACHE_TTL_MS
  )
}

const fetchCachedJSearchJobs =
  async (): Promise<Job[]> => {
    if (!JSEARCH_API_KEY) {
      debugWarn(
        'JSearch API key is missing.'
      )

      return []
    }

    try {
      const db =
        getFirestore(
          firebaseApp
        )

      const cacheRef =
        doc(
          collection(
            db,
            'cached_jsearch_results'
          ),
          'latest'
        )

      const cacheSnap =
        await getDoc(cacheRef)

      /*
       * FIRST: use Firestore cache.
       */
      if (cacheSnap.exists()) {
        const cached =
          cacheSnap.data() as {
            jobs?: Job[]
            updatedAt?: unknown
          }

        if (
          Array.isArray(
            cached.jobs
          ) &&
          cached.jobs.length > 0 &&
          isCacheFresh(
            cached.updatedAt
          )
        ) {
          debugLog(
            'JSearch Firestore cache:',
            cached.jobs.length
          )

          return mergeJobs(
            cached.jobs
          )
        }
      }

      /*
       * Cache expired.
       *
       * Make ONE API request.
       */
      const queries = [
        'software developer jobs Pakistan',
        'software engineer jobs Pakistan',
        'frontend developer jobs Pakistan',
        'backend developer jobs Pakistan',
        'full stack developer jobs Pakistan',
      ]

      const queryResults =
        await Promise.allSettled(
          queries.map(
            async (query) => {
              const url =
                new URL(
                  JSEARCH_ENDPOINT
                )

              url.searchParams.set(
                'query',
                query
              )

              url.searchParams.set(
                'num_pages',
                '1'
              )

              const response =
                await fetchWithTimeout(
                  url.toString(),
                  {
                    method: 'GET',

                    headers: {
                      'Content-Type':
                        'application/json',

                      'X-RapidAPI-Key':
                        JSEARCH_API_KEY,

                      'X-RapidAPI-Host':
                        'jsearch.p.rapidapi.com',
                    },
                  },
                  8000
                )

              if (!response.ok) {
                throw new Error(
                  `JSearch ${response.status}`
                )
              }

              const json =
                await response.json()

              return Array.isArray(
                json?.data
              )
                ? json.data
                : []
            }
          )
        )

      const rawItems =
        queryResults.flatMap(
          (result) =>
            result.status ===
              'fulfilled'
              ? result.value
              : []
        )

      const jobs: Job[] =
        rawItems.map(
          (item: any): Job => ({
            id:
              item.job_id ??
              item.id ??
              `${item.job_title}-${item.employer_name}`,

            title:
              item.job_title ??
              item.title ??
              'Job',

            company_name:
              item.employer_name ??
              item.company_name ??
              item.company ??
              'Unknown',

            candidate_required_location:
              item.job_city ??
              item.job_state ??
              item.job_country ??
              item.location ??
              'Remote',

            url:
              item.job_apply_link ??
              item.job_link ??
              item.url,

            publication_date:
              item.job_posted_at ??
              item.publication_date,

            description:
              item.job_description ??
              item.description,

            category:
              item.job_category ??
              item.category,

            job_type:
              item.job_employment_type ??
              item.job_type,

            company_logo:
              item.employer_logo,
          })
        )

      const normalized =
        mergeJobs(jobs)

      /*
       * NEVER overwrite useful cache with [].
       */
      if (
        normalized.length > 0
      ) {
        await setDoc(
          cacheRef,
          {
            jobs: normalized,
            updatedAt:
              serverTimestamp(),
          }
        )

        return normalized
      }

      /*
       * If API produced nothing, return old cache.
       */
      if (cacheSnap.exists()) {
        const cached =
          cacheSnap.data() as {
            jobs?: Job[]
          }

        if (
          Array.isArray(
            cached.jobs
          ) &&
          cached.jobs.length > 0
        ) {
          return mergeJobs(
            cached.jobs
          )
        }
      }

      return []
    } catch (error) {
      debugWarn(
        'JSearch failed:',
        error
      )

      /*
       * Stale cache fallback.
       */
      try {
        const db =
          getFirestore(
            firebaseApp
          )

        const cacheRef =
          doc(
            collection(
              db,
              'cached_jsearch_results'
            ),
            'latest'
          )

        const cacheSnap =
          await getDoc(cacheRef)

        if (
          cacheSnap.exists()
        ) {
          const cached =
            cacheSnap.data() as {
              jobs?: Job[]
            }

          if (
            Array.isArray(
              cached.jobs
            ) &&
            cached.jobs.length > 0
          ) {
            return mergeJobs(
              cached.jobs
            )
          }
        }
      } catch {
        /*
         * Secondary cache failure
         * is non-fatal.
         */
      }

      return []
    }
  }

/* -------------------------------------------------------------------------- */
/* AGGREGATE CACHE                                                            */
/* -------------------------------------------------------------------------- */

type AggregateCache = {
  ts: number
  jobs: Job[]
  source: string
}

const readAggregateCache =
  (): {
    jobs: Job[]
    source: string
  } | null => {
    try {
      const raw =
        sessionStorage.getItem(
          AGGREGATE_CACHE_KEY
        )

      if (!raw) {
        return null
      }

      const parsed =
        JSON.parse(raw) as AggregateCache

      if (
        !parsed ||
        !Array.isArray(
          parsed.jobs
        )
      ) {
        return null
      }

      const age =
        Date.now() -
        Number(parsed.ts ?? 0)

      if (
        age >=
        AGGREGATE_CACHE_TTL_MS
      ) {
        return null
      }

      /*
       * Critical:
       * empty aggregate cache is NEVER valid.
       */
      if (
        parsed.jobs.length === 0
      ) {
        sessionStorage.removeItem(
          AGGREGATE_CACHE_KEY
        )

        return null
      }

      return {
        jobs: mergeJobs(
          parsed.jobs
        ),
        source:
          parsed.source ||
          'session_cache',
      }
    } catch {
      return null
    }
  }

const writeAggregateCache = (
  jobs: Job[],
  source: string
): void => {
  if (
    !Array.isArray(jobs) ||
    jobs.length === 0
  ) {
    return
  }

  try {
    sessionStorage.setItem(
      AGGREGATE_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        jobs,
        source,
      })
    )
  } catch {
    /*
     * Non-fatal.
     */
  }
}

/* -------------------------------------------------------------------------- */
/* IN-FLIGHT REQUEST                                                          */
/* -------------------------------------------------------------------------- */

let inFlightRequest:
  | Promise<{
      jobs: Job[]
      source: string
    }>
  | null = null

/* -------------------------------------------------------------------------- */
/* LOAD ALL SOURCES                                                           */
/* -------------------------------------------------------------------------- */

const loadAllSources =
  async (): Promise<{
    jobs: Job[]
    source: string
  }> => {
    /*
     * Use non-empty aggregate cache.
     */
    const cached =
      readAggregateCache()

    if (cached) {
      debugLog(
        'Using aggregate cache:',
        cached.jobs.length
      )

      return cached
    }

    /*
     * IMPORTANT:
     *
     * Every source is independent.
     * One failure must NOT kill the others.
     */
    const sources = [
      {
        name: 'firebase',
        promise:
          safeFetchCustomJobs(),
      },

      {
        name: 'rozee',
        promise:
          safeFetchRozeeJobs(),
      },

      {
        name: 'remotive',
        promise:
          safeFetchRemotiveJobs(),
      },

      {
        name: 'arbeitnow',
        promise:
          safeFetchArbeitnowJobs(),
      },

      {
        name: 'jobicy',
        promise:
          safeFetchJobicyJobs(),
      },

      {
        name: 'jsearch',
        promise:
          fetchCachedJSearchJobs(),
      },
    ]

    const results =
      await Promise.allSettled(
        sources.map(
          (source) =>
            source.promise
        )
      )

    /*
     * Collect ONLY successful arrays.
     */
    const rawJobs =
      results.flatMap(
        (result) => {
          if (
            result.status !==
              'fulfilled' ||
            !Array.isArray(
              result.value
            )
          ) {
            return []
          }

          return result.value
        }
      )

    /*
     * Determine which sources actually returned data.
     */
    const sourceParts =
      results
        .map(
          (
            result,
            index
          ) => ({
            result,
            name:
              sources[index]
                .name,
          })
        )
        .filter(
          (item) =>
            item.result.status ===
              'fulfilled' &&
            Array.isArray(
              item.result.value
            ) &&
            item.result.value.length >
              0
        )
        .map(
          (item) =>
            item.name
        )

    let source =
      sourceParts.length > 0
        ? sourceParts.join('+')
        : 'none'

    /*
     * Merge ALL successful sources.
     */
    let combinedJobs =
      mergeJobs(rawJobs)

    /*
     * ONLY use local fallback when ALL live/cached
     * sources returned zero usable jobs.
     */
    if (
      combinedJobs.length === 0
    ) {
      combinedJobs =
        mergeJobs(
          pakistanJobs
        )

      source =
        combinedJobs.length > 0
          ? 'local_fallback'
          : 'none'
    }

    /*
     * Store only useful results.
     */
    if (
      combinedJobs.length > 0
    ) {
      writeAggregateCache(
        combinedJobs,
        source
      )
    }

    if (DEBUG_JOB_ENGINE) {
      console.group(
        '[jobEngine] Source Summary'
      )

      results.forEach(
        (
          result,
          index
        ) => {
          const count =
            result.status ===
              'fulfilled' &&
            Array.isArray(
              result.value
            )
              ? result.value.length
              : 0

          console.log(
            sources[index].name,
            {
              status:
                result.status,
              jobs: count,
            }
          )
        }
      )

      console.log(
        'Raw jobs:',
        rawJobs.length
      )

      console.log(
        'Final jobs:',
        combinedJobs.length
      )

      console.log(
        'Source:',
        source
      )

      console.groupEnd()
    }

    return {
      jobs: combinedJobs,
      source,
    }
  }

/* -------------------------------------------------------------------------- */
/* PUBLIC API                                                                 */
/* -------------------------------------------------------------------------- */

export async function getFastJobsFromEngine(): Promise<{
  jobs: Job[]
  source: string
}> {
  return getJobsFromEngine()
}

export async function getJobsFromEngine(): Promise<{
  jobs: Job[]
  source: string
}> {
  /*
   * Prevent multiple simultaneous engine executions.
   */
  if (inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest =
    loadAllSources()

  try {
    return await inFlightRequest
  } finally {
    inFlightRequest = null
  }
}