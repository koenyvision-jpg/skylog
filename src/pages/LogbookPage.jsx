import { useState, useEffect, useRef, useCallback } from 'react'
import { getJumps, getAllJumpsForStats, getGearItems, getGearSwaps, getJumpsOnGearItem, updateJump, deleteJump } from '../lib/db'
import StatsBar from '../components/StatsBar'

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function JumpRow({ jump, onUpdateNote, onDelete, altitudeUnit, selectMode, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSaveNote = async (jumpNum) => {
    const updated = { ...(jump.per_jump_notes || {}), [jumpNum]: noteText }
    await updateJump(jump.id, { per_jump_notes: updated })
    onUpdateNote(jump.id, updated)
    setEditingNote(null)
  }

  const subJumps = []
  for (let i = jump.jump_number_start; i <= jump.jump_number_end; i++) {
    subJumps.push(i)
  }

  const handleRowClick = () => {
    if (selectMode) {
      onToggleSelect(jump.id)
    } else {
      setExpanded(e => !e)
    }
  }

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: selected ? 'rgba(255,69,58,0.06)' : 'transparent',
      borderRadius: selected ? 8 : 0,
      transition: 'background 150ms',
    }}>
      <button
        type="button"
        onClick={handleRowClick}
        style={{
          display: 'flex', alignItems: 'center', width: '100%',
          padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer',
          gap: 12, textAlign: 'left',
        }}
      >
        {selectMode && (
          <div style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${selected ? 'var(--danger)' : 'rgba(255,255,255,0.2)'}`,
            background: selected ? 'var(--danger)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 150ms',
          }}>
            {selected && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
          </div>
        )}
        <div style={{ flex: '0 0 80px', fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
          #{jump.jump_number_start}{jump.number_of_jumps > 1 ? `–${jump.jump_number_end}` : ''}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {jump.location || 'Unknown location'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {formatDate(jump.date)} · {jump.jump_type || '—'}
          </div>
        </div>
        {!selectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {jump.number_of_jumps > 1 && (
              <span className="badge badge-accent" style={{ fontSize: 11 }}>×{jump.number_of_jumps}</span>
            )}
            <span style={{ color: 'var(--text-tertiary)', fontSize: 18, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}>›</span>
          </div>
        )}
      </button>

      {!selectMode && expanded && (
        <div style={{ paddingBottom: 12, paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {jump.notes && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0 8px', fontStyle: 'italic' }}>
              {jump.notes}
            </p>
          )}
          {subJumps.map(num => {
            const note = jump.per_jump_notes?.[num] || ''
            const isEditing = editingNote === num
            return (
              <div key={num} style={{ padding: '10px 12px', background: 'var(--input-bg)', borderRadius: 10, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 50 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>#{num}</span>
                    {jump.altitude && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 6 }}>
                        {jump.altitude.toLocaleString()}ft
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                      <input
                        autoFocus
                        className="input-field"
                        style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(num); if (e.key === 'Escape') setEditingNote(null) }}
                        placeholder="Note for this jump..."
                      />
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleSaveNote(num)}>Save</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingNote(num); setNoteText(note) }}
                      style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: note ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 13 }}
                    >
                      {note || 'Tap to add note...'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Delete entry */}
          <div style={{ marginTop: 6 }}>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--danger)', padding: '4px 0', opacity: 0.7 }}
              >
                🗑 Delete this entry
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>Delete #{jump.jump_number_start}{jump.number_of_jumps > 1 ? `–${jump.jump_number_end}` : ''}?</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-secondary btn-danger"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true)
                    await onDelete(jump.id)
                    setDeleting(false)
                  }}
                >
                  {deleting ? '...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LogbookPage({ settings }) {
  const [jumps, setJumps] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState([])
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', jumpType: '', location: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const sentinelRef = useRef(null)
  const observerRef = useRef(null)

  const loadStats = useCallback(async () => {
    try {
      const [allJumps, gear, swaps] = await Promise.all([
        getAllJumpsForStats(),
        getGearItems(),
        getGearSwaps(),
      ])
      const seasonMonth = settings?.season_start_month ?? 1
      const now = new Date()
      const seasonStart = new Date(now.getFullYear(), seasonMonth - 1, 1)
      if (seasonStart > now) seasonStart.setFullYear(seasonStart.getFullYear() - 1)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000)

      const thisSeason = allJumps.filter(j => new Date(j.date) >= seasonStart).reduce((s, j) => s + j.number_of_jumps, 0)
      const last90 = allJumps.filter(j => new Date(j.date) >= ninetyDaysAgo).reduce((s, j) => s + j.number_of_jumps, 0)

      const activeCanopy = gear.find(g => g.category === 'main_canopy' && g.is_active)
      const activeLineset = gear.find(g => g.category === 'lineset' && g.is_active)
      const canopyJumps = activeCanopy ? await getJumpsOnGearItem(activeCanopy.id, allJumps, swaps) : 0
      const linesetJumps = activeLineset ? await getJumpsOnGearItem(activeLineset.id, allJumps, swaps) : 0

      setStats([
        { label: 'This Season', value: thisSeason },
        { label: 'Last 90 Days', value: last90 },
        { label: 'On Current Canopy', value: canopyJumps },
        { label: 'On Current Lineset', value: linesetJumps },
      ])
    } catch { /* ignore */ }
  }, [settings])

  const loadJumps = useCallback(async (pageNum, reset = false) => {
    setLoading(true)
    try {
      const data = await getJumps({ page: pageNum, limit: 50, filters })
      if (reset) {
        setJumps(data)
      } else {
        setJumps(prev => [...prev, ...data])
      }
      setHasMore(data.length === 50)
    } catch { /* ignore */ }
    setLoading(false)
  }, [filters])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { setPage(0); loadJumps(0, true) }, [filters, loadJumps])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) {
        const next = page + 1
        setPage(next)
        loadJumps(next)
      }
    }, { threshold: 0.1 })
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loading, page, loadJumps])

  const handleUpdateNote = (jumpId, perJumpNotes) => {
    setJumps(prev => prev.map(j => j.id === jumpId ? { ...j, per_jump_notes: perJumpNotes } : j))
  }

  const handleDeleteSingle = async (jumpId) => {
    try {
      await deleteJump(jumpId)
      setJumps(prev => prev.filter(j => j.id !== jumpId))
      loadStats()
    } catch { /* ignore */ }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      await Promise.all([...selectedIds].map(id => deleteJump(id)))
      setJumps(prev => prev.filter(j => !selectedIds.has(j.id)))
      setSelectedIds(new Set())
      setSelectMode(false)
      loadStats()
    } catch { /* ignore */ }
    setDeleting(false)
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  return (
    <div className="page" style={{ gap: 0 }}>
      <div style={{ padding: '16px var(--page-px) 0', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h1 className="page-title">Logbook</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {!selectMode ? (
              <>
                <button
                  className="btn-icon"
                  onClick={() => setShowFilters(f => !f)}
                  style={{ background: showFilters ? 'var(--accent-subtle)' : 'var(--input-bg)', color: showFilters ? 'var(--accent)' : 'var(--text-secondary)' }}
                >
                  ⚡
                </button>
                <button
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: 13 }}
                  onClick={() => setSelectMode(true)}
                >
                  Select
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: 13 }}
                  onClick={exitSelectMode}
                >
                  Cancel
                </button>
                <button
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: 13 }}
                  onClick={() => {
                    if (selectedIds.size === jumps.length) {
                      setSelectedIds(new Set())
                    } else {
                      setSelectedIds(new Set(jumps.map(j => j.id)))
                    }
                  }}
                >
                  {selectedIds.size === jumps.length && jumps.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  className="btn-secondary btn-danger"
                  style={{
                    padding: '8px 14px', fontSize: 13,
                    opacity: selectedIds.size === 0 ? 0.4 : 1,
                  }}
                  disabled={selectedIds.size === 0 || deleting}
                  onClick={handleDeleteSelected}
                >
                  {deleting ? '...' : `Delete (${selectedIds.size})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <StatsBar stats={stats} />

      {showFilters && !selectMode && (
        <div className="card" style={{ margin: '12px var(--page-px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-field" type="date" style={{ flex: 1 }} value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} placeholder="From" />
            <input className="input-field" type="date" style={{ flex: 1 }} value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} placeholder="To" />
          </div>
          <input className="input-field" placeholder="Filter by location..." value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} />
          <input className="input-field" placeholder="Filter by jump type..." value={filters.jumpType} onChange={e => setFilters(f => ({ ...f, jumpType: e.target.value }))} />
          <button className="btn-secondary" onClick={() => setFilters({ dateFrom: '', dateTo: '', jumpType: '', location: '' })}>Clear Filters</button>
        </div>
      )}

      {selectMode && selectedIds.size === 0 && (
        <p style={{ padding: '0 var(--page-px)', fontSize: 13, color: 'var(--text-secondary)' }}>
          Tap entries to select them for deletion.
        </p>
      )}

      <div className="card" style={{ margin: '12px var(--page-px)' }}>
        {jumps.length === 0 && !loading ? (
          <div className="empty-state">
            <span className="empty-state-icon">📖</span>
            <div className="empty-state-title">No jumps logged yet</div>
            <div className="empty-state-body">Head to the Log tab to record your first jump.</div>
          </div>
        ) : (
          jumps.map(jump => (
            <JumpRow
              key={jump.id}
              jump={jump}
              onUpdateNote={handleUpdateNote}
              onDelete={handleDeleteSingle}
              selectMode={selectMode}
              selected={selectedIds.has(jump.id)}
              onToggleSelect={toggleSelect}
            />
          ))
        )}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <div className="spinner" />
          </div>
        )}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}
