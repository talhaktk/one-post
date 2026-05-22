import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PostProvider } from './context/PostContext'
import './index.css'

// Auto-update PWA: reload silently when new version is available
registerSW({
  onNeedRefresh() { window.location.reload() },
  onOfflineReady() {}
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PostProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: '#1a1a3e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontFamily: 'DM Sans' },
              success: { iconTheme: { primary: '#7c3aed', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
            }}
          />
        </PostProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
