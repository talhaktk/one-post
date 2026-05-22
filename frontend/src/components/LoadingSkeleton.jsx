export default function LoadingSkeleton({ type = 'card', count = 3 }) {
  const pulse = { animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite', background: 'rgba(255,255,255,0.06)', borderRadius: 8 }

  if (type === 'page') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: 200 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', ...pulse }} />
      <div style={{ width: 120, height: 16, ...pulse }} />
    </div>
  )

  if (type === 'list') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', ...pulse }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: '60%', height: 14, ...pulse }} />
            <div style={{ width: '40%', height: 11, ...pulse }} />
          </div>
        </div>
      ))}
    </div>
  )

  if (type === 'stat') return (
    <div style={{ display: 'flex', gap: 10 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 70, borderRadius: 12, ...pulse }} />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 12, ...pulse }} />
      ))}
    </div>
  )
}
