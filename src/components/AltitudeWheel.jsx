import { useEffect, useRef, useState } from 'react'
import { ALTITUDE_OPTIONS } from '../lib/altitude'

const ITEM_H = 32
const VISIBLE = 3

function formatAltitude(value, unit) {
  if (unit === 'm') return value.toLocaleString()
  return `${value / 1000}K`
}

// iOS-style vertical picker: scroll (or tap) to choose a value, centre row is selected.
export default function AltitudeWheel({ value, onChange, unit = 'ft' }) {
  const { min, max, step } = ALTITUDE_OPTIONS[unit] || ALTITUDE_OPTIONS.ft
  const values = []
  for (let v = min; v <= max; v += step) values.push(v)

  const listRef = useRef(null)
  const [centered, setCentered] = useState(() => Math.max(0, values.indexOf(value)))

  // Keep the wheel in sync when the value is changed from outside (e.g. reset after logging).
  useEffect(() => {
    const idx = values.indexOf(value)
    const el = listRef.current
    if (idx < 0 || !el) return
    if (Math.round(el.scrollTop / ITEM_H) !== idx) el.scrollTop = idx * ITEM_H
    setCentered(idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit])

  const handleScroll = () => {
    const el = listRef.current
    const idx = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
    if (idx !== centered) {
      setCentered(idx)
      onChange(values[idx])
    }
  }

  const scrollToIndex = (idx) => {
    listRef.current?.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
  }

  return (
    <div style={{
      position: 'relative',
      height: ITEM_H * VISIBLE,
      background: 'var(--input-bg)',
      border: '1px solid var(--input-border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      {/* Selection band */}
      <div style={{
        position: 'absolute', left: 4, right: 4, top: ITEM_H, height: ITEM_H,
        background: 'var(--accent-subtle)', borderRadius: 6, pointerEvents: 'none',
      }} />
      <div
        ref={listRef}
        onScroll={handleScroll}
        role="listbox"
        aria-label="Altitude"
        style={{
          position: 'relative',
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingBlock: ITEM_H * Math.floor(VISIBLE / 2),
          maskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
        }}
      >
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={i === centered}
            onClick={() => scrollToIndex(i)}
            style={{
              display: 'block', width: '100%', height: ITEM_H,
              scrollSnapAlign: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: i === centered ? 17 : 14,
              fontWeight: i === centered ? 600 : 400,
              color: i === centered ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'font-size 120ms, color 120ms',
            }}
          >
            {formatAltitude(v, unit)}
          </button>
        ))}
      </div>
    </div>
  )
}
