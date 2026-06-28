import { useState, useEffect, useRef } from 'react'
import { getTemplates, addTemplate } from '../lib/db'

export default function SearchableDropdown({ category, value, onChange, placeholder, allowClear = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState([])
  const [adding, setAdding] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      getTemplates(category).then(setOptions).catch(() => {})
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, category])

  const filtered = options.filter(o => o.value.toLowerCase().includes(query.toLowerCase()))

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  const handleAddNew = async () => {
    if (!query.trim()) return
    setAdding(true)
    try {
      const newItem = await addTemplate(category, query.trim())
      setOptions(prev => [...prev, newItem].sort((a, b) => a.value.localeCompare(b.value)))
      handleSelect(query.trim())
    } catch {
      handleSelect(query.trim())
    }
    setAdding(false)
  }

  const showAddNew = query.trim() && !options.some(o => o.value.toLowerCase() === query.trim().toLowerCase())

  return (
    <>
      <button
        type="button"
        className="input-field"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
          color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
        }}
        onClick={() => setOpen(true)}
      >
        <span>{value || placeholder}</span>
        <span style={{ color: 'var(--text-tertiary)', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          {allowClear && value && (
            <span
              onClick={e => { e.stopPropagation(); onChange('') }}
              style={{ fontSize: 16, lineHeight: 1 }}
            >✕</span>
          )}
          <span>›</span>
        </span>
      </button>

      {open && (
        <div className="sheet-overlay" onClick={() => { setOpen(false); setQuery('') }}>
          <div className="sheet-panel" style={{ maxHeight: '70svh' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ padding: '16px 20px 8px' }}>
              <input
                ref={inputRef}
                className="input-field"
                placeholder={`Search ${placeholder || category}...`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && showAddNew) handleAddNew() }}
              />
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(70svh - 120px)' }}>
              {filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '14px 20px',
                    background: value === opt.value ? 'var(--accent-subtle)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: value === opt.value ? 'var(--accent)' : 'var(--text-primary)',
                    fontSize: 16,
                    cursor: 'pointer',
                    textAlign: 'left',
                    justifyContent: 'space-between',
                  }}
                >
                  {opt.value}
                  {value === opt.value && <span>✓</span>}
                </button>
              ))}
              {filtered.length === 0 && !showAddNew && (
                <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                  No options yet. Type to add one.
                </p>
              )}
              {showAddNew && (
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={adding}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '14px 20px',
                    background: 'var(--accent-subtle)',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 15, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 20 }}>+</span> Add "{query.trim()}"
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
