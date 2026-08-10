import { fetchJobs } from '../../services/api'
import type { Job, JobFilter } from '../../types/job'

/**
 * Fetch jobs for the Home page using the API service.
 * This is a pure data model function (no React, no hooks).
 */
export async function getHomeJobs(filter?: JobFilter): Promise<Job[]> {
  const jobs = await fetchJobs(filter)
  return Array.isArray(jobs) ? jobs : []
}

/**
 * Return the first 6 jobs for featured display.
 */
export function filterFeaturedJobs(jobs: Job[]): Job[] {
  return jobs.slice(0, 6)
}

export default {
  getHomeJobs,
  filterFeaturedJobs,
}
