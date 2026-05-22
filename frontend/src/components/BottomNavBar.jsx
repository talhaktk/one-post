import { NavLink, useLocation } from 'react-router-dom'
import { Home, Plus, Bell, Calendar, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function BottomNavBar() {
  const location = useLocation()
  const { user } = useAuth()
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase.from('breaking_alerts').select('id', { count: 'exact' })
      .eq('status', 'pending').then(({ count }) => setUnreadAlerts(count || 0))

    const channel = supabase.channel('alerts-count').on('postgres_changes',
      { event: '*', schema: 'public', table: 'breaking_alerts' },
      () => supabase.from('breaking_alerts').select('id', { count: 'exact' }).eq('status', 'pending')
        .then(({ count }) => setUnreadAlerts(count || 0))
    ).subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  const tabs = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/upload', icon: Plus, label: 'New Post' },
    { to: '/alerts', icon: Bell, label: 'Alerts', badge: unreadAlerts },
    { to: '/schedule', icon: Calendar, label: 'Schedule' },
    { to: '/settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'rgba(7,7,26,0.95)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      zIndex: 100
    }}>
      {tabs.map(({ to, icon: Icon, label, badge }) => {
        const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
        return (
          <NavLink key={to} to={to} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 12px', textDecoration: 'none', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <Icon size={22} color={active ? '#7c3aed' : 'rgba(255,255,255,0.4)'} strokeWidth={active ? 2.5 : 1.8} />
              {badge > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -8,
                  background: '#ef4444', color: 'white', borderRadius: 999,
                  fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px'
                }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </div>
            <span style={{ fontSize: 10, color: active ? '#7c3aed' : 'rgba(255,255,255,0.4)', fontWeight: active ? 600 : 400 }}>
              {label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
