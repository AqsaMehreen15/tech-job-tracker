import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, signup } = useAuth()

  const [isSignUp, setIsSignUp] = useState<boolean>(false)
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  if (!isOpen) return null

  const styles: { [k: string]: React.CSSProperties } = {
    backdrop: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(2,6,23,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
    },
    card: {
      width: 480,
      maxWidth: 'calc(100% - 32px)',
      borderRadius: 12,
      background: '#ffffff',
      color: '#0b1220',
      padding: 20,
      boxShadow: '0 10px 30px rgba(2,6,23,0.5)',
      position: 'relative',
    },
    closeBtn: { position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 },
    title: { margin: 0, fontSize: 18, fontWeight: 700 },
    form: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 },
    input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #e6eef8', fontSize: 14 },
    submit: { padding: '10px 12px', borderRadius: 8, border: 'none', background: '#0369a1', color: '#fff', cursor: 'pointer' },
    toggle: { background: 'transparent', border: 'none', color: '#0369a1', cursor: 'pointer', padding: 0 },
    error: { background: '#fff1f2', color: '#991b1b', padding: 10, borderRadius: 8 },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (isSignUp) {
        await signup(email, password)
      } else {
        await login(email, password)
      }
      setEmail('')
      setPassword('')
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <button aria-label="Close" onClick={onClose} style={styles.closeBtn}>
          ×
        </button>

        <h2 style={styles.title}>{isSignUp ? 'Create an account' : 'Log in'}</h2>

        {error ? <div style={styles.error}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />

          <button type="submit" style={styles.submit} disabled={submitting}>
            {submitting ? (isSignUp ? 'Creating…' : 'Logging in…') : isSignUp ? 'Create Account' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setIsSignUp((s) => !s)}
            style={styles.toggle}
          >
            {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
