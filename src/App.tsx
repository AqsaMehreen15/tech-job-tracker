import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import HomeView from './pages/home/HomeView'
import SavedJobsView from './pages/favorites/SavedJobsView'
import AuthModal from './components/AuthModal'
import { saveUserJob } from './services/firebase'
import type { Job } from './types/job'

const tabButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.12)',
  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
  color: '#e2e8f0',
  cursor: 'pointer',
})

const AppHeader: React.FC<{ active: 'home' | 'saved'; onTab: (tab: 'home' | 'saved') => void; onOpenAuth: () => void }> = ({ active, onTab, onOpenAuth }) => {
  const { currentUser, logout } = useAuth()

  const styles: { [key: string]: React.CSSProperties } = {
    headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    nav: { display: 'flex', gap: 12, alignItems: 'center' },
    userArea: { display: 'flex', gap: 10, alignItems: 'center' },
    badge: { padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' },
    button: { padding: '8px 12px', borderRadius: 999, border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer' },
  }

  return (
    <header className="app-header">
      <div className="container header-inner" style={styles.headerInner}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="brand">💼 Tech Job Tracker</div>
          <nav style={styles.nav} aria-label="Primary navigation">
            <button type="button" onClick={() => onTab('home')} style={tabButtonStyle(active === 'home')}>
              Home
            </button>
            <button type="button" onClick={() => onTab('saved')} style={tabButtonStyle(active === 'saved')}>
              Saved Jobs
            </button>
          </nav>
        </div>

        <div style={styles.userArea}>
          {currentUser ? (
            <>
              <div style={styles.badge}>{currentUser.email || 'User'}</div>
              <button type="button" style={styles.button} onClick={() => void logout()}>
                Logout
              </button>
            </>
          ) : (
            <button type="button" style={styles.button} onClick={onOpenAuth}>
              Login / Register
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

const AppContent: React.FC = () => {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'home' | 'saved'>('home')
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const handleBookmark = async (job: Job) => {
    if (!currentUser) {
      setIsAuthModalOpen(true)
      return
    }

    try {
      await saveUserJob(currentUser.uid, job)
      setActiveTab('saved')
    } catch (error) {
      console.error('Bookmark failed', error)
    }
  }

  return (
    <>
      <AppHeader active={activeTab} onTab={setActiveTab} onOpenAuth={() => setIsAuthModalOpen(true)} />

      <main className="container" style={{ paddingTop: 24 }}>
        {activeTab === 'home' ? <HomeView onBookmark={handleBookmark} /> : <SavedJobsView />}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  )
}

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
)

export default App
