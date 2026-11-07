import { useState, useRef, useMemo } from 'react'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const SWIPE_MIN_PX = 50

function pad(n) {
  return String(n).padStart(2, '0')
}

function isoDate(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function todayIso() {
  const d = new Date()
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate())
}

// Rows of 7 day numbers (Monday first); null for cells outside the month.
function buildWeeks(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export default function MonthCalendar({ jumps, onSelectDay }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [slideFrom, setSlideFrom] = useState(null)
  const touchStart = useRef(null)

  const jumpsByDate = useMemo(() => {
    const map = {}
    for (const j of jumps) map[j.date] = (map[j.date] || 0) + (j.number_of_jumps || 0)
    return map
  }, [jumps])

  const { year, month } = cursor
  const weeks = buildWeeks(year, month)
  const countFor = (day) => (day ? jumpsByDate[isoDate(year, month, day)] || 0 : 0)
  const monthTotal = weeks.flat().reduce((s, day) => s + countFor(day), 0)
  const maxDay = Math.max(1, ...weeks.flat().map(countFor))
  const today = todayIso()

  const shiftMonth = (delta) => {
    setSlideFrom(delta > 0 ? 'right' : 'left')
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const handleTouchStart = (e) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      shiftMonth(dx < 0 ? 1 : -1)
    }
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ touchAction: 'pan-y' }}>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <button type="button" className="btn-icon" onClick={() => shiftMonth(-1)} aria-label="Previous month"
          style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)', fontSize: 20 }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{monthLabel}</div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
            {monthTotal} jump{monthTotal === 1 ? '' : 's'} this month
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={() => shiftMonth(1)} aria-label="Next month"
          style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)', fontSize: 20 }}>›</button>
      </div>

      <div
        key={`${year}-${month}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr) 40px',
          gap: 5,
          animation: slideFrom ? `cal-slide-${slideFrom} 220ms ease both` : undefined,
        }}
      >
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{d}</div>
        ))}
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>Wk</div>

        {weeks.map((week, wi) => {
          const weekTotal = week.reduce((s, day) => s + countFor(day), 0)
          return [
            ...week.map((day, di) => {
              if (!day) return <div key={`${wi}-${di}`} />
              const iso = isoDate(year, month, day)
              const count = countFor(day)
              const intensity = count ? 0.25 + 0.6 * (count / maxDay) : 0
              return (
                <button
                  key={`${wi}-${di}`}
                  type="button"
                  disabled={!count}
                  onClick={() => onSelectDay?.(iso)}
                  aria-label={`${iso}: ${count} jump${count === 1 ? '' : 's'}`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 8,
                    border: iso === today ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                    background: count ? `rgba(0,122,255,${intensity})` : 'var(--input-bg)',
                    cursor: count ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 0, lineHeight: 1, gap: 2,
                  }}
                >
                  <span style={{ fontSize: 9, color: count ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>
                    {day}
                  </span>
                  {count > 0 && (
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{count}</span>
                  )}
                </button>
              )
            }),
            <div
              key={`${wi}-total`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600,
                color: weekTotal ? 'var(--text-primary)' : 'var(--text-tertiary)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {weekTotal}
            </div>,
          ]
        })}
      </div>
    </div>
  )
}
