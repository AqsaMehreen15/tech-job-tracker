import React, { useState, useEffect } from 'react'
import type { Job } from '../types/job'
import { useAuth } from '../context/AuthContext'
import ApplyModal from './ApplyModal'
import JobDetailsModal from './JobDetailsModal'

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
  const { currentUser } = useAuth()

  const [imageError, setImageError] = useState(false)
  const initial = job.company_name ? job.company_name.charAt(0).toUpperCase() : 'C'
  const [applyOpen, setApplyOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [guestSaved, setGuestSaved] = useState(false)

  const handleApplyFromDetails = () => {
    setDetailsOpen(false)
    setApplyOpen(true)
  }

  useEffect(() => {
    // Reset image error when the company logo URL changes so new logos will attempt to load
    setImageError(false)
  }, [job.company_logo])

  useEffect(() => {
    if (!currentUser) {
      try {
        const raw = localStorage.getItem('guest_favorites') || '[]'
        const list: string[] = JSON.parse(raw)
        setGuestSaved(list.includes(String(job.id)))
      } catch {
        setGuestSaved(false)
      }
    }
  }, [job.id, currentUser])

  const toggleBookmark = () => {
    if (currentUser) {
      // Logged-in user: call provided onBookmark to handle persistence (e.g., Firebase)
      onBookmark && onBookmark(job)
      return
    }

    // Guest user: persist in localStorage
    try {
      const raw = localStorage.getItem('guest_favorites') || '[]'
      const list: string[] = JSON.parse(raw)
      const idStr = String(job.id)
      const exists = list.includes(idStr)
      let newList: string[]
      if (exists) {
        newList = list.filter((i) => i !== idStr)
      } else {
        newList = [...list, idStr]
      }
      localStorage.setItem('guest_favorites', JSON.stringify(newList))
      setGuestSaved(!exists)
    } catch (err) {
      // ignore localStorage errors silently
    }
  }

  return (
    <article style={styles.card} aria-labelledby={`job-${job.id}-title`}>
      <div style={styles.logoWrap}>
          {job.company_logo && !imageError ? (
            // eslint-disable-next-line jsx-a11y/img-redundant-alt
            <img
              src={job.company_logo}
              alt={`${job.company_name} logo`}
              style={styles.logo}
              onError={(e) => {
                try {
                  e.currentTarget.style.display = 'none'
                } catch {}
                setImageError(true)
              }}
              onLoad={(e) => {
                try {
                  e.currentTarget.style.display = ''
                } catch {}
                setImageError(false)
              }}
            />
          ) : (
            <div style={{ ...styles.fallbackAvatar, background: '#eef2ff', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }} aria-hidden>
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
              onClick={toggleBookmark}
                title={isBookmarked || guestSaved ? 'Remove bookmark' : 'Bookmark'}
              style={styles.bookmarkBtn}
            >
                {isBookmarked || guestSaved ? '★' : '☆'}
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

          <button
            onClick={() => setDetailsOpen(true)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(3,105,161,0.12)', background: 'transparent', color: '#0369a1', cursor: 'pointer' }}
          >
            View Details
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

          <JobDetailsModal
            isOpen={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            job={job}
            onApplyClick={handleApplyFromDetails}
            onToggleSave={() => onBookmark && onBookmark(job)}
            isSaved={!!isBookmarked}
          />
        </div>
      </div>
    </article>
  )
}

export default JobCard
