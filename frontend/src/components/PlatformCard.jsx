import { CheckCircle, XCircle, Link } from 'lucide-react'

const PLATFORM_COLORS = {
  youtube: '#FF0000', instagram: '#E1306C', facebook: '#1877F2',
  tiktok: '#69C9D0', twitter: '#FFFFFF'
}

const PLATFORM_LETTERS = {
  youtube: 'YT', instagram: 'IG', facebook: 'f', tiktok: 'TT', twitter: '𝕏'
}

export default function PlatformCard({ platform, account, onConnect, onDisconnect, loading }) {
  const color = PLATFORM_COLORS[platform] || '#7c3aed'
  const connected = !!account?.is_active

  return (
    <div className="card" style={{ padding: 14, marginBottom: 10 }}>
      <div className="row" style={{ gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${color}22`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0
        }}>
          {PLATFORM_LETTERS[platform] || '·'}
        </div>

        <div className="grow" style={{ flex: 1, minWidth: 0 }}>
          <div className="t-h3" style={{ textTransform: 'capitalize', marginBottom: 2 }}>{platform}</div>
          {connected ? (
            <div className="row" style={{ gap: 6, minWidth: 0 }}>
              {account.platform_avatar && (
                <img src={account.platform_avatar} alt="" style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0 }} />
              )}
              <span className="t-body-sm truncate-1">@{account.platform_username || 'Connected'}</span>
              <CheckCircle size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
            </div>
          ) : (
            <span className="t-body-sm t-muted">Not connected</span>
          )}
        </div>

        <button
          onClick={connected ? onDisconnect : onConnect}
          disabled={loading}
          className={connected ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}
          style={{
            width: 'auto', padding: '0 14px', flexShrink: 0,
            ...(connected ? {} : { borderColor: `${color}55`, color, background: `${color}11` })
          }}
        >
          {loading ? <div className="spinner" style={{ width: 14, height: 14 }} />
            : connected ? <><XCircle size={13} /> Disconnect</>
            : <><Link size={13} /> Connect</>}
        </button>
      </div>
    </div>
  )
}
