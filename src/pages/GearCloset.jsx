import { useState, useEffect, useCallback } from 'react'
import { getGearItems, insertGearItem, updateGearItem, retireGearItem, setActiveGear, getAllJumpsForStats, getGearSwaps, getJumpsOnGearItem, getNextJumpNumber } from '../lib/db'
import { calcDepreciation } from '../lib/depreciation'
import GearCard from '../components/GearCard'
import ConfirmSheet from '../components/ConfirmSheet'

const CATEGORY_CONFIG = {
  main_canopy: {
    label: 'Main Canopy', icon: '🪂', iconColor: 'linear-gradient(135deg, #0A84FF, #5AC8FA)',
    defaultLifespanJumps: 1000, defaultLifespanYears: 20,
    fields: [
      { key: 'brand', label: 'Brand', placeholder: 'PD, Icarus, Atair...' },
      { key: 'model', label: 'Model', placeholder: 'Pilot, Crossfire, Nitro...' },
      { key: 'size_sqft', label: 'Size (sqft)', type: 'number', placeholder: '188' },
      { key: 'serial', label: 'Serial Number', placeholder: 'Optional' },
      { key: 'lineset_id', label: 'Current Lineset', type: 'gear_ref', refCategory: 'lineset' },
    ],
  },
  reserve: {
    label: 'Reserve', icon: '🟣', iconColor: 'linear-gradient(135deg, #BF5AF2, #FF6CDE)',
    defaultLifespanYears: 20,
    fields: [
      { key: 'brand', label: 'Brand', placeholder: 'PD, Precision, Aerodyne...' },
      { key: 'model', label: 'Model', placeholder: 'PD Reserve, Raven...' },
      { key: 'size_sqft', label: 'Size (sqft)', type: 'number', placeholder: '176' },
      { key: 'serial', label: 'Serial Number', placeholder: 'Optional' },
      { key: 'manufacture_year', label: 'Year of Manufacture', type: 'number', placeholder: '2020' },
      { key: 'last_repack_date', label: 'Last Repack Date', type: 'date' },
      { key: 'repack_validity_months', label: 'Repack Validity (months)', type: 'number', placeholder: '24' },
    ],
  },
  rig: {
    label: 'Rig / Container', icon: '🟠', iconColor: 'linear-gradient(135deg, #FF9F0A, #FFD60A)',
    defaultLifespanJumps: 3000, defaultLifespanYears: 20,
    fields: [
      { key: 'brand', label: 'Brand', placeholder: 'Mirage, Javelin, Vector...' },
      { key: 'model', label: 'Model', placeholder: 'G4, Odyssey, Micron...' },
      { key: 'serial', label: 'Serial Number', placeholder: 'Optional' },
      { key: 'manufacture_year', label: 'Year of Manufacture', type: 'number', placeholder: '2019' },
      { key: 'main_canopy_id', label: 'Main Canopy installed', type: 'gear_ref', refCategory: 'main_canopy' },
      { key: 'reserve_id',     label: 'Reserve installed',     type: 'gear_ref', refCategory: 'reserve' },
      { key: 'aad_id',         label: 'AAD installed',         type: 'gear_ref', refCategory: 'aad' },
    ],
  },
  lineset: {
    label: 'Lineset', icon: '🟢', iconColor: 'linear-gradient(135deg, #30D158, #34C759)',
    fields: [
      { key: 'line_type', label: 'Line Type', type: 'select', options: ['HMA', 'Vectran', 'Dacron', 'Spectra', 'Custom'] },
      { key: 'installed_date', label: 'Installed Date', type: 'date' },
      { key: 'max_jumps', label: 'Max Jumps', type: 'number', placeholder: '500' },
      { key: 'alert_threshold', label: 'Alert at X jumps remaining', type: 'number', placeholder: '50' },
      { key: 'fits_brand', label: 'Canopy Brand it fits', placeholder: 'PD, Icarus...' },
      { key: 'fits_model', label: 'Canopy Model it fits', placeholder: 'Pilot 188, Crossfire3 150...' },
      { key: '_hint_canopy_link', type: 'hint', message: 'To link this lineset to a canopy, open the Main Canopy closet and select it in the "Current Lineset" field.' },
    ],
  },
  aad: {
    label: 'AAD', icon: '🔴', iconColor: 'linear-gradient(135deg, #FF453A, #FF6B35)',
    defaultLifespanYears: 15,
    fields: [
      { key: 'brand', label: 'Brand', type: 'select', options: ['Cypres', 'Vigil', 'MARS', 'Astra', 'Custom'] },
      { key: 'model', label: 'Model', placeholder: 'Expert, 2-Cutter...' },
      { key: 'serial', label: 'Serial Number', placeholder: 'Optional' },
      { key: 'manufacture_date', label: 'Manufacture Date', type: 'date' },
      { key: 'last_service_date', label: 'Last Service Date', type: 'date' },
      { key: 'service_interval_years', label: 'Service Interval (years)', type: 'number', placeholder: '4' },
      { key: 'battery_replacement_date', label: 'Battery Replacement Due', type: 'date' },
    ],
  },
}

function GearForm({ config, initial = {}, onSave, onCancel, isEditing }) {
  const [label, setLabel] = useState(initial.label || '')
  const [data, setData] = useState(initial.data || {})
  const [purchaseDate, setPurchaseDate] = useState(initial.purchase_date || '')
  const [purchasePrice, setPurchasePrice] = useState(initial.purchase_price || '')
  const [purchaseCondition, setPurchaseCondition] = useState(initial.purchase_condition || '')
  const [lifespanJumps, setLifespanJumps] = useState(initial.lifespan_jumps || config.defaultLifespanJumps || '')
  const [lifespanYears, setLifespanYears] = useState(initial.lifespan_years || config.defaultLifespanYears || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [saving, setSaving] = useState(false)
  const [gearRefItems, setGearRefItems] = useState({})

  useEffect(() => {
    const refs = config.fields.filter(f => f.type === 'gear_ref')
    if (!refs.length) return
    Promise.all(
      refs.map(f => getGearItems(f.refCategory).then(items => [f.refCategory, items]))
    ).then(pairs => setGearRefItems(Object.fromEntries(pairs))).catch(() => {})
  }, [config.fields])

  const setField = (key, val) => setData(d => ({ ...d, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const item = {
        category: initial.category,
        label: label || null,
        data,
        purchase_date: purchaseDate || null,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        purchase_condition: purchaseCondition || null,
        lifespan_jumps: lifespanJumps ? Number(lifespanJumps) : null,
        lifespan_years: lifespanYears ? Number(lifespanYears) : null,
        notes: notes || null,
      }
      await onSave(item)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <label className="input-label">Label (optional)</label>
        <input className="input-field" placeholder={`My ${config.label}`} value={label} onChange={e => setLabel(e.target.value)} />
      </div>

      {config.fields.map(f => {
        if (f.type === 'hint') {
          return (
            <div key={f.key} style={{ padding: '10px 14px', background: 'rgba(0,122,255,0.08)', borderRadius: 10, border: '1px solid rgba(0,122,255,0.15)', fontSize: 13, color: 'var(--accent)', lineHeight: 1.5 }}>
              💡 {f.message}
            </div>
          )
        }
        return (
          <div key={f.key} className="form-group">
            <label className="input-label">{f.label}</label>
            {f.type === 'select' ? (
              <select className="input-field" value={data[f.key] || ''} onChange={e => setField(f.key, e.target.value)} style={{ appearance: 'none' }}>
                <option value="">Select...</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'gear_ref' ? (
              <select className="input-field" value={data[f.key] || ''} onChange={e => setField(f.key, e.target.value)} style={{ appearance: 'none' }}>
                <option value="">None</option>
                {(gearRefItems[f.refCategory] || []).map(item => {
                  const name = item.label || [item.data?.brand, item.data?.model].filter(Boolean).join(' ') || 'Unnamed'
                  return <option key={item.id} value={item.id}>{name}{item.is_active ? ' (active)' : ''}</option>
                })}
              </select>
            ) : (
              <input className="input-field" type={f.type || 'text'} placeholder={f.placeholder} value={data[f.key] || ''} onChange={e => setField(f.key, e.target.value)} />
            )}
          </div>
        )
      })}

      <div className="divider" />
      <p className="section-header">Purchase Info</p>

      <div style={{ display: 'flex', gap: 10 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="input-label">Purchase Date</label>
          <input className="input-field" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="input-label">Price</label>
          <input className="input-field" type="number" placeholder="1200" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label className="input-label">Condition at Purchase</label>
        <select className="input-field" value={purchaseCondition} onChange={e => setPurchaseCondition(e.target.value)} style={{ appearance: 'none' }}>
          <option value="">Select...</option>
          <option>New</option><option>Like New</option><option>Good</option><option>Fair</option>
        </select>
      </div>

      <div className="divider" />
      <p className="section-header">Lifespan</p>

      <div style={{ display: 'flex', gap: 10 }}>
        {config.defaultLifespanJumps !== undefined && (
          <div className="form-group" style={{ flex: 1 }}>
            <label className="input-label">Max Jumps</label>
            <input className="input-field" type="number" value={lifespanJumps} onChange={e => setLifespanJumps(e.target.value)} />
          </div>
        )}
        {config.defaultLifespanYears !== undefined && (
          <div className="form-group" style={{ flex: 1 }}>
            <label className="input-label">Max Years</label>
            <input className="input-field" type="number" value={lifespanYears} onChange={e => setLifespanYears(e.target.value)} />
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="input-label">Notes</label>
        <textarea className="input-field" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes..." />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add to Closet'}
        </button>
      </div>
    </div>
  )
}

function RetireSheet({ item, onRetire, onCancel }) {
  const [reason, setReason] = useState('')
  const [salePrice, setSalePrice] = useState('')
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet-panel" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">Retire {item.label || 'Gear'}</span>
          <button className="btn-icon" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20 }}>✕</button>
        </div>
        <div className="sheet-content">
          <div className="form-group">
            <label className="input-label">Reason</label>
            <input className="input-field" placeholder="Sold, worn out, replaced..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="input-label">Sale Price (if sold)</label>
            <input className="input-field" type="number" placeholder="0" value={salePrice} onChange={e => setSalePrice(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
            <button
              className="btn-secondary btn-danger"
              style={{ flex: 1 }}
              onClick={() => onRetire(reason, salePrice ? Number(salePrice) : null)}
            >
              Retire
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GearCloset({ category, onBack, settings }) {
  const config = CATEGORY_CONFIG[category]
  const [items, setItems] = useState([])
  const [jumpsOnItems, setJumpsOnItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmActivate, setConfirmActivate] = useState(null)
  const [retireItem, setRetireItem] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [gear, jumps, swapData] = await Promise.all([
        getGearItems(category),
        getAllJumpsForStats(),
        getGearSwaps(),
      ])
      setItems(gear)
      const counts = {}
      for (const g of gear) {
        counts[g.id] = await getJumpsOnGearItem(g.id, jumps, swapData)
      }
      setJumpsOnItems(counts)
    } catch { /* ignore */ }
    setLoading(false)
  }, [category])

  useEffect(() => { load() }, [load])

  const handleAdd = async (formData) => {
    await insertGearItem({ ...formData, category })
    setShowForm(false)
    load()
  }

  const handleEdit = async (formData) => {
    await updateGearItem(editingItem.id, formData)
    setEditingItem(null)
    load()
  }

  const handleSetActive = async () => {
    const item = confirmActivate
    const jumpNum = await getNextJumpNumber(settings?.starting_jump_number ?? 1)
    await setActiveGear(category, item.id, jumpNum)
    setConfirmActivate(null)
    load()
  }

  const handleRetire = async (reason, salePrice) => {
    await retireGearItem(retireItem.id, reason, salePrice)
    setRetireItem(null)
    load()
  }

  const activeItem = items.find(i => i.is_active)
  const totalSpent = items.reduce((s, i) => s + (i.purchase_price || 0), 0)
  const currentFleetValue = items.filter(i => !i.retired_date).reduce((s, i) => {
    const { currentValue } = calcDepreciation(i, jumpsOnItems[i.id] || 0)
    return s + currentValue
  }, 0)
  const recovered = items.filter(i => i.sale_price).reduce((s, i) => s + i.sale_price, 0)
  const currency = settings?.currency || 'EUR'

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)',
        padding: '16px var(--page-px) 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ background: config.iconColor, borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{config.icon}</span>
          <h2 style={{ margin: 0 }}>{config.label} Closet</h2>
        </div>
        <button
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: 13 }}
          onClick={() => { setShowForm(true); setEditingItem(null) }}
        >
          + Add
        </button>
      </div>

      {/* Financial summary */}
      {totalSpent > 0 && (
        <div className="card" style={{ margin: '12px var(--page-px)', display: 'flex', gap: 0 }}>
          {[
            { label: 'Spent', value: `${currency}${Math.round(totalSpent).toLocaleString()}` },
            { label: 'Fleet Value', value: `~${currency}${Math.round(currentFleetValue).toLocaleString()}` },
            { label: 'Recovered', value: `${currency}${Math.round(recovered).toLocaleString()}` },
          ].map((stat, i, arr) => (
            <div key={stat.label} style={{
              flex: 1, textAlign: 'center',
              borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              padding: '4px 0',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 24px' }}>
          <span className="empty-state-icon">{config.icon}</span>
          <div className="empty-state-title">No {config.label} yet</div>
          <div className="empty-state-body">Tap "+ Add" to add your first {config.label.toLowerCase()}.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 var(--page-px)' }}>
          {items.map(item => (
            <div key={item.id}>
              <GearCard
                item={item}
                jumpsOnItem={jumpsOnItems[item.id] || 0}
                isActive={item.is_active}
                onTap={() => setEditingItem(item)}
              />
              {!item.is_active && !item.retired_date && (
                <button
                  className="btn-secondary"
                  style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px', color: 'var(--accent)', border: '1px solid rgba(0,122,255,0.2)' }}
                  onClick={() => setConfirmActivate(item)}
                >
                  Set as Active
                </button>
              )}
              {item.is_active && !item.retired_date && (
                <button
                  className="btn-secondary btn-danger"
                  style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px' }}
                  onClick={() => setRetireItem(item)}
                >
                  Retire
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form sheet */}
      {(showForm || editingItem) && (
        <div className="sheet-overlay" onClick={() => { setShowForm(false); setEditingItem(null) }}>
          <div className="sheet-panel" onClick={e => e.stopPropagation()} style={{ maxHeight: '90svh' }}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">{editingItem ? `Edit ${config.label}` : `Add ${config.label}`}</span>
              <button className="btn-icon" onClick={() => { setShowForm(false); setEditingItem(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20 }}>✕</button>
            </div>
            <div className="sheet-content">
              <GearForm
                config={config}
                initial={editingItem ? { ...editingItem, category } : { category }}
                onSave={editingItem ? handleEdit : handleAdd}
                onCancel={() => { setShowForm(false); setEditingItem(null) }}
                isEditing={!!editingItem}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirm activate */}
      {confirmActivate && (
        <ConfirmSheet
          title={`Set as Active ${config.label}`}
          message={`Make "${confirmActivate.label || config.label}" your active ${config.label.toLowerCase()}? ${activeItem ? `"${activeItem.label || config.label}" will be deactivated.` : ''}`}
          confirmLabel="Set Active"
          onConfirm={handleSetActive}
          onCancel={() => setConfirmActivate(null)}
        />
      )}

      {/* Retire sheet */}
      {retireItem && (
        <RetireSheet
          item={retireItem}
          onRetire={handleRetire}
          onCancel={() => setRetireItem(null)}
        />
      )}
    </div>
  )
}
