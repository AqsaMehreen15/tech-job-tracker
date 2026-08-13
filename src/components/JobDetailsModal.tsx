import React from 'react'
import type { Job } from '../types/job'

type Props = {
  isOpen: boolean
  onClose: () => void
  job: Job
  onApplyClick: () => void
  onToggleSave: () => void
  isSaved: boolean
}

export const JobDetailsModal: React.FC<Props> = ({ isOpen, onClose, job, onApplyClick, onToggleSave, isSaved }) => {
  if (!isOpen) return null

  const responsibilities = [
    'Design, implement and maintain features across the product stack.',
    'Collaborate with product and design to ship high-quality releases on schedule.',
    'Participate in code reviews and mentor junior engineers.',
    'Diagnose and resolve performance and scalability issues in production.',
  ]

  const requirements = [
    '3+ years of relevant industry experience (or 1+ for internships).',
    'Proficiency with the primary tech stack mentioned in the job description.',
    'Strong problem solving, communication and teamwork skills.',
    'Bachelor degree in Computer Science or equivalent practical experience (preferred).',
  ]

  const perks = [
    'Comprehensive health insurance',
    'Flexible working hours and remote options',
    'Annual learning & development budget',
    'Performance bonuses and annual reviews',
  ]

  const jobTypeLabel = (type?: string) => {
    if (!type) return '—'
    const t = type.toLowerCase()
    if (t.includes('intern')) return 'Internship'
    if (t.includes('remote')) return 'Remote'
    if (t.includes('hybrid')) return 'Hybrid'
    if (t.includes('full')) return 'Full-time'
    return type
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header className="modal-header">
          <div className="modal-logo">
            {job.company_logo ? (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img src={job.company_logo} alt={`${job.company_name} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              job.company_name?.charAt(0) ?? 'C'
            )}
          </div>

          <div className="modal-header-content">
            <h2 className="modal-title">{job.title}</h2>
            <p className="modal-subtitle">{job.company_name} • {job.candidate_required_location}</p>
            <div className="modal-meta">
              {job.category ? <span className="modal-meta-chip">{job.category}</span> : null}
              <span className="modal-meta-chip type">{jobTypeLabel(job.job_type)}</span>
              {job.salary ? <span className="modal-meta-chip">{job.salary}</span> : null}
            </div>
          </div>

          <div className="modal-header-actions">
            <button
              onClick={onToggleSave}
              aria-pressed={isSaved}
              title={isSaved ? 'Remove Bookmark' : 'Save Job'}
              className="modal-close"
              style={{ color: isSaved ? '#ffd24d' : undefined }}
            >
              {isSaved ? '★' : '☆'}
            </button>
            <button onClick={onClose} aria-label="Close details" className="modal-close">✕</button>
          </div>
        </header>

        <div className="modal-body">
          <section className="modal-section">
            <h4 className="modal-section-title">About the Role</h4>
            {job.description ? (
              job.description.split('\n\n').map((p, idx) => (
                <p key={idx} className="modal-text" style={{ margin: '8px 0' }}>{p}</p>
              ))
            ) : (
              <>
                <p className="modal-text" style={{ margin: '8px 0' }}>We are looking for a talented individual to join our team and contribute to mission-critical projects.</p>
                <p className="modal-text" style={{ margin: '8px 0' }}>You will work closely with cross-functional teams to deliver scalable, reliable and maintainable software.</p>
              </>
            )}
          </section>

          <section className="modal-section">
            <h4 className="modal-section-title">Key Responsibilities</h4>
            <ul className="modal-list">
              {responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>

          <section className="modal-section">
            <h4 className="modal-section-title">Requirements & Qualifications</h4>
            <ul className="modal-list">
              {requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>

          <section className="modal-section">
            <h4 className="modal-section-title">Perks & Benefits</h4>
            <ul className="modal-list">
              {perks.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="modal-footer">
          <button onClick={onClose} className="modal-btn">Close</button>
          <button onClick={() => { onApplyClick() }} className="modal-btn modal-btn-primary">Apply Now</button>
        </footer>
      </div>
    </div>
  )
}

export default JobDetailsModal