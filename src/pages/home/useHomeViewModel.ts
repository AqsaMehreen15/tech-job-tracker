import { useCallback, useEffect, useState } from 'react'
import { getHomeJobs } from './homeModel'
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

  const loadJobs = useCallback(
    async (currentFilter?: JobFilter) => {
      setLoading(true)
      setError(null)
      try {
        const result = await getHomeJobs(currentFilter ?? filter)
        setJobs(Array.isArray(result) ? result : [])
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Unable to load jobs: ${message}`)
      } finally {
        setLoading(false)
      }
    },
    [filter]
  )

  useEffect(() => {
    loadJobs()
    // intentionally only run on mount and when loadJobs changes
  }, [loadJobs])

  const handleSearch = async (searchQuery: string) => {
    const updated: JobFilter = { ...filter, searchQuery }
    setFilter(updated)
    await loadJobs(updated)
  }

  return {
    jobs,
    loading,
    error,
    filter,
    setFilter,
    loadJobs,
    handleSearch,
  }
}

export default useHomeViewModel
