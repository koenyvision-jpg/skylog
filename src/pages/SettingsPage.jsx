import { useState, useEffect, useCallback, useRef } from 'react'
import { getTemplates, addTemplate, deleteTemplate, upsertSettings, getJumps, getGearItems, getGearSwaps, clearAllJumps } from '../lib/db'
import { exportToGoogleDrive, getLastBackupDate } from '../lib/driveBackup'
import AIImport from '../components/AIImport'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AUD']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function SettingRow({ label, children, description }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
          {description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{description}</div>}
        </div>
        <div style={{ flexShrink: 0 }}>{children}</div>
      </div>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div>
      <p className="section-header" style={{ marginBottom: 8 }}>{title}</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  )
}

function TemplateManager({ category, label }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [newVal, setNewVal] = useState('')

  const load = useCallback(() => getTemplates(category).then(setItems).catch(() => {}), [category])
  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newVal.trim()) return
    await addTemplate(category, newVal.trim())
    setNewVal('')
    setAdding(false)
    load()
  }

  const handleDelete = async (id) => {
    await deleteTemplate(id)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setAdding(a => !a)}>+ Add</button>
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            autoFocus
            className="input-field"
            style={{ flex: 1, padding: '8px 12px' }}
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewVal('') } }}
            placeholder={`New ${label.toLowerCase()}...`}
          />
          <button className="btn-secondary" style={{ padding: '8px 12px', color: 'var(--accent)' }} onClick={handleAdd}>Add</button>
        </div>
      )}
      {items.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingLeft: 4 }}>No {label.toLowerCase()} added yet</p>
      )}
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.value}</span>
          <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, padding: 4 }}>✕</button>
        </div>
      ))}
    </div>
  )
}

export default function SettingsPage({ session, settings, onSettingsChange, onSignOut }) {
  const [local, setLocal] = useState(settings || {})
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMsg, setBackupMsg] = useState(null)
  const [lastBackup, setLastBackup] = useState(getLastBackupDate())
  const [showImport, setShowImport] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const saveTimeout = useRef(null)

  useEffect(() => { if (settings) setLocal(settings) }, [settings])

  const handleChange = (key, value) => {
    const updated = { ...local, [key]: value }
    setLocal(updated)
    onSettingsChange(updated)
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      upsertSettings(updated).catch(() => {})
    }, 500)
  }

  const handleBackup = async () => {
    setBackupLoading(true)
    setBackupMsg(null)
    try {
      const filename = await exportToGoogleDrive()
      setBackupMsg(`✓ Backed up as ${filename}`)
      setLastBackup(new Date().toISOString())
    } catch (err) {
      setBackupMsg(`Error: ${err.message}`)
    }
    setBackupLoading(false)
  }

  const handleExportCSV = async () => {
    try {
      const jumps = await getJumps({ limit: 10000 })
      const header = 'Jump Start,Jump End,Count,Date,Location,Event,Type,Notes\n'
      const rows = jumps.map(j =>
        [j.jump_number_start, j.jump_number_end, j.number_of_jumps, j.date, j.location, j.event_name, j.jump_type, j.notes]
          .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
          .join(',')
      ).join('\n')
      const blob = new Blob([header + rows], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'SkyLog_Export.csv'; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { alert(err.message) }
  }

  const handleExportJSON = async () => {
    try {
      const [jumps, gear, swaps] = await Promise.all([
        getJumps({ limit: 10000 }),
        getGearItems(),
        getGearSwaps(),
      ])
      const blob = new Blob([JSON.stringify({ jumps, gear, swaps, settings }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'SkyLog_Export.json'; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { alert(err.message) }
  }

  const meta = session?.user?.user_metadata || {}

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <h1 className="page-title" style={{ padding: '0 var(--page-px)', marginBottom: 4 }}>Settings</h1>

      {/* Account */}
      <SectionCard title="Account">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {meta.avatar_url && (
            <img src={meta.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{meta.full_name || meta.name || 'Skydiver'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{session?.user?.email}</div>
          </div>
          <button className="btn-secondary btn-danger" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onSignOut}>Sign Out</button>
        </div>
      </SectionCard>

      {/* General */}
      <SectionCard title="General Preferences">
        <SettingRow label="Currency">
          <select className="input-field" style={{ width: 90, padding: '8px 12px', appearance: 'none' }} value={local.currency || 'EUR'} onChange={e => handleChange('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </SettingRow>
        <div className="divider" />
        <SettingRow label="Weight Unit">
          <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: 'var(--card-border)' }}>
            {['kg', 'lbs'].map(u => (
              <button key={u} type="button" onClick={() => handleChange('weight_unit', u)} style={{
                padding: '7px 14px', background: (local.weight_unit || 'kg') === u ? 'var(--accent)' : 'var(--input-bg)',
                color: (local.weight_unit || 'kg') === u ? '#fff' : 'var(--text-secondary)',
                border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer',
              }}>{u}</button>
            ))}
          </div>
        </SettingRow>
        <div className="divider" />
        <SettingRow label="Altitude Unit">
          <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: 'var(--card-border)' }}>
            {['ft', 'm'].map(u => (
              <button key={u} type="button" onClick={() => handleChange('altitude_unit', u)} style={{
                padding: '7px 14px', background: (local.altitude_unit || 'ft') === u ? 'var(--accent)' : 'var(--input-bg)',
                color: (local.altitude_unit || 'ft') === u ? '#fff' : 'var(--text-secondary)',
                border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer',
              }}>{u}</button>
            ))}
          </div>
        </SettingRow>
        <div className="divider" />
        <SettingRow label="Season Start Month">
          <select className="input-field" style={{ width: 130, padding: '8px 12px', appearance: 'none' }} value={local.season_start_month || 1} onChange={e => handleChange('season_start_month', Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </SettingRow>
        <div className="divider" />
        <SettingRow label="Starting Jump Number" description="First jump number in your logbook">
          <input type="number" className="input-field" style={{ width: 90, padding: '8px 12px' }} value={local.starting_jump_number || 1} onChange={e => handleChange('starting_jump_number', Number(e.target.value))} min={1} />
        </SettingRow>
      </SectionCard>

      {/* Alert thresholds */}
      <SectionCard title="Alert Thresholds">
        <SettingRow label="Reserve Repack Warning" description="Days before expiry">
          <input type="number" className="input-field" style={{ width: 70, padding: '8px 10px' }} value={local.reserve_repack_warning_days ?? 30} onChange={e => handleChange('reserve_repack_warning_days', Number(e.target.value))} />
        </SettingRow>
        <div className="divider" />
        <SettingRow label="Lineset Warning" description="Warn when X jumps remaining">
          <input type="number" className="input-field" style={{ width: 70, padding: '8px 10px' }} value={local.lineset_warning_jumps ?? 20} onChange={e => handleChange('lineset_warning_jumps', Number(e.target.value))} />
        </SettingRow>
        <div className="divider" />
        <SettingRow label="AAD Service Warning" description="Days before service due">
          <input type="number" className="input-field" style={{ width: 70, padding: '8px 10px' }} value={local.aad_service_warning_days ?? 60} onChange={e => handleChange('aad_service_warning_days', Number(e.target.value))} />
        </SettingRow>
        <div className="divider" />
        <SettingRow label="AAD Battery Warning" description="Days before battery due">
          <input type="number" className="input-field" style={{ width: 70, padding: '8px 10px' }} value={local.aad_battery_warning_days ?? 60} onChange={e => handleChange('aad_battery_warning_days', Number(e.target.value))} />
        </SettingRow>
      </SectionCard>

      {/* Templates */}
      <SectionCard title="Dropdown Templates">
        <TemplateManager category="location" label="Locations" />
        <div className="divider" />
        <TemplateManager category="jump_type" label="Jump Types" />
        <div className="divider" />
        <TemplateManager category="event_name" label="Event Names" />
      </SectionCard>

      {/* Import */}
      <SectionCard title="Import Previous Logbook">
        {!showImport ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 14 }}>Import jumps from an Excel or CSV file using AI-powered column detection.</p>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowImport(true)}>
              📊 Start Import
            </button>
          </div>
        ) : (
          <AIImport settings={local} onImported={(count) => { setShowImport(false); alert(`Imported ${count} jumps successfully!`) }} />
        )}
      </SectionCard>

      {/* Backup */}
      <SectionCard title="Backup to Google Drive">
        {lastBackup && (
          <p style={{ fontSize: 12 }}>Last backup: {new Date(lastBackup).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        )}
        {backupMsg && (
          <div className={`badge badge-${backupMsg.startsWith('Error') ? 'danger' : 'success'}`} style={{ borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13 }}>
            {backupMsg}
          </div>
        )}
        <button className="btn-secondary" style={{ width: '100%' }} onClick={handleBackup} disabled={backupLoading}>
          {backupLoading ? '⏳ Exporting...' : '☁️ Export backup to Google Drive'}
        </button>
        <p style={{ fontSize: 12 }}>Creates or updates SkyLog_Backup_YYYY-MM-DD.json in your Google Drive root.</p>
      </SectionCard>

      {/* Export */}
      <SectionCard title="Export">
        <button className="btn-secondary" style={{ width: '100%' }} onClick={handleExportCSV}>
          📄 Download as CSV
        </button>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={handleExportJSON}>
          🗂 Download as JSON
        </button>
      </SectionCard>

      {/* Danger Zone */}
      <div>
        <p className="section-header" style={{ marginBottom: 8 }}>Danger Zone</p>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Permanently delete all jumps from your logbook. This cannot be undone.
          </p>
          {!clearConfirm ? (
            <button
              className="btn-secondary btn-danger"
              style={{ width: '100%' }}
              onClick={() => setClearConfirm(true)}
            >
              Clear Entire Logbook
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, margin: 0 }}>
                Are you sure? All jump records will be deleted permanently.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setClearConfirm(false)}
                  disabled={clearing}
                >
                  Cancel
                </button>
                <button
                  className="btn-secondary btn-danger"
                  style={{ flex: 1 }}
                  disabled={clearing}
                  onClick={async () => {
                    setClearing(true)
                    try {
                      await clearAllJumps()
                      setClearConfirm(false)
                    } catch (err) {
                      alert(err.message)
                    }
                    setClearing(false)
                  }}
                >
                  {clearing ? 'Deleting...' : 'Yes, Delete All'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  )
}
