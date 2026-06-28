import { useState, useEffect, useCallback } from 'react'
import { getGearItems, getNextJumpNumber, insertJump } from '../lib/db'
import SearchableDropdown from '../components/SearchableDropdown'

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function LogPage({ settings, prefill, onPrefillConsumed }) {
  const [date, setDate] = useState(today())
  const [numJumps, setNumJumps] = useState(1)
  const [location, setLocation] = useState('')
  const [eventName, setEventName] = useState('')
  const [jumpType, setJumpType] = useState('')
  const [notes, setNotes] = useState('')
  const [altitude, setAltitude] = useState('')
  const [activeGear, setActiveGear] = useState({ main: null, lineset: null })
  const [nextNum, setNextNum] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [errors, setErrors] = useState({})

  const loadState = useCallback(async () => {
    try {
      const [gear, num] = await Promise.all([
        getGearItems(),
        getNextJumpNumber(settings?.starting_jump_number ?? 1),
      ])
      const mainCanopy = gear.find(g => g.category === 'main_canopy' && g.is_active)
      const lineset = gear.find(g => g.category === 'lineset' && g.is_active)
      setActiveGear({ main: mainCanopy, lineset })
      setNextNum(num)
    } catch { /* ignore — might be offline */ }
  }, [settings])

  useEffect(() => { loadState() }, [loadState])

  useEffect(() => {
    if (prefill) {
      if (prefill.date) setDate(prefill.date)
      if (prefill.numberOfJumps) setNumJumps(Number(prefill.numberOfJumps))
      if (prefill.location) setLocation(prefill.location)
      if (prefill.jumpType) setJumpType(prefill.jumpType)
      if (prefill.eventName) setEventName(prefill.eventName)
      if (prefill.notes) setNotes(prefill.notes)
      onPrefillConsumed?.()
    }
  }, [prefill, onPrefillConsumed])

  const jumpStart = nextNum ?? (settings?.starting_jump_number ?? 1)
  const jumpEnd = jumpStart + numJumps - 1

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const validate = () => {
    const e = {}
    if (!date) e.date = true
    if (!location) e.location = true
    if (!jumpType) e.jumpType = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { showToast('Please fill required fields'); return }
    setSaving(true)
    try {
      const gearSnapshot = {}
      if (activeGear.main) {
        gearSnapshot.mainCanopyId = activeGear.main.id
        gearSnapshot.mainCanopyLabel = activeGear.main.label || `${activeGear.main.data?.brand || ''} ${activeGear.main.data?.model || ''}`.trim()
      }
      if (activeGear.lineset) {
        gearSnapshot.linesetId = activeGear.lineset.id
        gearSnapshot.linesetLabel = activeGear.lineset.label || `Lineset`
      }

      await insertJump({
        date,
        jump_number_start: jumpStart,
        jump_number_end: jumpEnd,
        number_of_jumps: numJumps,
        location,
        event_name: eventName || null,
        jump_type: jumpType,
        notes: notes || null,
        altitude: altitude ? Number(altitude) : null,
        gear_snapshot: gearSnapshot,
        per_jump_notes: {},
      })

      showToast(`✓ Logged ${numJumps} jump${numJumps > 1 ? 's' : ''} (#${jumpStart}–#${jumpEnd})`)
      setNumJumps(1)
      setNotes('')
      setAltitude('')
      setErrors({})
      // Refresh jump number
      const newNum = await getNextJumpNumber(settings?.starting_jump_number ?? 1)
      setNextNum(newNum)
    } catch (err) {
      if (err.message === 'offline') {
        showToast('Saved locally — will sync when online')
        setNumJumps(1)
        setNotes('')
        setAltitude('')
        setErrors({})
      } else {
        showToast('Error logging jumps')
        console.error(err)
      }
    }
    setSaving(false)
  }

  const mainLabel = activeGear.main
    ? (activeGear.main.label || `${activeGear.main.data?.brand || ''} ${activeGear.main.data?.model || ''} ${activeGear.main.data?.size_sqft || ''}sqft`.trim())
    : 'No canopy set'
  const linesetLabel = activeGear.lineset
    ? (activeGear.lineset.label || 'Active Lineset')
    : 'No lineset set'

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      {toast && <div className="toast">{toast}</div>}

      <h1 className="page-title" style={{ padding: '0 var(--page-px)', marginBottom: 4 }}>Log Jumps</h1>

      {/* Jump preview */}
      {nextNum !== null && (
        <div style={{ padding: '0 var(--page-px)' }}>
          <div style={{
            background: 'var(--accent-subtle)',
            border: '1px solid rgba(0,122,255,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: 14,
            color: 'var(--accent)',
            fontWeight: 500,
          }}>
            These will be logged as jumps #{jumpStart} – #{jumpEnd}
          </div>
        </div>
      )}

      {/* Date & count row */}
      <div style={{ padding: '0 var(--page-px)', display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="input-label">Date</label>
          <input
            type="date"
            className={`input-field ${errors.date ? 'error' : ''}`}
            value={date}
            onChange={e => setDate(e.target.value)}
            style={errors.date ? { borderColor: 'var(--danger)' } : {}}
          />
        </div>
        <div className="form-group" style={{ width: 90 }}>
          <label className="input-label"># Jumps</label>
          <select
            className="input-field"
            value={numJumps}
            onChange={e => setNumJumps(Number(e.target.value))}
            style={{ appearance: 'none', textAlign: 'center' }}
          >
            {Array.from({ length: 99 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Location */}
      <div className="form-group" style={{ padding: '0 var(--page-px)' }}>
        <label className="input-label">Location *</label>
        <SearchableDropdown
          category="location"
          value={location}
          onChange={setLocation}
          placeholder="Select dropzone..."
        />
        {errors.location && <span style={{ fontSize: 12, color: 'var(--danger)' }}>Required</span>}
      </div>

      {/* Jump type */}
      <div className="form-group" style={{ padding: '0 var(--page-px)' }}>
        <label className="input-label">Jump Type *</label>
        <SearchableDropdown
          category="jump_type"
          value={jumpType}
          onChange={setJumpType}
          placeholder="Select jump type..."
        />
        {errors.jumpType && <span style={{ fontSize: 12, color: 'var(--danger)' }}>Required</span>}
      </div>

      {/* Event name (optional) */}
      <div className="form-group" style={{ padding: '0 var(--page-px)' }}>
        <label className="input-label">Event Name <span style={{ color: 'var(--text-tertiary)', textTransform: 'none', fontSize: 11 }}>(optional)</span></label>
        <SearchableDropdown
          category="event_name"
          value={eventName}
          onChange={setEventName}
          placeholder="No event"
          allowClear
        />
      </div>

      {/* Notes + Altitude row */}
      <div style={{ padding: '0 var(--page-px)', display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="input-label">Notes</label>
          <textarea
            className="input-field"
            placeholder="Any remarks for this batch..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        <div className="form-group" style={{ width: 90 }}>
          <label className="input-label">Alt ({settings?.altitude_unit || 'ft'})</label>
          <input
            type="number"
            className="input-field"
            placeholder={settings?.altitude_unit === 'm' ? '4000' : '13500'}
            value={altitude}
            onChange={e => setAltitude(e.target.value)}
            style={{ height: '100%', minHeight: 80 }}
          />
        </div>
      </div>

      {/* Active gear chips */}
      <div style={{ padding: '0 var(--page-px)' }}>
        <label className="input-label" style={{ marginBottom: 10 }}>Active Gear (at time of logging)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-pill)',
            background: activeGear.main ? 'rgba(0,122,255,0.12)' : 'var(--input-bg)',
            border: '1px solid rgba(0,122,255,0.2)',
            fontSize: 13, color: activeGear.main ? 'var(--accent)' : 'var(--text-tertiary)',
          }}>
            🪂 {mainLabel}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-pill)',
            background: activeGear.lineset ? 'rgba(48,209,88,0.12)' : 'var(--input-bg)',
            border: '1px solid rgba(48,209,88,0.2)',
            fontSize: 13, color: activeGear.lineset ? 'var(--success)' : 'var(--text-tertiary)',
          }}>
            🪢 {linesetLabel}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div style={{ padding: '8px var(--page-px) 0' }}>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={saving}
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : `Log ${numJumps} Jump${numJumps > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
