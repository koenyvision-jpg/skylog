export default function ConfirmSheet({ title, message, confirmLabel = 'Confirm', confirmDanger = false, onConfirm, onCancel, children }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet-panel" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">{title}</span>
          <button className="btn-icon" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20 }}>✕</button>
        </div>
        <div className="sheet-content">
          {message && <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>}
          {children}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
            <button
              className={`btn-secondary ${confirmDanger ? 'btn-danger' : ''}`}
              style={{ flex: 1, background: confirmDanger ? 'var(--danger-subtle)' : 'var(--accent-subtle)', color: confirmDanger ? 'var(--danger)' : 'var(--accent)', border: `1px solid ${confirmDanger ? 'rgba(255,69,58,0.3)' : 'rgba(0,122,255,0.3)'}` }}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
