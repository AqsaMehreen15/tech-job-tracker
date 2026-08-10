/**
 * Job-related TypeScript types for Tech Job Tracker
 * Based on Remotive API fields (minimal, strict definitions)
 */

export type JobId = number | string

export interface Job {
  id: JobId
  title: string
  company_name: string
  category?: string
  job_type?: string
  publication_date?: string
  candidate_required_location?: string
  salary?: string
  description?: string
  url?: string
  company_logo?: string
  tags?: string[]
}

/**
 * Common job types used for filtering. Includes an open `string` fallback
 * to allow provider-specific values while keeping common literals typed.
 */
export type JobType = 'full_time' | 'internship' | 'part_time' | 'contract' | 'freelance' | 'all' | string

export interface JobFilter {
  searchQuery: string
  category: string
  jobType: JobType
}

/**
 * API response wrapper for endpoints returning jobs.
 * Mirrors Remotive's typical shape: `{ jobs: Job[], job_count?: number }`.
 */
export interface JobResponse {
  jobs: Job[]
  job_count?: number
  // allow additional fields from the API without losing typing
  [key: string]: unknown
}

export default Job
