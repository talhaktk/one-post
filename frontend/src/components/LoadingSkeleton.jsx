export default function LoadingSkeleton({ type = 'card', count = 3 }) {
  if (type === 'page') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: 200 }}>
      <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12 }} />
      <div className="skeleton" style={{ width: 140, height: 14 }} />
    </div>
  )

  if (type === 'list') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton" style={{ width: '60%', height: 14 }} />
            <div className="skeleton" style={{ width: '40%', height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  )

  if (type === 'stat') return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 76, borderRadius: 14 }} />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 76, borderRadius: 14 }} />
      ))}
    </div>
  )
}
