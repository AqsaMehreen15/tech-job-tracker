import React from 'react'
import useHomeViewModel from './useHomeViewModel'
import JobCard from '../../components/JobCard'
import type { Job } from '../../types/job'

export interface HomeViewProps {
  onBookmark?: (job: Job) => void
}

export const HomeView: React.FC<HomeViewProps> = ({ onBookmark }) => {
  const { jobs, loading, error, filter, setFilter, loadJobs, handleSearch, activeSource, totalJobs } = useHomeViewModel()

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

  const onResetFilters = () => {
    const reset = { searchQuery: '', category: 'all', jobType: 'all' }
    setFilter(reset)
    void loadJobs(reset)
  }

  return (
    <section style={styles.page}>
      <header style={styles.hero}>
        <h1 style={styles.title}>Find Your Next Tech Job & Internship</h1>
        <p style={styles.subtitle}>Search remote-friendly roles across engineering, design, marketing and more.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <strong style={{ color: '#0f172a' }}>{totalJobs} jobs available</strong>
          <span style={{ padding: '4px 10px', background: '#e0f2fe', borderRadius: 999, color: '#0369a1', fontSize: 12 }}>
            Source: {activeSource}
          </span>
        </div>

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
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="Full Stack">Full Stack</option>
            <option value="Mobile">Mobile</option>
            <option value="UI/UX Design">UI/UX Design</option>
            <option value="DevOps">DevOps</option>
            <option value="Data Science">Data Science</option>
            <option value="Cyber Security">Cyber Security</option>
            <option value="Quality Assurance (QA)">Quality Assurance (QA)</option>
            <option value="Product Management">Product Management</option>
            <option value="AI/ML">AI/ML</option>
            <option value="Marketing">Marketing</option>
          </select>

          <select
            aria-label="Filter by job type"
            style={styles.select}
            value={filter.jobType}
            onChange={(e) => onJobTypeChange(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Remote">Remote</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
          </select>

          {(filter.searchQuery || filter.category !== 'all' || filter.jobType !== 'all') && (
            <button type="button" onClick={onResetFilters} style={{ ...styles.button, background: '#6b7280' }}>
              Reset Filters
            </button>
          )}

          <button type="submit" style={styles.button}>Search</button>
        </form>
      </header>

      {error ? (
        <div style={styles.error} role="alert">
          <div>{error}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => void loadJobs()} style={{ ...styles.button, background: '#ef4444' }}>
              Retry
            </button>
          </div>
        </div>
      ) : jobs.length === 0 && loading ? (
        <div style={styles.loading}>Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div style={styles.empty}>No jobs found. Try adjusting your search or filters.</div>
      ) : (
        <>
          <div style={styles.grid}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onBookmark={onBookmark} />
            ))}
          </div>
          {loading && (
            <div style={{ ...styles.loading, marginTop: 16 }}>Loading additional jobs…</div>
          )}
        </>
      )}
    </section>
  )
}

export default HomeView
