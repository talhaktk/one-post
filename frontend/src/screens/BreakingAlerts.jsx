import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, RefreshCw } from 'lucide-react'
import { getBreakingAlerts } from '../lib/api'
import { dismissAlert } from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'
import toast from 'react-hot-toast'

const PRIORITY_CONFIG = {
  urgent: { label: '🔴 URGENT', borderColor: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.06)' },
  breaking: { label: '🟠 BREAKING', borderColor: 'rgba(249,115,22,0.4)', bg: 'rgba(249,115,22,0.06)' },
  important: { label: '🟡 IMPORTANT', borderColor: 'rgba(234,179,8,0.4)', bg: 'rgba(234,179,8,0.06)' },
  normal: { label: '🟢 NORMAL', borderColor: 'rgba(34,197,94,0.3)', bg: 'rgba(34,197,94,0.04)' }
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function BreakingAlerts() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const sseRef = useRef(null)

  useEffect(() => {
    loadAlerts()
    connectSSE()
    return () => { if (sseRef.current) sseRef.current.close() }
  }, [filter])

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? (filter === 'posted' || filter === 'dismissed' ? { status: filter } : { priority: filter }) : {}
      const data = await getBreakingAlerts(params)
      setAlerts(data.alerts || [])
    } catch { toast.error('Failed to load alerts') }
    finally { setLoading(false) }
  }

  const connectSSE = () => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api'
    const es = new EventSource(`${API_BASE}/news/alerts/live`)
    sseRef.current = es
    es.onmessage = (e) => {
      try {
        const alert = JSON.parse(e.data)
        setAlerts(prev => [alert, ...prev.filter(a => a.id !== alert.id)])
        if (alert.priority === 'urgent' || alert.priority === 'breaking') {
          toast(`🚨 ${alert.priority.toUpperCase()}: ${alert.headline.slice(0, 80)}...`, { duration: 6000, icon: '🔴' })
        }
      } catch {}
    }
    es.onerror = () => es.close()
  }

  const handleDismiss = async (id, e) => {
    e.stopPropagation()
    await dismissAlert(id)
    setAlerts(prev => prev.filter(a => a.id !== id))
    toast.success('Alert dismissed')
  }

  const FILTERS = ['all', 'urgent', 'breaking', 'important', 'posted', 'dismissed']

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>🚨 Breaking News</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>LIVE</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Monitoring 8 Pakistan news sources</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadAlerts} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}><RefreshCw size={18} /></button>
          <button onClick={() => navigate('/news-settings')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}><Settings size={20} /></button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', background: filter === f ? '#7c3aed' : 'rgba(255,255,255,0.08)', color: filter === f ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton count={4} /> : alerts.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>No alerts yet. RSS monitor is active.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map(alert => {
            const pConfig = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.normal
            return (
              <div key={alert.id} style={{ background: pConfig.bg, border: `1px solid ${pConfig.borderColor}`, borderRadius: 16, padding: '16px', cursor: 'pointer' }} onClick={() => navigate(`/alerts/${alert.id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className={`badge badge-${alert.priority}`}>{pConfig.label}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{alert.source_name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{timeAgo(alert.detected_at)}</span>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.4, marginBottom: 10 }}>{alert.headline}</div>

                {alert.thumbnail_url && (
                  <img src={alert.thumbnail_url} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 10, maxHeight: 160, objectFit: 'cover' }} />
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={e => { e.stopPropagation(); navigate(`/alerts/${alert.id}`) }} style={{ flex: 1, padding: '8px 12px', background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✏️ Edit & Post</button>
                  <button onClick={e => { e.stopPropagation(); navigate(`/alerts/${alert.id}`) }} style={{ flex: 1, padding: '8px 12px', background: 'rgba(124,58,237,0.8)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🚀 Post Now</button>
                  {alert.status === 'pending' && (
                    <button onClick={e => handleDismiss(alert.id, e)} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
