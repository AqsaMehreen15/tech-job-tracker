import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { submitJobApplication } from '../services/firebase'
import AuthModal from './AuthModal'

export interface ApplyModalProps {
  isOpen: boolean
  onClose: () => void
  jobTitle: string
  companyName: string
  jobId: string | number
}

export const ApplyModal: React.FC<ApplyModalProps> = ({ isOpen, onClose, jobTitle, companyName, jobId }) => {
  const { currentUser } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // prefill email when user is logged in
      setEmail(currentUser?.email ?? '')
      setShowAuthPrompt(!currentUser)
    }
    if (!isOpen) {
      // reset states when closed
      setSubmitting(false)
      setSuccess(false)
      setFullName('')
      setPhone('')
      setResumeUrl('')
      setCoverLetter('')
    }
  }, [isOpen, currentUser])

  if (!isOpen) return null

  const styles: { [k: string]: React.CSSProperties } = {
    backdrop: {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(2,6,23,0.45)',
      zIndex: 70,
      padding: 20,
    },
    card: {
      width: 640,
      maxWidth: '100%',
      borderRadius: 16,
      backdropFilter: 'blur(8px)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#e6eef8',
      padding: 20,
      boxShadow: '0 10px 30px rgba(2,6,23,0.6)',
      position: 'relative',
    },
    closeBtn: { position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: '#e6eef8', fontSize: 20 },
    title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' },
    subtitle: { margin: '6px 0 12px', fontSize: 13, color: '#cbd5e1' },
    form: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    input: { padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#e6eef8' },
    textarea: { gridColumn: '1 / -1', minHeight: 120, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#e6eef8' },
    submit: { gridColumn: '1 / -1', padding: '10px 12px', borderRadius: 10, border: 'none', background: '#10b981', color: '#04201a', fontWeight: 700, cursor: 'pointer' },
    hint: { gridColumn: '1 / -1', color: '#fef3c7', background: '#92400e', padding: 10, borderRadius: 8 },
    success: { gridColumn: '1 / -1', color: '#065f46', background: '#bbf7d0', padding: 10, borderRadius: 8 },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) {
      setShowAuthPrompt(true)
      return
    }

    setSubmitting(true)
    try {
      await submitJobApplication(currentUser.uid, jobId, jobTitle, companyName, {
        fullName,
        email,
        phone,
        resumeUrl,
        coverLetter,
      })
      setSuccess(true)
      // reset form fields
      setFullName('')
      setPhone('')
      setResumeUrl('')
      setCoverLetter('')
      // show success briefly then close
      setTimeout(() => {
        setSuccess(false)
        setSubmitting(false)
        onClose()
      }, 1500)
    } catch (err: unknown) {
      // simple error handling
      const message = err instanceof Error ? err.message : String(err)
      // show as hint
      // eslint-disable-next-line no-console
      console.error('Application submit error', message)
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true">
      <div style={styles.card}>
        <button aria-label="Close" onClick={onClose} style={styles.closeBtn}>
          ×
        </button>

        <h3 style={styles.title}>Apply for {jobTitle}</h3>
        <div style={styles.subtitle}>{companyName}</div>

        {showAuthPrompt ? (
          <div style={styles.hint}>
            <div>Please log in to submit an application.</div>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#0369a1', color: '#fff', cursor: 'pointer' }}
              >
                Log in
              </button>
            </div>
          </div>
        ) : null}

        <AuthModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

        {success ? <div style={styles.success}>Application Submitted Successfully! 🎉</div> : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            style={styles.input}
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <input
            style={styles.input}
            type="url"
            placeholder="Resume / Portfolio link (https://)"
            value={resumeUrl}
            onChange={(e) => setResumeUrl(e.target.value)}
          />

          <textarea
            style={styles.textarea}
            placeholder="Cover letter"
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
          />

          <button type="submit" style={styles.submit} disabled={submitting || showAuthPrompt}>
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ApplyModal
