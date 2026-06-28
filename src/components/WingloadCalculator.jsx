import { useState, useEffect } from 'react'

const SEGMENTS = [
  { max: 1.0, label: '< 1.0', color: 'var(--success)', bg: 'rgba(48,209,88,0.15)' },
  { max: 1.3, label: '1.0–1.3', color: '#FFD60A', bg: 'rgba(255,214,10,0.15)' },
  { max: 1.6, label: '1.3–1.6', color: 'var(--warning)', bg: 'rgba(255,159,10,0.15)' },
  { max: Infinity, label: '> 1.6', color: 'var(--danger)', bg: 'rgba(255,69,58,0.15)' },
]

function getSegment(wl) {
  for (const seg of SEGMENTS) {
    if (wl < seg.max) return seg
  }
  return SEGMENTS[SEGMENTS.length - 1]
}

export default function WingloadCalculator({ activeCanopy }) {
  const [size, setSize] = useState(activeCanopy?.data?.size_sqft || '')
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState('kg')

  useEffect(() => {
    if (activeCanopy?.data?.size_sqft) setSize(activeCanopy.data.size_sqft)
  }, [activeCanopy])

  const weightLbs = unit === 'kg' ? Number(weight) * 2.205 : Number(weight)
  const wingload = size && weight ? +(weightLbs / Number(size)).toFixed(2) : null
  const segment = wingload !== null ? getSegment(wingload) : null

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3>Wingload Calculator</h3>

      <div style={{ display: 'flex', gap: 10 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="input-label">Canopy Size (sqft)</label>
          <input
            type="number"
            className="input-field"
            placeholder="e.g. 188"
            value={size}
            onChange={e => setSize(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="input-label">Weight ({unit})</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              className="input-field"
              placeholder={unit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
              value={weight}
              onChange={e => setWeight(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '0 12px', flexShrink: 0, fontSize: 13 }}
              onClick={() => setUnit(u => u === 'kg' ? 'lbs' : 'kg')}
            >
              {unit === 'kg' ? 'kg' : 'lbs'}
            </button>
          </div>
        </div>
      </div>

      {wingload !== null && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1, color: segment.color }}>
            {wingload}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>lbs/sqft</div>

          {/* Segmented bar */}
          <div style={{ display: 'flex', gap: 4, height: 10, borderRadius: 5, overflow: 'hidden' }}>
            {SEGMENTS.map(seg => (
              <div
                key={seg.label}
                style={{
                  flex: 1, height: '100%',
                  background: segment === seg ? seg.color : seg.bg,
                  borderRadius: 3,
                  transition: 'background 300ms',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {SEGMENTS.map(seg => (
              <span key={seg.label} style={{ fontSize: 10, color: segment === seg ? seg.color : 'var(--text-tertiary)', fontWeight: segment === seg ? 600 : 400 }}>
                {seg.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {!wingload && size && weight && (
        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Enter valid values to calculate</p>
      )}
    </div>
  )
}
