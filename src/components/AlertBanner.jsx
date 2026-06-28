export default function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null

  const critical = alerts.filter(a => a.severity === 'critical')
  const warnings = alerts.filter(a => a.severity === 'warning')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 var(--page-px)' }}>
      {critical.map(a => (
        <div key={a.id} className="badge badge-danger" style={{ borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, lineHeight: 1.4, background: 'var(--danger-subtle)', border: '1px solid rgba(255,69,58,0.25)' }}>
          🔴 {a.message}
        </div>
      ))}
      {warnings.map(a => (
        <div key={a.id} className="badge badge-warning" style={{ borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, lineHeight: 1.4, background: 'var(--warning-subtle)', border: '1px solid rgba(255,159,10,0.25)' }}>
          🟡 {a.message}
        </div>
      ))}
    </div>
  )
}
