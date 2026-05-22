import { CheckCircle, XCircle, Link } from 'lucide-react'

const PLATFORM_COLORS = {
  youtube: '#FF0000', instagram: '#E1306C', facebook: '#1877F2',
  tiktok: '#69C9D0', twitter: '#FFFFFF'
}

const PLATFORM_ICONS = {
  youtube: '▶️', instagram: '📸', facebook: '🔵', tiktok: '🎵', twitter: '✖️'
}

export default function PlatformCard({ platform, account, onConnect, onDisconnect, loading }) {
  const color = PLATFORM_COLORS[platform] || '#7c3aed'
  const connected = !!account?.is_active

  return (
    <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {PLATFORM_ICONS[platform]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize', marginBottom: 2 }}>{platform}</div>
          {connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {account.platform_avatar && (
                <img src={account.platform_avatar} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />
              )}
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>@{account.platform_username || 'Connected'}</span>
              <CheckCircle size={14} color="#22c55e" />
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Not connected</span>
          )}
        </div>
        <button
          onClick={connected ? onDisconnect : onConnect}
          disabled={loading}
          style={{
            background: connected ? 'rgba(239,68,68,0.1)' : `${color}20`,
            border: `1px solid ${connected ? 'rgba(239,68,68,0.3)' : `${color}40`}`,
            color: connected ? '#f87171' : color,
            borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
          }}
        >
          {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : connected ? <><XCircle size={14} /> Disconnect</> : <><Link size={14} /> Connect</>}
        </button>
      </div>
    </div>
  )
}
