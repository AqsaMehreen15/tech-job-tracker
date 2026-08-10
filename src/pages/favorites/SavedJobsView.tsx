import React from 'react'
import useSavedJobsViewModel from './useSavedJobsViewModel'
import JobCard from '../../components/JobCard'

export const SavedJobsView: React.FC = () => {
  const { savedJobs, loading, error, currentUser, handleRemoveJob, fetchSavedJobs } = useSavedJobsViewModel()

  const styles: { [k: string]: React.CSSProperties } = {
    container: { padding: 12 },
    prompt: { padding: 20, background: '#0f1724', borderRadius: 8, color: '#cbd5e1' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 12 },
    empty: { padding: 20, textAlign: 'center', color: '#94a3b8' },
    actionBtn: { background: 'transparent', border: 'none', color: '#06b6d4', cursor: 'pointer' },
  }

  if (!currentUser) {
    return <div style={styles.prompt}>Please login to view and manage your saved jobs.</div>
  }

  if (loading) return <div style={styles.empty}>Loading saved jobs…</div>

  if (error) {
    return (
      <div>
        <div style={{ color: '#fca5a5' }}>{error}</div>
        <button style={styles.actionBtn} onClick={() => void fetchSavedJobs()}>
          Retry
        </button>
      </div>
    )
  }

  if (!savedJobs || savedJobs.length === 0) {
    return (
      <div style={styles.empty}>
        No saved jobs yet.
        <div>
          <a href="#" style={{ color: '#06b6d4' }}>
            Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <section style={styles.container}>
      <h2>Saved Jobs</h2>
      <div style={styles.grid}>
        {savedJobs.map((job) => (
          <JobCard key={job.id} job={job} isBookmarked onBookmark={() => void handleRemoveJob(job.id)} />
        ))}
      </div>
    </section>
  )
}

export default SavedJobsView
