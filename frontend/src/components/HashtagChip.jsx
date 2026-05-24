import { X, TrendingUp } from 'lucide-react'

export default function HashtagChip({ tag, onRemove, onAdd, trending, volume }) {
  if (onAdd) {
    return (
      <button
        onClick={() => onAdd(tag)}
        className="chip"
        style={{
          background: trending ? 'var(--accent-soft)' : 'var(--bg-elevated)',
          borderColor: trending ? 'var(--accent)' : 'var(--border-subtle)',
          color: trending ? 'var(--accent)' : 'var(--text-secondary)',
          minHeight: 32, padding: '6px 12px', fontSize: 13
        }}
      >
        {trending && <TrendingUp size={11} />}
        #{tag}
        {volume && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>{formatVolume(volume)}</span>
        )}
      </button>
    )
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 10px 6px 12px',
      background: 'var(--accent-soft)',
      border: '1px solid var(--accent)',
      borderRadius: 999, fontSize: 13, fontWeight: 500,
      color: 'var(--accent)', whiteSpace: 'nowrap'
    }}>
      #{tag}
      {onRemove && (
        <button
          onClick={() => onRemove(tag)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, lineHeight: 1, display: 'flex' }}
        >
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
