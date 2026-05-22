import { Users, Trash2 } from 'lucide-react'

export default function TikTokAccountItem({ account, selected, onToggle, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#69C9D020', overflow: 'hidden', flexShrink: 0 }}>
        {account.tiktok_avatar ? (
          <img src={account.tiktok_avatar} alt={account.tiktok_username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎵</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{account.account_label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>@{account.tiktok_username}</span>
          {account.follower_count > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Users size={10} /> {account.follower_count?.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onToggle && <div className={`toggle ${selected ? 'active' : ''}`} onClick={() => onToggle(account.id)} />}
        {onRemove && (
          <button onClick={() => onRemove(account.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
