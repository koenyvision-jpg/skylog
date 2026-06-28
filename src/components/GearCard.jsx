import { calcDepreciation, depreciationColor } from '../lib/depreciation'

export default function GearCard({ item, jumpsOnItem = 0, onTap, isActive }) {
  const { rate, currentValue } = calcDepreciation(item, jumpsOnItem)
  const colorKey = depreciationColor(rate)
  const pct = Math.round(rate * 100)
  const currency = item.currency || 'EUR'

  const label = item.label || [item.data?.brand, item.data?.model].filter(Boolean).join(' ') || 'Unnamed'
  const subLabel = [item.data?.size_sqft ? `${item.data.size_sqft} sqft` : null, item.data?.serial ? `S/N: ${item.data.serial}` : null].filter(Boolean).join(' · ')

  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        border: isActive ? '1px solid rgba(0,122,255,0.4)' : 'var(--card-border)',
        opacity: item.retired_date ? 0.6 : 1,
        animation: 'fade-up 300ms ease both',
      }}
      onClick={onTap}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {isActive && (
              <span className="badge badge-accent" style={{ fontSize: 10, padding: '2px 8px' }}>ACTIVE</span>
            )}
            {item.retired_date && (
              <span className="badge" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--input-bg)', color: 'var(--text-secondary)' }}>RETIRED</span>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
          {subLabel && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subLabel}</div>}
        </div>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>›</span>
      </div>

      {/* Purchase info */}
      {item.purchase_date && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
          Bought {new Date(item.purchase_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          {item.purchase_price ? ` · ${currency}${Math.round(item.purchase_price).toLocaleString()}` : ''}
          {item.purchase_price && currentValue > 0 ? ` → ~${currency}${Math.round(currentValue).toLocaleString()}` : ''}
        </div>
      )}

      {/* Depreciation bar */}
      {item.purchase_price > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pct}% depreciated</span>
            {item.lifespan_jumps && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>~{Math.max(0, item.lifespan_jumps - jumpsOnItem)} jumps remaining</span>}
          </div>
          <div className="progress-bar-track">
            <div
              className={`progress-bar-fill progress-fill-${colorKey}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {item.retired_date && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
          Retired {new Date(item.retired_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          {item.sale_price ? ` · Sold for ${currency}${Math.round(item.sale_price).toLocaleString()}` : ''}
        </div>
      )}
    </div>
  )
}
