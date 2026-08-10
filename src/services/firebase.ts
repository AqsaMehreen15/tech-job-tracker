import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase, ref, set, get, remove } from 'firebase/database'
import type { Job } from '../types/job'

export interface ApplicationData {
  fullName: string
  email: string
  phone: string
  resumeUrl: string
  coverLetter: string
}

// Placeholder config - replace with real project values
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT.firebaseio.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123def456',
}

// Initialize Firebase app and services
export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getDatabase(firebaseApp)

/**
 * Save a job under a specific user's saved jobs.
 * Path: /savedJobs/{userId}/{jobId}
 */
export async function saveUserJob(userId: string, job: Job): Promise<void> {
  try {
    const jobId = String(job.id)
    const jobRef = ref(db, `savedJobs/${userId}/${jobId}`)
    await set(jobRef, job)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to save job: ${message}`)
  }
}

/**
 * Remove a saved job for a user.
 */
export async function removeUserJob(userId: string, jobId: string | number): Promise<void> {
  try {
    const id = String(jobId)
    const jobRef = ref(db, `savedJobs/${userId}/${id}`)
    await remove(jobRef)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to remove job: ${message}`)
  }
}

/**
 * Retrieve saved jobs for a user as an array of Job objects.
 */
export async function getUserSavedJobs(userId: string): Promise<Job[]> {
  try {
    const listRef = ref(db, `savedJobs/${userId}`)
    const snap = await get(listRef)
    if (!snap.exists()) return []
    const data = snap.val()
    if (Array.isArray(data)) return data as Job[]
    // data is likely an object map keyed by jobId
    return Object.values(data) as Job[]
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to fetch saved jobs: ${message}`)
  }
}

/**
 * Submit a job application and store under applications/{userId}/{jobId}
 */
export async function submitJobApplication(
  userId: string,
  jobId: string | number,
  jobTitle: string,
  companyName: string,
  applicationData: ApplicationData
): Promise<void> {
  try {
    const id = String(jobId)
    const appRef = ref(db, `applications/${userId}/${id}`)
    const payload = {
      jobId: id,
      jobTitle,
      companyName,
      applicant: applicationData,
      submittedAt: new Date().toISOString(),
    }
    await set(appRef, payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to submit application: ${message}`)
  }
}

export default {
  firebaseApp,
  auth,
  db,
  saveUserJob,
  removeUserJob,
  getUserSavedJobs,
  submitJobApplication,
}
