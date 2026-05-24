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

// Auto-update PWA: reload silently when new version is available
registerSW({
  onNeedRefresh() { window.location.reload() },
  onOfflineReady() {}
})

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
