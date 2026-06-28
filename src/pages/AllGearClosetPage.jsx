import { useState, useEffect, useCallback } from 'react'
import { getGearItems } from '../lib/db'

const CATEGORIES = [
  { id: 'rig',          label: 'Rigs',          icon: '🟠' },
  { id: 'main_canopy',  label: 'Main Canopies', icon: '🪂' },
  { id: 'lineset',      label: 'Linesets',       icon: '🟢' },
  { id: 'reserve',      label: 'Reserves',       icon: '🟣' },
  { id: 'aad',          label: 'AADs',           icon: '🔴' },
]

function itemName(item) {
  return item.label || [item.data?.brand, item.data?.model].filter(Boolean).join(' ') || 'Unnamed'
}

export default function AllGearClosetPage({ onOpenCloset }) {
  const [itemsByCategory, setItemsByCategory] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getGearItems()
      const grouped = {}
      for (const cat of CATEGORIES) grouped[cat.id] = []
      for (const item of all) {
        if (grouped[item.category]) grouped[item.category].push(item)
      }
      setItemsByCategory(grouped)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <h1 className="page-title" style={{ padding: '0 var(--page-px)', marginBottom: 4 }}>Gear Closet</h1>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : (
        CATEGORIES.map(cat => {
          const items = itemsByCategory[cat.id] || []
          return (
            <div key={cat.id} style={{ marginBottom: 4 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px var(--page-px) 6px',
              }}>
                <p className="section-header" style={{ margin: 0 }}>{cat.icon} {cat.label}</p>
                <button
                  className="btn-secondary"
                  style={{ padding: '5px 12px', fontSize: 12 }}
                  onClick={() => onOpenCloset(cat.id)}
                >
                  + Add
                </button>
              </div>

              <div className="card" style={{ margin: '0 var(--page-px)', padding: 0, overflow: 'hidden' }}>
                {items.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    Nothing added yet
                  </div>
                ) : (
                  items.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenCloset(cat.id)}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                        borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {itemName(item)}
                        </div>
                        {item.data?.size_sqft && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                            {item.data.size_sqft} sqft
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {item.retired_date ? (
                          <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-tertiary)', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>RETIRED</span>
                        ) : item.is_active ? (
                          <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>ACTIVE</span>
                        ) : null}
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>›</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
