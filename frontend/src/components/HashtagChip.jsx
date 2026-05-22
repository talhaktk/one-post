import { X, TrendingUp } from 'lucide-react'

export default function HashtagChip({ tag, onRemove, onAdd, trending, volume }) {
  if (onAdd) {
    return (
      <button onClick={() => onAdd(tag)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px',
        background: trending ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${trending ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 999, fontSize: 13, color: trending ? '#a78bfa' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500, whiteSpace: 'nowrap'
      }}>
        {trending && <TrendingUp size={11} />}
        #{tag}
        {volume && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>{formatVolume(volume)}</span>}
      </button>
    )
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px 6px 12px',
      background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
      borderRadius: 999, fontSize: 13, color: '#c4b5fd', whiteSpace: 'nowrap'
    }}>
      #{tag}
      {onRemove && (
        <button onClick={() => onRemove(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', padding: 0, lineHeight: 1, display: 'flex' }}>
          <X size={13} />
        </button>
      )}
    </span>
  )
}

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
  return v
}
