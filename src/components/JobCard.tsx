import React, { useState } from 'react'
import type { Job } from '../types/job'
import ApplyModal from './ApplyModal'

export interface JobCardProps {
  job: Job
  onBookmark?: (job: Job) => void
  isBookmarked?: boolean
}

const styles: { [k: string]: React.CSSProperties } = {
  card: {
    display: 'flex',
    gap: 16,
    padding: 16,
    borderRadius: 10,
    background: '#fff',
    boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
    alignItems: 'flex-start',
  },
  logoWrap: {
    width: 64,
    height: 64,
    flex: '0 0 64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#f3f4f6',
    
  },
  logo: { width: '100%', height: '100%', objectFit: 'contain' as const },
  content: { flex: 1, minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' },
  company: { margin: 0, fontSize: 13, color: '#475569' },
  badges: { display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  badge: {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 9999,
    background: '#eef2ff',
    color: '#3730a3',
  },
  meta: { display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', color: '#6b7280', fontSize: 13 },
  actions: { display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' },
  applyLink: { textDecoration: 'none', color: '#0369a1', fontWeight: 600 },
  bookmarkBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#ef4444',
    fontSize: 16,
  },
  fallbackAvatar: { fontSize: 20, fontWeight: 700, color: '#0f172a' },
}

function formatDate(raw?: string) {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString()
}

export const JobCard: React.FC<JobCardProps> = ({ job, onBookmark, isBookmarked }) => {
  const [imageError, setImageError] = useState(false)
  const initial = job.company_name ? job.company_name.charAt(0).toUpperCase() : 'C'
  const [applyOpen, setApplyOpen] = useState(false)

  return (
    <article style={styles.card} aria-labelledby={`job-${job.id}-title`}>
      <div style={styles.logoWrap}>
        {job.company_logo && !imageError ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={job.company_logo}
            alt={`${job.company_name} logo`}
            style={styles.logo}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={styles.fallbackAvatar} aria-hidden>
            {initial}
          </div>
        )}
      </div>

      <div style={styles.content}>
        <div style={styles.header}>
          <div style={{ minWidth: 0 }}>
            <h3 id={`job-${job.id}-title`} style={styles.title}>
              {job.title}
            </h3>
            <p style={styles.company}>{job.company_name}</p>
            <div style={styles.badges}>
              <span style={styles.badge}>{job.category}</span>
              <span style={{ ...styles.badge, background: '#ecfeff', color: '#0f766e' }}>{job.job_type}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#6b7280', fontSize: 13 }}>{formatDate(job.publication_date)}</div>
            <button
              aria-pressed={!!isBookmarked}
              onClick={() => onBookmark && onBookmark(job)}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              style={styles.bookmarkBtn}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div style={styles.meta}>
          <div>{job.candidate_required_location || 'Remote / Any'}</div>
          {job.salary ? <div>• {job.salary}</div> : null}
        </div>

        <div style={styles.actions}>
          <button
            onClick={() => setApplyOpen(true)}
            style={{ ...styles.applyLink, background: '#0369a1', color: '#fff', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            Apply Now
          </button>

          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ ...styles.applyLink, marginLeft: 8 }}>
            View Job Site
          </a>

          <ApplyModal
            isOpen={applyOpen}
            onClose={() => setApplyOpen(false)}
            jobTitle={job.title}
            companyName={job.company_name}
            jobId={job.id}
          />
        </div>
      </div>
    </article>
  )
}

export default JobCard
