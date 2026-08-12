import { useCallback, useEffect, useRef, useState } from 'react'
import { JobRepository } from '../../repositories/jobRepository'
import type { Job, JobFilter } from '../../types/job'

const INITIAL_FILTER: JobFilter = {
  searchQuery: '',
  category: '',
  jobType: 'all',
  location: '',
}

const cloneFilter = (filter: JobFilter): JobFilter => ({
  searchQuery: filter.searchQuery ?? '',
  category: filter.category ?? '',
  jobType: filter.jobType ?? 'all',
  location: filter.location ?? '',
})

export function useHomeViewModel() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilterState] = useState<JobFilter>(
    INITIAL_FILTER
  )
  const [activeSource, setActiveSource] =
    useState<string>('loading')
  const [totalJobs, setTotalJobs] = useState<number>(0)

  /*
   * Prevent an older/slower request from overwriting
   * the result of a newer request.
   */
  const requestIdRef = useRef(0)

  /*
   * Prevent React StrictMode / initial-render races
   * from unnecessarily replacing good data.
   */
  const mountedRef = useRef(false)

  /* ------------------------------------------------------------------------ */
  /* LOAD JOBS                                                                */
  /* ------------------------------------------------------------------------ */

  const loadJobs = useCallback(
    async (currentFilter?: JobFilter) => {
      const activeFilter = cloneFilter(
        currentFilter ?? filter
      )

      const requestId = ++requestIdRef.current

      setLoading(true)
      setError(null)

      try {
        const result =
          await JobRepository.getJobs(activeFilter)

        /*
         * Ignore stale responses.
         *
         * Example:
         *
         * Request A = "react"
         * Request B = "react native"
         *
         * If A finishes after B, A must NOT overwrite B.
         */
        if (requestId !== requestIdRef.current) {
          return
        }

        const fetchedJobs = Array.isArray(result.jobs)
          ? result.jobs
          : []

        setJobs(fetchedJobs)
        setActiveSource(
          result.source || 'unknown'
        )
        setTotalJobs(fetchedJobs.length)

        /*
         * A successful request returning zero jobs is
         * not treated as a technical error.
         */
        if (fetchedJobs.length === 0) {
          setError(null)
        }
      } catch (err: unknown) {
        /*
         * Ignore stale errors as well.
         */
        if (requestId !== requestIdRef.current) {
          return
        }

        const message =
          err instanceof Error
            ? err.message
            : String(err)

        console.error(
          '[useHomeViewModel] Failed to load jobs:',
          err
        )

        setError(
          `Unable to load jobs: ${message}`
        )

        /*
         * Do not leave stale counts on a failed request.
         */
        setJobs([])
        setTotalJobs(0)
        setActiveSource('error')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [filter]
  )

  /* ------------------------------------------------------------------------ */
  /* INITIAL LOAD                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (mountedRef.current) {
      return
    }

    mountedRef.current = true

    void loadJobs(INITIAL_FILTER)
  }, [loadJobs])

  /* ------------------------------------------------------------------------ */
  /* FILTER STATE                                                             */
  /* ------------------------------------------------------------------------ */

  const setFilter = useCallback(
    (nextFilter: JobFilter) => {
      setFilterState(cloneFilter(nextFilter))
    },
    []
  )

  /* ------------------------------------------------------------------------ */
  /* SEARCH                                                                   */
  /* ------------------------------------------------------------------------ */

  const setSearchQuery = useCallback(
    (searchQuery: string) => {
      setFilterState((previous) => ({
        ...previous,
        searchQuery,
      }))
    },
    []
  )

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      const nextFilter: JobFilter = {
        ...filter,
        searchQuery,
      }

      setFilterState(nextFilter)

      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  /* ------------------------------------------------------------------------ */
  /* CATEGORY                                                                 */
  /* ------------------------------------------------------------------------ */

  const setCategoryFilter = useCallback(
    async (category: string) => {
      const nextFilter: JobFilter = {
        ...filter,
        category,
      }

      setFilterState(nextFilter)

      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  /* ------------------------------------------------------------------------ */
  /* JOB TYPE                                                                  */
  /* ------------------------------------------------------------------------ */

  const setJobTypeFilter = useCallback(
    async (jobType: string) => {
      const nextFilter: JobFilter = {
        ...filter,
        jobType,
      }

      setFilterState(nextFilter)

      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  /* ------------------------------------------------------------------------ */
  /* LOCATION                                                                 */
  /* ------------------------------------------------------------------------ */

  const setLocationFilter = useCallback(
    async (location: string) => {
      const nextFilter: JobFilter = {
        ...filter,
        location,
      }

      setFilterState(nextFilter)

      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  /* ------------------------------------------------------------------------ */
  /* UPDATE ALL FILTERS                                                       */
  /* ------------------------------------------------------------------------ */

  const updateFilters = useCallback(
    async (updatedFilter: JobFilter) => {
      const nextFilter =
        cloneFilter(updatedFilter)

      setFilterState(nextFilter)

      await loadJobs(nextFilter)
    },
    [loadJobs]
  )

  /* ------------------------------------------------------------------------ */
  /* RESET                                                                    */
  /* ------------------------------------------------------------------------ */

  const resetFilters = useCallback(
    async () => {
      const resetFilter: JobFilter = {
        ...INITIAL_FILTER,
      }

      setFilterState(resetFilter)

      await loadJobs(resetFilter)
    },
    [loadJobs]
  )

  /* ------------------------------------------------------------------------ */
  /* RETURN                                                                   */
  /* ------------------------------------------------------------------------ */

  return {
    jobs,
    loading,
    error,

    filter,

    setFilter,
    setFilterState,

    activeSource,
    totalJobs,

    handleSearch,
    updateFilters,

    setSearchQuery,
    setCategoryFilter,
    setJobTypeFilter,
    setLocationFilter,

    resetFilters,

    loadJobs,
  }
}

export default useHomeViewModel