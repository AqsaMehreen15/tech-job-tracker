import React from 'react'
import { useHomeViewModel } from './useHomeViewModel'
import JobCard from '../../components/JobCard'
import type { Job } from '../../types/job'

export interface HomeViewProps {
  onBookmark?: (job: Job) => void
}

export const HomeView: React.FC<HomeViewProps> = ({ onBookmark }) => {
  const { jobs, loading, error, filter, setFilter, loadJobs, handleSearch } = useHomeViewModel()

  const styles: { [k: string]: React.CSSProperties } = {
    page: { padding: 24 },
    hero: { marginBottom: 20 },
    title: { margin: 0, fontSize: 28, color: '#0f172a' },
    subtitle: { marginTop: 8, color: '#475569' },
    form: { display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' },
    input: { padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e9ef', minWidth: 220 },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #e6e9ef' },
    button: { padding: '8px 12px', borderRadius: 8, border: 'none', background: '#0369a1', color: '#fff', cursor: 'pointer' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 20 },
    loading: { padding: 20, textAlign: 'center', color: '#64748b' },
    error: { padding: 16, background: '#fff1f2', color: '#991b1b', borderRadius: 8 },
    empty: { padding: 20, textAlign: 'center', color: '#64748b' },
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(filter.searchQuery)
  }

  const onCategoryChange = (value: string) => {
    const updated = { ...filter, category: value }
    setFilter(updated)
    void loadJobs(updated)
  }

  const onJobTypeChange = (value: string) => {
    const updated = { ...filter, jobType: value }
    setFilter(updated)
    void loadJobs(updated)
  }

  return (
    <section style={styles.page}>
      <header style={styles.hero}>
        <h1 style={styles.title}>Find Your Next Tech Job & Internship</h1>
        <p style={styles.subtitle}>Search remote-friendly roles across engineering, design, marketing and more.</p>

        <form onSubmit={onSubmit} style={styles.form} aria-label="job-search-form">
          <input
            aria-label="Search jobs"
            placeholder="Search by title, company or category"
            style={styles.input}
            value={filter.searchQuery}
            onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
          />

          <select
            aria-label="Filter by category"
            style={styles.select}
            value={filter.category}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="all">All categories</option>
            <option value="software-dev">Software Development</option>
            <option value="customer-support">Customer Support</option>
            <option value="design">Design</option>
            <option value="marketing">Marketing</option>
          </select>

          <select
            aria-label="Filter by job type"
            style={styles.select}
            value={filter.jobType}
            onChange={(e) => onJobTypeChange(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="full_time">Full time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>

          <button type="submit" style={styles.button}>Search</button>
        </form>
      </header>

      {loading ? (
        <div style={styles.loading}>Loading jobs…</div>
      ) : error ? (
        <div style={styles.error} role="alert">
          <div>{error}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => void loadJobs()} style={{ ...styles.button, background: '#ef4444' }}>
              Retry
            </button>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div style={styles.empty}>No jobs found. Try adjusting your search or filters.</div>
      ) : (
        <div style={styles.grid}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onBookmark={onBookmark} />
          ))}
        </div>
      )}
    </section>
  )
}

export default HomeView
