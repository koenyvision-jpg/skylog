import { useEffect, useRef, useState } from 'react'

function StatCard({ label, value, unit = '' }) {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef(null)
  const target = typeof value === 'number' ? value : 0

  useEffect(() => {
    const duration = 800
    const start = performance.now()
    const from = 0
    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(from + (target - from) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return (
    <div className="card" style={{
      minWidth: 130,
      flexShrink: 0,
      scrollSnapAlign: 'start',
      animation: 'fade-up 400ms ease both',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
        {displayed}{unit}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}

export default function StatsBar({ stats }) {
  return (
    <div style={{
      overflowX: 'auto',
      display: 'flex',
      gap: 10,
      padding: '0 var(--page-px)',
      scrollSnapType: 'x mandatory',
      WebkitOverflowScrolling: 'touch',
    }}>
      {stats.map((s, i) => (
        <StatCard key={i} label={s.label} value={s.value} unit={s.unit} />
      ))}
    </div>
  )
}
