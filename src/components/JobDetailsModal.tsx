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

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'linear-gradient(rgba(2,6,23,0.6), rgba(2,6,23,0.6))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 80,
}

const panel: React.CSSProperties = {
  width: 'min(900px, 96%)',
  height: 'min(86vh, 920px)',
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 12px 40px rgba(2,6,23,0.6)',
  color: '#e6eef8',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  padding: '18px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
  flex: '0 0 auto',
}

const logoStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255,255,255,0.02)',
}

const bodyStyle: React.CSSProperties = {
  padding: 20,
  overflowY: 'auto',
  flex: 1,
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '12px 16px',
  borderTop: '1px solid rgba(255,255,255,0.03)',
  background: 'linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.06))',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flex: '0 0 auto',
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

  const jobTypeLabel = (type: string) => {
    if (!type) return '—'
    const t = type.toLowerCase()
    if (t.includes('intern')) return 'Internship'
    if (t.includes('remote')) return 'Remote'
    if (t.includes('hybrid')) return 'Hybrid'
    if (t.includes('full')) return 'Full-time'
    return type
  }

  return (
    <div style={backdrop} role="dialog" aria-modal="true">
      <div style={panel}>
        <header style={headerStyle}>
          <div style={logoStyle}>
            {job.company_logo ? (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img src={job.company_logo} alt={`${job.company_name} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ fontWeight: 700, fontSize: 22 }}>{job.company_name?.charAt(0) ?? 'C'}</div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{job.title}</h2>
            <div style={{ color: '#a9b3c7', marginTop: 4 }}>{job.company_name} • {job.candidate_required_location}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              {job.salary ? <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 8 }}>{job.salary}</div> : null}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 8 }}>{jobTypeLabel(job.job_type)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onToggleSave} aria-pressed={isSaved} title={isSaved ? 'Remove Bookmark' : 'Save Job'} style={{ background: 'transparent', border: 'none', color: isSaved ? '#ffd24d' : '#cbd5e1', fontSize: 20 }}>
              {isSaved ? '★' : '☆'}
            </button>
            <button onClick={onClose} aria-label="Close details" style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: 18 }}>✕</button>
          </div>
        </header>

        <div style={bodyStyle}>
          <section style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '6px 0' }}>About the Role</h4>
            <div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              {job.description ? (
                job.description.split('\n\n').map((p, idx) => (
                  <p key={idx} style={{ margin: '8px 0' }}>{p}</p>
                ))
              ) : (
                <>
                  <p style={{ margin: '8px 0' }}>We are looking for a talented individual to join our team and contribute to mission-critical projects.</p>
                  <p style={{ margin: '8px 0' }}>You will work closely with cross-functional teams to deliver scalable, reliable and maintainable software.</p>
                </>
              )}
            </div>
          </section>

          <section style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '6px 0' }}>Key Responsibilities</h4>
            <ul>
              {responsibilities.map((r, i) => (
                <li key={i} style={{ margin: '6px 0', color: '#cbd5e1' }}>{r}</li>
              ))}
            </ul>
          </section>

          <section style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '6px 0' }}>Requirements & Qualifications</h4>
            <ul>
              {requirements.map((r, i) => (
                <li key={i} style={{ margin: '6px 0', color: '#cbd5e1' }}>{r}</li>
              ))}
            </ul>
          </section>

          <section style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '6px 0' }}>Perks & Benefits</h4>
            <ul>
              {perks.map((p, i) => (
                <li key={i} style={{ margin: '6px 0', color: '#cbd5e1' }}>{p}</li>
              ))}
            </ul>
          </section>
        </div>

        <footer style={footerStyle}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>Close</button>
          <button onClick={() => { onApplyClick() }} style={{ padding: '10px 14px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none' }}>Apply Now</button>
        </footer>
      </div>
    </div>
  )
}

export default JobDetailsModal
