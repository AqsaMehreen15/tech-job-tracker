import React, { useState } from 'react'
import type { Job } from '../types/job'
import { postNewJob } from '../services/firebase'

type Props = {
  isOpen: boolean
  onClose: () => void
  onJobPosted: () => void
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
}

const modalStyle: React.CSSProperties = {
  width: 'min(720px, 95%)',
  borderRadius: 12,
  padding: '20px',
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(8px) saturate(120%)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
}

export const PostJobModal: React.FC<Props> = ({ isOpen, onClose, onJobPosted }) => {
  const [title, setTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [category, setCategory] = useState('')
  const [jobType, setJobType] = useState<'full_time' | 'internship' | 'contract'>('full_time')
  const [location, setLocation] = useState('')
  const [salary, setSalary] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  if (!isOpen) return null

  const resetForm = () => {
    setTitle('')
    setCompanyName('')
    setCategory('')
    setJobType('full_time')
    setLocation('')
    setSalary('')
    setUrl('')
    setDescription('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !companyName.trim() || !url.trim()) {
      setToast('Please fill title, company and application link.')
      setTimeout(() => setToast(null), 2500)
      return
    }

    setIsSubmitting(true)
    try {
      const jobData: Omit<Job, 'id' | 'publication_date'> = {
        title: title.trim(),
        company_name: companyName.trim(),
        category: category.trim() || 'Other',
        job_type: jobType,
        candidate_required_location: location.trim() || 'Remote',
        salary: salary.trim() || '',
        description: description.trim() || '',
        url: url.trim(),
        company_logo: undefined,
      }

      await postNewJob(jobData)
      setToast('Job posted successfully')
      onJobPosted()
      setTimeout(() => {
        setToast(null)
        resetForm()
        onClose()
      }, 1200)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setToast(`Failed to post job: ${message}`)
      setTimeout(() => setToast(null), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Post a Job</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#fff' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              placeholder="Job Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
              required
            />
            <input
              placeholder="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              placeholder="Category (e.g., Frontend, DevOps)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
            />

            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as any)}
              style={{ width: 170, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
            >
              <option value="full_time">Full Time</option>
              <option value="internship">Internship</option>
              <option value="contract">Contract</option>
            </select>
          </div>

          <input
            placeholder="Location (e.g., Lahore, Pakistan (On-site))"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
          />

          <input
            placeholder="Salary (e.g., PKR 120,000 - 180,000 / month)"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
          />

          <input
            placeholder="Application Link (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
            required
          />

          <textarea
            placeholder="Job Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#5b8def', color: '#fff' }}
            >
              {isSubmitting ? 'Posting…' : 'Post Job'}
            </button>
          </div>
        </form>

        {toast && (
          <div style={{ position: 'absolute', right: 20, bottom: 20, background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: 8 }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

export default PostJobModal
