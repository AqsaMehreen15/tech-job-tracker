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
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card modal-card--apply modal-card--scroll" style={{ width: 640 }}>
        <button aria-label="Close" onClick={onClose} className="modal-close" style={{ position: 'absolute', top: 12, right: 12 }}>
          ×
        </button>

        <h3 className="modal-title">Apply for {jobTitle}</h3>
        <p className="modal-subtitle">{companyName}</p>

        {showAuthPrompt ? (
          <div className="modal-hint">
            <div>Please log in to submit an application.</div>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="modal-btn modal-btn-primary"
              >
                Log in
              </button>
            </div>
          </div>
        ) : null}

        <AuthModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

        {success ? <div className="modal-success">Application Submitted Successfully! 🎉</div> : null}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-field">
            <label className="modal-label" htmlFor="apply-fullname">Full name</label>
            <input
              id="apply-fullname"
              className="modal-input"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="apply-email">Email address</label>
            <input
              id="apply-email"
              className="modal-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="apply-phone">Phone number</label>
            <input
              id="apply-phone"
              className="modal-input"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="modal-field">
            <label className="modal-label" htmlFor="apply-resume">Resume / Portfolio link</label>
            <input
              id="apply-resume"
              className="modal-input"
              type="url"
              placeholder="Resume / Portfolio link (https://)"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
            />
          </div>

          <div className="modal-field full">
            <label className="modal-label" htmlFor="apply-cover">Cover letter</label>
            <textarea
              id="apply-cover"
              className="modal-textarea"
              placeholder="Cover letter"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>

          <button type="submit" className="modal-btn modal-btn-success" style={{ gridColumn: '1 / -1' }} disabled={submitting || showAuthPrompt}>
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ApplyModal