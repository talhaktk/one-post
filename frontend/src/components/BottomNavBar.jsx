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
    const fetchCount = () => {
      supabase.from('breaking_alerts').select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count, error }) => { if (!error) setUnreadAlerts(count || 0) })
    }
    fetchCount()

    const channel = supabase.channel('alerts-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaking_alerts' }, fetchCount)
      .subscribe(status => { if (status === 'CHANNEL_ERROR') supabase.removeChannel(channel) })

    return () => supabase.removeChannel(channel)
  }, [user])

  const tabs = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/upload', icon: Plus, label: 'Post' },
    { to: '/alerts', icon: Bell, label: 'Alerts', badge: unreadAlerts },
    { to: '/schedule', icon: Calendar, label: 'Schedule' },
    { to: '/settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'var(--nav-bg)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      backdropFilter: 'blur(20px) saturate(140%)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100
    }}>
      {tabs.map(({ to, icon: Icon, label, badge }) => {
        const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
        return (
          <NavLink
            key={to}
            to={to}
            style={{
              flex: 1, minHeight: 60,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '8px 4px', textDecoration: 'none', position: 'relative'
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 3, borderRadius: '0 0 4px 4px',
                background: 'var(--accent)'
              }} />
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={active ? 'var(--accent)' : 'var(--text-tertiary)'} strokeWidth={active ? 2.4 : 1.8} />
              {badge > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -10,
                  background: 'var(--danger)', color: 'white', borderRadius: 999,
                  fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px', lineHeight: 1,
                  border: '2px solid var(--bg-base)'
                }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </div>
            <span style={{
              fontSize: 10.5, letterSpacing: 0.02,
              color: active ? 'var(--accent)' : 'var(--text-tertiary)',
              fontWeight: active ? 600 : 500
            }}>
              {label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
