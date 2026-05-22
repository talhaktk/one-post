import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import BottomNavBar from './components/BottomNavBar'
import LoadingSkeleton from './components/LoadingSkeleton'

// Screens
import Splash from './screens/Splash'
import Auth from './screens/Auth'
import Dashboard from './screens/Dashboard'
import ConnectAccounts from './screens/ConnectAccounts'
import UploadVideo from './screens/UploadVideo'
import AutoEdit from './screens/AutoEdit'
import HashtagManager from './screens/HashtagManager'
import SelectTargets from './screens/SelectTargets'
import Publishing from './screens/Publishing'
import History from './screens/History'
import Settings from './screens/Settings'

// Module A — Breaking News
import BreakingAlerts from './screens/BreakingAlerts'
import AlertDetail from './screens/AlertDetail'
import NewsSettings from './screens/NewsSettings'

// Module B — Scheduler
import CreateSchedule from './screens/CreateSchedule'
import ScheduleCalendar from './screens/ScheduleCalendar'
import ScheduleList from './screens/ScheduleList'
import PostResults from './screens/PostResults'
import AdminConfig from './screens/AdminConfig'

const MAIN_NAV = ['/', '/upload', '/alerts', '/schedule', '/settings']

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-container flex items-center justify-center"><LoadingSkeleton type="page" /></div>
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function AppShell({ children }) {
  const pathname = window.location.pathname
  const showNav = MAIN_NAV.some(p => pathname === p || (p !== '/' && pathname.startsWith(p)))
  return (
    <div className="app-container">
      <div className="screen">
        {children}
      </div>
      {showNav && <BottomNavBar />}
    </div>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontFamily: 'Syne', fontWeight: 800, color: '#7c3aed', marginBottom: 12 }}>OnePost</div>
          <div className="spinner mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/splash" element={<div className="app-container"><Splash /></div>} />
      <Route path="/auth" element={<div className="app-container"><Auth /></div>} />

      <Route path="/" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><AppShell><ConnectAccounts /></AppShell></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute><AppShell><UploadVideo /></AppShell></ProtectedRoute>} />
      <Route path="/edit" element={<ProtectedRoute><AppShell><AutoEdit /></AppShell></ProtectedRoute>} />
      <Route path="/hashtags" element={<ProtectedRoute><AppShell><HashtagManager /></AppShell></ProtectedRoute>} />
      <Route path="/targets" element={<ProtectedRoute><AppShell><SelectTargets /></AppShell></ProtectedRoute>} />
      <Route path="/publishing" element={<ProtectedRoute><AppShell><Publishing /></AppShell></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><AppShell><History /></AppShell></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppShell><Settings /></AppShell></ProtectedRoute>} />
      <Route path="/admin/config" element={<ProtectedRoute><AppShell><AdminConfig /></AppShell></ProtectedRoute>} />

      {/* Module A */}
      <Route path="/alerts" element={<ProtectedRoute><AppShell><BreakingAlerts /></AppShell></ProtectedRoute>} />
      <Route path="/alerts/:id" element={<ProtectedRoute><AppShell><AlertDetail /></AppShell></ProtectedRoute>} />
      <Route path="/news-settings" element={<ProtectedRoute><AppShell><NewsSettings /></AppShell></ProtectedRoute>} />

      {/* Module B */}
      <Route path="/schedule" element={<ProtectedRoute><AppShell><ScheduleCalendar /></AppShell></ProtectedRoute>} />
      <Route path="/schedule/list" element={<ProtectedRoute><AppShell><ScheduleList /></AppShell></ProtectedRoute>} />
      <Route path="/schedule/create" element={<ProtectedRoute><AppShell><CreateSchedule /></AppShell></ProtectedRoute>} />
      <Route path="/schedule/:id/results" element={<ProtectedRoute><AppShell><PostResults /></AppShell></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
