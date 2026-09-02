import { KEYS, readAll, writeAll } from './storageKeys'

const CONFIG_KEY = 'skylog_github_config'
const STATUS_KEY = 'skylog_github_backup_status'
const DEFAULT_PATH = 'skylog-backup/data.json'
const DEBOUNCE_MS = 2500

let debounceTimer = null

export function getGithubConfig() {
  return readAll(CONFIG_KEY) || { owner: '', repo: '', branch: 'main', token: '', path: DEFAULT_PATH }
}

export function setGithubConfig(config) {
  const trimmed = Object.fromEntries(
    Object.entries(config).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
  )
  writeAll(CONFIG_KEY, { branch: 'main', path: DEFAULT_PATH, ...getGithubConfig(), ...trimmed })
}

export function isGithubConfigured() {
  const { owner, repo, token } = getGithubConfig()
  return Boolean(owner && repo && token)
}

export function getBackupStatus() {
  return readAll(STATUS_KEY) || { lastBackupAt: null, lastError: null }
}

function setBackupStatus(status) {
  writeAll(STATUS_KEY, { ...getBackupStatus(), ...status })
}

function collectAllData() {
  return {
    exportedAt: new Date().toISOString(),
    jumps: readAll(KEYS.jumps) || [],
    gear_items: readAll(KEYS.gearItems) || [],
    gear_swaps: readAll(KEYS.gearSwaps) || [],
    templates: readAll(KEYS.templates) || [],
    settings: readAll(KEYS.settings) || null,
  }
}

function apiHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

function fromBase64(str) {
  return decodeURIComponent(escape(atob(str)))
}

// ── Backup ─────────────────────────────────────────────────────────────────

export async function backupNow() {
  const { owner, repo, branch, token, path } = getGithubConfig()
  if (!owner || !repo || !token) {
    throw new Error('GitHub backup is not configured. Add a repo and token in Settings.')
  }

  const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  let sha
  const getRes = await fetch(`${contentsUrl}?ref=${branch}`, { headers: apiHeaders(token) })
  if (getRes.ok) {
    const existing = await getRes.json()
    sha = existing.sha
  } else if (getRes.status !== 404) {
    const err = await getRes.json().catch(() => ({}))
    throw new Error(err.message || `GitHub error ${getRes.status}`)
  }

  const data = collectAllData()
  const body = {
    message: `SkyLog backup ${data.exportedAt}`,
    content: toBase64(JSON.stringify(data, null, 2)),
    branch,
    ...(sha ? { sha } : {}),
  }

  const putRes = await fetch(contentsUrl, {
    method: 'PUT',
    headers: { ...apiHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}))
    throw new Error(err.message || `GitHub error ${putRes.status}`)
  }

  setBackupStatus({ lastBackupAt: new Date().toISOString(), lastError: null })
}

export function scheduleBackup() {
  if (!isGithubConfigured()) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    backupNow().catch(err => setBackupStatus({ lastError: err.message }))
  }, DEBOUNCE_MS)
}

// ── Restore (used only to recover local data on a fresh install) ───────────

export async function restoreFromGithub() {
  const { owner, repo, branch, token, path } = getGithubConfig()
  if (!owner || !repo || !token) {
    throw new Error('GitHub backup is not configured.')
  }

  const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  const res = await fetch(`${contentsUrl}?ref=${branch}`, { headers: apiHeaders(token) })
  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub error ${res.status}`)
  }

  const file = await res.json()
  const data = JSON.parse(fromBase64(file.content))

  writeAll(KEYS.jumps, data.jumps || [])
  writeAll(KEYS.gearItems, data.gear_items || [])
  writeAll(KEYS.gearSwaps, data.gear_swaps || [])
  writeAll(KEYS.templates, data.templates || [])
  if (data.settings) writeAll(KEYS.settings, data.settings)

  return data
}

export function hasLocalData() {
  return Boolean((readAll(KEYS.jumps) || []).length)
}
