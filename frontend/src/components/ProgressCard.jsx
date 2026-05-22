import { CheckCircle, XCircle, Loader, Clock } from 'lucide-react'

const PLATFORM_COLORS = {
  youtube: '#FF0000', instagram: '#E1306C', instagram_reels: '#E1306C',
  instagram_feed: '#833AB4', facebook: '#1877F2', tiktok: '#69C9D0', twitter: '#FFFFFF'
}

const PLATFORM_ICONS = {
  youtube: '▶️', instagram: '📸', instagram_reels: '🎬', instagram_feed: '📸',
  facebook: '🔵', tiktok: '🎵', twitter: '✖️'
}

const STATUS_ICONS = {
  queued: <Clock size={16} color="rgba(255,255,255,0.4)" />,
  uploading: <Loader size={16} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />,
  processing: <Loader size={16} color="#f59e0b" style={{ animation: 'spin 1s linear infinite' }} />,
  published: <CheckCircle size={16} color="#22c55e" />,
  failed: <XCircle size={16} color="#ef4444" />,
  waiting: <Clock size={16} color="#f59e0b" />
}

export default function ProgressCard({ target }) {
  const { platform, target_name, status, progress = 0, error_message, countdown, post_url } = target
  const color = PLATFORM_COLORS[platform] || '#7c3aed'
  const icon = PLATFORM_ICONS[platform] || '🔗'

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {target_name || platform}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{platform}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {STATUS_ICONS[status] || STATUS_ICONS.queued}
          {status === 'uploading' || status === 'processing' ? (
            <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>{progress}%</span>
          ) : null}
        </div>
      </div>

      {(status === 'uploading' || status === 'processing') && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {status === 'waiting' && countdown > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, height: 4, background: 'rgba(245,158,11,0.2)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#f59e0b', borderRadius: 999, width: `${(countdown / 30) * 100}%`, transition: 'width 1s linear' }} />
          </div>
          <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>⏳ {countdown}s</span>
        </div>
      )}

      {status === 'published' && post_url && (
        <a href={post_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', textDecoration: 'none', display: 'block', marginTop: 4 }}>
          View post →
        </a>
      )}

      {status === 'failed' && error_message && (
        <div style={{ fontSize: 11, color: '#f87171', marginTop: 4, background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 8 }}>
          {error_message}
        </div>
      )}
    </div>
  )
}
