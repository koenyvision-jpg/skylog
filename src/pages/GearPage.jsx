import { useState, useEffect, useCallback } from 'react'
import { getGearItems, getAllJumpsForStats, getGearSwaps, getJumpsOnGearItem, getNextJumpNumber, setActiveRig } from '../lib/db'
import { alertsForCategory } from '../lib/alerts'
import WingloadCalculator from '../components/WingloadCalculator'
import AlertBanner from '../components/AlertBanner'

const COMPONENT_CATEGORIES = [
  { id: 'main_canopy', label: 'Main Canopy', icon: '🪂', rigKey: 'main_canopy_id' },
  { id: 'reserve',     label: 'Reserve',     icon: '🟣', rigKey: 'reserve_id' },
  { id: 'aad',         label: 'AAD',         icon: '🔴', rigKey: 'aad_id' },
]

function gearLabel(item) {
  if (!item) return null
  return item.label || [item.data?.brand, item.data?.model].filter(Boolean).join(' ') || 'Unnamed'
}

function ComponentCard({ icon, label, name, subLabel, jumps, alert, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        width: '100%', background: 'var(--card-bg)', border: 'var(--card-border)',
        borderRadius: 'var(--radius-md)', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: name ? 'var(--text-primary)' : 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name || 'Not set'}
        </div>
        {subLabel && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            🪢 {subLabel}
          </div>
        )}
        {jumps != null && name && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{jumps} jumps</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {alert && <span style={{ fontSize: 14 }}>{alert.severity === 'critical' ? '🔴' : '🟡'}</span>}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>›</span>
      </div>
    </button>
  )
}

export default function GearPage({ onOpenCloset, alerts = [], settings }) {
  const [rigs, setRigs] = useState([])
  const [allGearById, setAllGearById] = useState({})
  const [jumpsOnItems, setJumpsOnItems] = useState({})
  const [selectedRigId, setSelectedRigId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [settingActive, setSettingActive] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rigItems, allItems, jumps, swaps] = await Promise.all([
        getGearItems('rig'),
        getGearItems(),
        getAllJumpsForStats(),
        getGearSwaps(),
      ])

      const byId = {}
      for (const item of allItems) byId[item.id] = item
      setAllGearById(byId)

      const counts = {}
      for (const item of allItems) {
        if (item.is_active) counts[item.id] = await getJumpsOnGearItem(item.id, jumps, swaps)
      }
      setJumpsOnItems(counts)

      setRigs(rigItems)
      setSelectedRigId(prev => {
        const activeRig = rigItems.find(r => r.is_active)
        if (prev && rigItems.find(r => r.id === prev)) return prev
        return activeRig?.id || rigItems[0]?.id || null
      })
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const selectedRig = rigs.find(r => r.id === selectedRigId) || null
  const activeRig = rigs.find(r => r.is_active) || null

  const resolveComponent = (rigKeyOrId, category) => {
    if (!selectedRig) return null
    if (selectedRig.is_active) {
      return Object.values(allGearById).find(i => i.category === category && i.is_active) || null
    }
    const id = selectedRig.data?.[rigKeyOrId]
    return id ? allGearById[id] || null : null
  }

  const handleSetActive = async () => {
    if (!selectedRigId) return
    setSettingActive(true)
    try {
      const jumpNum = await getNextJumpNumber(settings?.starting_jump_number ?? 1)
      await setActiveRig(selectedRigId, jumpNum)
      await load()
    } catch { /* ignore */ }
    setSettingActive(false)
  }

  const canopy = resolveComponent('main_canopy_id', 'main_canopy')
  const reserve = resolveComponent('reserve_id', 'reserve')
  const aad = resolveComponent('aad_id', 'aad')
  const lineset = canopy?.data?.lineset_id ? allGearById[canopy.data.lineset_id] || null : null

  const rigName = (r) => r ? (r.label || [r.data?.brand, r.data?.model].filter(Boolean).join(' ') || 'Rig') : 'Rig'

  return (
    <div className="page" style={{ paddingTop: 24, gap: 16 }}>
      <h1 className="page-title" style={{ padding: '0 var(--page-px)', marginBottom: 0 }}>Gear</h1>

      <AlertBanner alerts={alerts.filter(a => a.severity === 'critical')} />

      {/* Rig selector */}
      <div style={{ padding: '0 var(--page-px)' }}>
        <p className="section-header" style={{ marginBottom: 8 }}>Your Rigs</p>
        {loading ? (
          <div style={{ height: 48, display: 'flex', alignItems: 'center' }}><div className="spinner" /></div>
        ) : rigs.length === 0 ? (
          <div
            style={{ padding: '14px 16px', background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--text-tertiary)', cursor: 'pointer' }}
            onClick={() => onOpenCloset('rig')}
          >
            No rigs added yet — tap to open Rig closet
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {rigs.map(r => {
              const isSelected = r.id === selectedRigId
              const isCurrent = r.is_active
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRigId(r.id)}
                  style={{
                    flexShrink: 0, padding: '10px 16px',
                    background: isSelected ? 'var(--accent-subtle)' : 'var(--card-bg)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                    🟠 {rigName(r)}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Current
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Installed components */}
      {selectedRig && (
        <div style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="section-header" style={{ marginBottom: 0 }}>
            Installed in {rigName(selectedRig)}
          </p>

          <ComponentCard
            icon="🪂"
            label="Main Canopy"
            name={gearLabel(canopy)}
            subLabel={lineset ? (gearLabel(lineset) || 'Lineset') : null}
            jumps={canopy ? (jumpsOnItems[canopy.id] ?? null) : null}
            alert={alertsForCategory(alerts, 'main_canopy')[0]}
            onTap={() => onOpenCloset('main_canopy')}
          />
          <ComponentCard
            icon="🟣"
            label="Reserve"
            name={gearLabel(reserve)}
            jumps={null}
            alert={alertsForCategory(alerts, 'reserve')[0]}
            onTap={() => onOpenCloset('reserve')}
          />
          <ComponentCard
            icon="🔴"
            label="AAD"
            name={gearLabel(aad)}
            jumps={null}
            alert={alertsForCategory(alerts, 'aad')[0]}
            onTap={() => onOpenCloset('aad')}
          />

          {selectedRig.id !== activeRig?.id && (
            <button
              className="btn-primary"
              style={{ marginTop: 4 }}
              disabled={settingActive}
              onClick={handleSetActive}
            >
              {settingActive ? 'Switching...' : `Set "${rigName(selectedRig)}" as Current Rig`}
            </button>
          )}
        </div>
      )}

      {/* Wingload calculator */}
      {canopy && (
        <div style={{ padding: '0 var(--page-px)' }}>
          <WingloadCalculator activeCanopy={canopy} />
        </div>
      )}
    </div>
  )
}
