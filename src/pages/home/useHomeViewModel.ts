import { useCallback, useEffect, useState } from 'react'
import { JobRepository } from '../../repositories/jobRepository'
import type { Job, JobFilter } from '../../types/job'

const INITIAL_FILTER: JobFilter = {
  searchQuery: '',
  category: 'all',
  jobType: 'all',
}

export function useHomeViewModel() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<JobFilter>(INITIAL_FILTER)
  const [activeSource, setActiveSource] = useState<string>('static')
  const [totalJobs, setTotalJobs] = useState<number>(0)

  const loadJobs = useCallback(
    async (currentFilter?: JobFilter) => {
      const active = currentFilter ?? filter
      setLoading(true)
      setError(null)

      try {
        const { jobs: fetchedJobs, source } = await JobRepository.getJobs(active)
        setJobs(fetchedJobs)
        setActiveSource(source)
        setTotalJobs(fetchedJobs.length)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Unable to load jobs: ${message}`)
        setJobs([])
        setTotalJobs(0)
        setActiveSource('static')
      } finally {
        setLoading(false)
      }
    },
    [filter]
  )

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const handleSearch = async (searchQuery: string) => {
    const updated: JobFilter = { ...filter, searchQuery }
    setFilter(updated)
    await loadJobs(updated)
  }

  const updateFilters = async (updatedFilter: JobFilter) => {
    setFilter(updatedFilter)
    await loadJobs(updatedFilter)
  }

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
    loadJobs,
  }
}

export default useHomeViewModel
