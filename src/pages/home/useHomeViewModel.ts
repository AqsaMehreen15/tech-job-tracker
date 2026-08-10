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
        // Always fetch the full job list from the model/service and apply
        // deterministic client-side filtering here so we strictly control
        // how category + jobType + searchQuery are combined (logical AND).
        const all = await getHomeJobs()

        const active = currentFilter ?? filter
        const query = (active.searchQuery || '').trim().toLowerCase()
        const categoryFilter = (active.category || '').trim().toLowerCase()
        const jobTypeFilter = (active.jobType || '').trim().toLowerCase()

        const flattenTags = (job: Job): string[] => {
          const raw: any = (job as any).tags
          if (Array.isArray(raw)) return raw.map((t) => String(t).toLowerCase())
          if (typeof raw === 'string') return raw.split(/[,;|]/).map((t) => t.trim().toLowerCase()).filter(Boolean)
          return []
        }

        const matchesText = (text = '', q = '') => String(text).toLowerCase().includes(q)

        const filtered = (all || []).filter((job) => {
          // Category filter (AND)
          if (categoryFilter && categoryFilter !== 'all') {
            const cat = (job.category || '').toLowerCase()
            const tags = flattenTags(job)
            const title = (job.title || '').toLowerCase()
            if (!(cat === categoryFilter || title.includes(categoryFilter) || tags.some((t) => t.includes(categoryFilter)))) {
              return false
            }
          }

          // Job type filter (AND)
          if (jobTypeFilter && jobTypeFilter !== 'all') {
            const jt = jobTypeFilter.replace(/[^a-z]/g, '') // normalize like 'fulltime' or 'parttime'
            const jobTypeField = String((job as any).job_type || (job as any).type || '').toLowerCase()
            const title = (job.title || '').toLowerCase()
            const location = (job.candidate_required_location || '').toLowerCase()
            const tags = flattenTags(job)

            const isMatch = (() => {
              if (!jt) return true
              if (jt.includes('intern')) {
                return jobTypeField.includes('intern') || title.includes('intern') || tags.some((t) => t.includes('intern'))
              }
              if (jt.includes('remote')) {
                return jobTypeField.includes('remote') || location.includes('remote') || tags.some((t) => t.includes('remote'))
              }
              if (jt.includes('part')) {
                return jobTypeField.includes('part') || title.includes('part') || tags.some((t) => t.includes('part'))
              }
              if (jt.includes('full')) {
                return jobTypeField.includes('full') || title.includes('full') || tags.some((t) => t.includes('full'))
              }
              if (jt.includes('contract')) {
                return jobTypeField.includes('contract') || title.includes('contract') || tags.some((t) => t.includes('contract'))
              }

              // fallback: substring match across several fields
              return (
                jobTypeField.includes(jobTypeFilter) ||
                title.includes(jobTypeFilter) ||
                tags.some((t) => t.includes(jobTypeFilter))
              )
            })()

            if (!isMatch) return false
          }

          // Search query (AND): match title, company, category, location, description, tags
          if (query) {
            const title = (job.title || '').toLowerCase()
            const company = (job.company_name || '').toLowerCase()
            const category = (job.category || '').toLowerCase()
            const location = (job.candidate_required_location || '').toLowerCase()
            const description = (job.description || '').toLowerCase()
            const tags = flattenTags(job)

            if (!(
              matchesText(title, query) ||
              matchesText(company, query) ||
              matchesText(category, query) ||
              matchesText(location, query) ||
              matchesText(description, query) ||
              tags.some((t) => t.includes(query))
            )) {
              return false
            }
          }

          return true
        })

        setJobs(filtered)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Unable to load jobs: ${message}`)
        setJobs([])
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
