import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PostProvider } from './context/PostContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

// Apply theme attribute BEFORE React renders to avoid a flash of unstyled content
const savedTheme = localStorage.getItem('onepost_theme') || 'light'
document.documentElement.setAttribute('data-theme', savedTheme)
const themeMeta = document.querySelector('meta[name="theme-color"]')
if (themeMeta) themeMeta.setAttribute('content', savedTheme === 'dark' ? '#0a0b12' : '#fafaf9')

// ────────────────────────────────────────────────────────────
//  Aggressive PWA auto-update for installed mobile apps
// ────────────────────────────────────────────────────────────
//  - Poll the SW for a new version every 60s while the app is open
//  - Re-check immediately when the tab becomes visible again
//  - Re-check when the device comes back online
//  - When a new SW is installed, reload silently so users always run
//    the latest version without having to reinstall the PWA.
const POLL_INTERVAL_MS = 60 * 1000

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // New version is installed and waiting — reload now.
    window.location.reload()
  },
  onRegisteredSW(swUrl, registration) {
    if (!registration) return

    const check = () => {
      // Skip while offline; navigator.onLine is reliable enough on mobile
      if (navigator.onLine === false) return
      registration.update().catch(() => {})
    }

    // 1) Periodic poll
    setInterval(check, POLL_INTERVAL_MS)

    // 2) When tab regains focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })

    // 3) When device reconnects
    window.addEventListener('online', check)

    // 4) Force reload when a brand-new SW takes control mid-session
    let refreshing = false
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }
})
// Keep a reference so tree-shaking doesn't drop it
window.__onepost_updateSW = updateSW

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PostProvider>
            <App />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '12px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '14px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                },
                success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
              }}
            />
          </PostProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
