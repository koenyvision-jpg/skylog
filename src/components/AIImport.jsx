import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { askClaude } from '../lib/claude'
import { bulkInsertJumps, upsertSettings } from '../lib/db'

const IMPORT_PROMPT = `You are parsing a skydiving logbook export spreadsheet.

Headers and first 20 rows:
{RAW_DATA}

Map columns to these fields:
- date (required, any recognizable date format)
- jumpStart (start of jump number range, e.g. "jump_start", "Jump", first number in a range like "1213-1214")
- jumpEnd (end of jump number range, e.g. "jump_end"; may be same column as jumpStart if combined)
- count (number of jumps in the batch, e.g. "count", "Jumps that Day")
- location (dropzone or place)
- event (event or boogie name)
- jumpType (discipline or jump type)
- notes

Return ONLY valid JSON:
{
  "mappings": {
    "date": "column name or null",
    "jumpStart": "column name or null",
    "jumpEnd": "column name or null",
    "count": "column name or null",
    "location": "column name or null",
    "event": "column name or null",
    "jumpType": "column name or null",
    "notes": "column name or null"
  },
  "totalRowsDetected": number,
  "confidence": "high|medium|low",
  "notes": "brief observations about the data"
}`

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400000)
    return d.toISOString().split('T')[0]
  }
  const d = new Date(val)
  if (!isNaN(d)) return d.toISOString().split('T')[0]
  return null
}

function parseNum(val) {
  if (!val && val !== 0) return null
  const n = Number(String(val).replace(/[^\d]/g, ''))
  return isNaN(n) ? null : n
}

export default function AIImport({ settings, onImported }) {
  const [step, setStep] = useState('upload')
  const [rawRows, setRawRows] = useState([])
  const [mappings, setMappings] = useState({})
  const [aiNotes, setAiNotes] = useState('')
  const [confidence, setConfidence] = useState('')
  const [importCount, setImportCount] = useState(0)
  const [totalJumps, setTotalJumps] = useState(0)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const handleFile = async (file) => {
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      setRawRows(rows)

      const preview = rows.slice(0, 20)
      const rawData = JSON.stringify({ headers: Object.keys(rows[0] || {}), rows: preview }, null, 2)
      const prompt = IMPORT_PROMPT.replace('{RAW_DATA}', rawData)

      const response = await askClaude([{ role: 'user', content: 'Parse this logbook.' }], prompt)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Could not parse AI response')
      const parsed = JSON.parse(jsonMatch[0])

      setMappings(parsed.mappings || {})
      setAiNotes(parsed.notes || '')
      setConfidence(parsed.confidence || '')
      setStep('mapping')
    } catch (err) {
      setError(err.message)
    }
  }

  const allColumns = rawRows.length ? ['(skip)', ...Object.keys(rawRows[0])] : []

  const handleImport = async () => {
    setStep('importing')
    try {
      const jumps = []
      let maxJumpNum = 0
      let rowNum = 0
      let jumpTotal = 0

      for (const row of rawRows) {
        const date = parseDate(row[mappings.date])
        if (!date) continue

        const jumpStart = mappings.jumpStart ? parseNum(row[mappings.jumpStart]) : null
        const jumpEnd = mappings.jumpEnd ? parseNum(row[mappings.jumpEnd]) : jumpStart
        const count = mappings.count ? (parseNum(row[mappings.count]) || 1) : (jumpStart && jumpEnd ? jumpEnd - jumpStart + 1 : 1)

        rowNum++
        const start = jumpStart || rowNum
        const end = jumpEnd || start
        if (end > maxJumpNum) maxJumpNum = end
        jumpTotal += count

        jumps.push({
          date,
          jump_number_start: start,
          jump_number_end: end,
          number_of_jumps: count,
          location: mappings.location ? String(row[mappings.location] || '') || null : null,
          event_name: mappings.event ? String(row[mappings.event] || '') || null : null,
          jump_type: mappings.jumpType ? String(row[mappings.jumpType] || '') || null : null,
          notes: mappings.notes ? String(row[mappings.notes] || '') || null : null,
          per_jump_notes: {},
          gear_snapshot: {},
        })
      }

      await bulkInsertJumps(jumps)

      if (maxJumpNum > 0 && settings) {
        await upsertSettings({ ...settings, starting_jump_number: maxJumpNum + 1 })
      }

      setImportCount(jumps.length)
      setTotalJumps(jumpTotal)
      setStep('done')
      onImported?.(jumps.length)
    } catch (err) {
      setError(err.message)
      setStep('mapping')
    }
  }

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h3>Import Complete</h3>
        <p>Imported {importCount} entries ({totalJumps} total jumps). Your next jump will be #{totalJumps + 1}.</p>
        <button className="btn-primary" onClick={() => { setStep('upload'); setRawRows([]); setMappings({}) }}>Import Another</button>
      </div>
    )
  }

  if (step === 'importing') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
        <p>Importing {rawRows.length} rows...</p>
      </div>
    )
  }

  if (step === 'mapping') {
    const FIELDS = ['date', 'jumpStart', 'jumpEnd', 'count', 'location', 'event', 'jumpType', 'notes']
    const previewRows = rawRows.slice(0, 5)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge badge-${confidence === 'high' ? 'success' : confidence === 'medium' ? 'warning' : 'danger'}`}>
            {confidence} confidence
          </span>
          {aiNotes && <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{aiNotes}</span>}
        </div>

        <p className="section-header">Column Mappings</p>
        {FIELDS.map(field => (
          <div key={field} className="form-group">
            <label className="input-label">{field}</label>
            <select
              className="input-field"
              value={mappings[field] || '(skip)'}
              onChange={e => setMappings(m => ({ ...m, [field]: e.target.value === '(skip)' ? null : e.target.value }))}
              style={{ appearance: 'none' }}
            >
              {allColumns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ))}

        <p className="section-header">Preview (first 5 rows)</p>
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: 'var(--card-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--input-bg)' }}>
                {FIELDS.filter(f => mappings[f]).map(f => (
                  <th key={f} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 500 }}>{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {FIELDS.filter(f => mappings[f]).map(f => (
                    <td key={f} style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mappings[f] ? String(row[mappings[f]] || '') : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setStep('upload'); setRawRows([]) }}>Back</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={handleImport} disabled={!mappings.date}>
            Import {rawRows.length} Rows
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      <div
        style={{
          border: '2px dashed rgba(255,255,255,0.15)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}
        onClick={() => fileRef.current.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <span style={{ fontSize: 40 }}>📊</span>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drop your logbook file here</p>
        <p style={{ fontSize: 13 }}>Supports .xlsx, .xls, .csv</p>
        <button className="btn-secondary" style={{ marginTop: 4 }}>Choose File</button>
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
    </div>
  )
}
