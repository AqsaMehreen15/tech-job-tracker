import { useCallback, useEffect, useState } from 'react'
import { JobRepository } from '../../repositories/jobRepository'
import type { Job, JobFilter } from '../../types/job'

const INITIAL_FILTER: JobFilter = {
  searchQuery: '',
  category: '',
  jobType: 'all',
  location: '',
}

export function useHomeViewModel() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<JobFilter>(INITIAL_FILTER)
  const [activeSource, setActiveSource] = useState<string>('local')
  const [totalJobs, setTotalJobs] = useState<number>(0)

  const loadJobs = useCallback(
    async (currentFilter?: JobFilter) => {
      const activeFilter = currentFilter ?? filter
      setLoading(true)
      setError(null)

      try {
        const { jobs: fetchedJobs, source } = await JobRepository.getJobs(activeFilter)
        setJobs(fetchedJobs)
        setActiveSource(source)
        setTotalJobs(fetchedJobs.length)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Unable to load jobs: ${message}`)
        setJobs([])
        setTotalJobs(0)
        setActiveSource('local')
      } finally {
        setLoading(false)
      }
    },
    [filter]
  )

  useEffect(() => {
    void loadJobs(INITIAL_FILTER)
  }, [])

  const setSearchQuery = useCallback(
    async (searchQuery: string) => {
      const nextFilter = { ...filter, searchQuery }
      setFilter(nextFilter)
      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  const setCategoryFilter = useCallback(
    async (category: string) => {
      const nextFilter = { ...filter, category }
      setFilter(nextFilter)
      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  const setJobTypeFilter = useCallback(
    async (jobType: string) => {
      const nextFilter = { ...filter, jobType }
      setFilter(nextFilter)
      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  const setLocationFilter = useCallback(
    async (location: string) => {
      const nextFilter = { ...filter, location }
      setFilter(nextFilter)
      await loadJobs(nextFilter)
    },
    [filter, loadJobs]
  )

  const updateFilters = useCallback(
    async (updatedFilter: JobFilter) => {
      setFilter(updatedFilter)
      await loadJobs(updatedFilter)
    },
    [loadJobs]
  )

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      await setSearchQuery(searchQuery)
    },
    [setSearchQuery]
  )

  return {
    jobs,
    loading,
    error,
    filter,
    setFilter,
    activeSource,
    totalJobs,
    handleSearch,
    updateFilters,
    setSearchQuery,
    setCategoryFilter,
    setJobTypeFilter,
    setLocationFilter,
    loadJobs,
  }
}

export default useHomeViewModel
