import { Users } from 'lucide-react'

export default function FacebookPageItem({ page, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1877F220', overflow: 'hidden', flexShrink: 0 }}>
        {page.page_avatar ? (
          <img src={page.page_avatar} alt={page.page_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔵</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{page.page_name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{page.page_category}</span>
          {page.fan_count > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Users size={10} /> {page.fan_count?.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className={`toggle ${selected ? 'active' : ''}`} onClick={() => onToggle(page.page_id)} />
    </div>
  )
}
