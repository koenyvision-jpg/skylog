import { supabase } from './supabase'

const LAST_BACKUP_KEY = 'skylog_last_backup'

export function getLastBackupDate() {
  return localStorage.getItem(LAST_BACKUP_KEY)
}

export async function exportToGoogleDrive() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.provider_token
  if (!token) throw new Error('Google OAuth token not available. Please sign out and sign in again.')

  // Fetch all data
  const [jumps, gear, templates, settings, swaps] = await Promise.all([
    supabase.from('jumps').select('*').then(r => r.data),
    supabase.from('gear_items').select('*').then(r => r.data),
    supabase.from('templates').select('*').then(r => r.data),
    supabase.from('settings').select('*').then(r => r.data),
    supabase.from('gear_swaps').select('*').then(r => r.data),
  ])

  const backup = { exportedAt: new Date().toISOString(), jumps, gear, templates, settings, swaps }
  const json = JSON.stringify(backup, null, 2)
  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `SkyLog_Backup_${dateStr}.json`

  // Search for existing file to update
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${filename}'&spaces=drive&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()
  const existingId = searchData.files?.[0]?.id

  const blob = new Blob([json], { type: 'application/json' })
  const metadata = { name: filename, mimeType: 'application/json' }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)

  let uploadRes
  if (existingId) {
    uploadRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: form }
    )
  } else {
    uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
    )
  }

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Google Drive upload failed')
  }

  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  return filename
}
