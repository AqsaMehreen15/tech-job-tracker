import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getUserSavedJobs, removeUserJob } from '../../services/firebase'
import type { Job } from '../../types/job'

export function useSavedJobsViewModel() {
  const { currentUser } = useAuth()
  const [savedJobs, setSavedJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSavedJobs = useCallback(async () => {
    if (!currentUser) {
      setSavedJobs([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const jobs = await getUserSavedJobs(currentUser.uid)
      setSavedJobs(Array.isArray(jobs) ? jobs : [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Unable to load saved jobs: ${message}`)
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    void fetchSavedJobs()
  }, [fetchSavedJobs])

  const handleRemoveJob = useCallback(
    async (jobId: string | number) => {
      if (!currentUser) return
      setLoading(true)
      setError(null)
      try {
        await removeUserJob(currentUser.uid, jobId)
        setSavedJobs((prev) => prev.filter((j) => String(j.id) !== String(jobId)))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Unable to remove job: ${message}`)
      } finally {
        setLoading(false)
      }
    },
    [currentUser]
  )

  return { savedJobs, loading, error, currentUser, handleRemoveJob, fetchSavedJobs }
}

export default useSavedJobsViewModel
