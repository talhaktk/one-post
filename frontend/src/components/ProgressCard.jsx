import { CheckCircle, XCircle, Loader, Clock, ExternalLink } from 'lucide-react'
import PlatformIcon, { PLATFORM_BRAND_COLOR } from './PlatformIcon'

const StatusIcon = ({ status }) => {
  if (status === 'published') return <CheckCircle size={16} style={{ color: 'var(--success)' }} />
  if (status === 'failed')    return <XCircle size={16} style={{ color: 'var(--danger)' }} />
  if (status === 'uploading' || status === 'processing')
    return <Loader size={16} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
  if (status === 'waiting')   return <Clock size={16} style={{ color: 'var(--warning)' }} />
  return <Clock size={16} style={{ color: 'var(--text-tertiary)' }} />
}

const STATUS_LABEL = {
  queued: 'Waiting',
  uploading: 'Uploading',
  processing: 'Processing',
  published: 'Published',
  failed: 'Failed',
  waiting: 'Waiting'
}

const STATUS_COLOR = {
  queued: 'var(--text-tertiary)',
  uploading: 'var(--accent)',
  processing: 'var(--accent)',
  published: 'var(--success)',
  failed: 'var(--danger)',
  waiting: 'var(--warning)'
}

export default function ProgressCard({ target }) {
  const { platform, target_name, status, progress = 0, error_message, countdown, post_url } = target
  const color = PLATFORM_BRAND_COLOR[platform] || '#f97316'
  const isActive = status === 'uploading' || status === 'processing'

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: 4, background: color
      }} />

      <div style={{ padding: '14px 16px 14px 18px' }}>
        <div className="row" style={{ gap: 10, marginBottom: (isActive || status === 'waiting') ? 10 : 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `${color}1f`, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <PlatformIcon platform={platform} size={16} />
          </div>

          <div className="grow" style={{ flex: 1, minWidth: 0 }}>
            <div className="t-h3 truncate-1">{target_name || platform}</div>
            <div className="t-caption" style={{ textTransform: 'capitalize' }}>{platform.replace(/_/g, ' ')}</div>
          </div>

          <div className="row" style={{ gap: 8, flexShrink: 0 }}>
            <StatusIcon status={status} />
            {isActive ? (
              <span className="t-mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{progress}%</span>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[status] || 'var(--text-tertiary)' }}>
                {STATUS_LABEL[status] || status}
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <div className="progress-bar" style={{ height: 6 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {status === 'waiting' && countdown > 0 && (
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'rgba(245,158,11,0.18)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--warning)', borderRadius: 999,
                width: `${Math.min(100, (countdown / 30) * 100)}%`,
                transition: 'width 1s linear'
              }} />
            </div>
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>{countdown}s</span>
          </div>
        )}

        {status === 'published' && post_url && (
          <a
            href={post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="row"
            style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', gap: 4 }}
          >
            View post <ExternalLink size={11} />
          </a>
        )}

        {status === 'failed' && error_message && (
          <div style={{
            marginTop: 10, padding: '8px 10px',
            background: 'var(--danger-soft)', color: 'var(--danger)',
            borderRadius: 8, fontSize: 12, lineHeight: 1.5
          }}>{error_message}</div>
        )}
      </div>
    </div>
  )
}
