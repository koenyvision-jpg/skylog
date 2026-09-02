import { KEYS, readAll, writeAll } from './storageKeys'
import { scheduleBackup } from './githubBackup'

function uid() {
  return crypto.randomUUID()
}

function getCollection(key) {
  return readAll(key) || []
}

function saveCollection(key, arr) {
  writeAll(key, arr)
  scheduleBackup()
}

// ── Jumps ──────────────────────────────────────────────────────────────────

export async function getJumps({ page = 0, limit = 50, filters = {} } = {}) {
  let jumps = getCollection(KEYS.jumps)

  if (filters.dateFrom) jumps = jumps.filter(j => j.date >= filters.dateFrom)
  if (filters.dateTo) jumps = jumps.filter(j => j.date <= filters.dateTo)
  if (filters.jumpType) jumps = jumps.filter(j => j.jump_type === filters.jumpType)
  if (filters.location) jumps = jumps.filter(j => (j.location || '').toLowerCase().includes(filters.location.toLowerCase()))

  jumps.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (b.jump_number_start || 0) - (a.jump_number_start || 0)
  })

  return jumps.slice(page * limit, page * limit + limit)
}

export async function getAllJumpsForStats() {
  const jumps = getCollection(KEYS.jumps)
    .map(({ date, jump_number_start, jump_number_end, number_of_jumps, gear_snapshot }) => ({
      date, jump_number_start, jump_number_end, number_of_jumps, gear_snapshot,
    }))
  jumps.sort((a, b) => (a.date > b.date ? 1 : -1))
  return jumps
}

export async function insertJump(jump) {
  const jumps = getCollection(KEYS.jumps)
  jumps.push({ id: uid(), created_at: new Date().toISOString(), ...jump })
  saveCollection(KEYS.jumps, jumps)
}

export async function updateJump(id, data) {
  const jumps = getCollection(KEYS.jumps)
  const idx = jumps.findIndex(j => j.id === id)
  if (idx === -1) return
  jumps[idx] = { ...jumps[idx], ...data }
  saveCollection(KEYS.jumps, jumps)
}

export async function deleteJump(id) {
  const jumps = getCollection(KEYS.jumps).filter(j => j.id !== id)
  saveCollection(KEYS.jumps, jumps)
}

export async function getNextJumpNumber(startingJumpNumber = 1) {
  const jumps = getCollection(KEYS.jumps)
  if (!jumps.length) return startingJumpNumber
  const max = jumps.reduce((m, j) => Math.max(m, j.jump_number_end || 0), 0)
  return max + 1
}

// ── Gear ───────────────────────────────────────────────────────────────────

export async function getGearItems(category) {
  let items = getCollection(KEYS.gearItems)
  if (category) items = items.filter(i => i.category === category)
  return [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

export async function insertGearItem(item) {
  const items = getCollection(KEYS.gearItems)
  items.push({ id: uid(), created_at: new Date().toISOString(), ...item })
  saveCollection(KEYS.gearItems, items)
}

export async function updateGearItem(id, data) {
  const items = getCollection(KEYS.gearItems)
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return
  items[idx] = { ...items[idx], ...data }
  saveCollection(KEYS.gearItems, items)
}

export async function retireGearItem(id, reason, salePrice) {
  await updateGearItem(id, {
    is_active: false,
    retired_date: new Date().toISOString().split('T')[0],
    retired_reason: reason,
    sale_price: salePrice || null,
  })
}

export async function setActiveGear(category, newId, jumpNumber) {
  const items = getCollection(KEYS.gearItems)
  const swaps = getCollection(KEYS.gearSwaps)
  const current = items.find(i => i.category === category && i.is_active)

  if (current) {
    current.is_active = false
    swaps.push({
      id: uid(),
      category,
      old_gear_id: current.id,
      new_gear_id: newId,
      swapped_at: new Date().toISOString(),
      jump_number_at_swap: jumpNumber,
    })
  } else {
    swaps.push({
      id: uid(),
      category,
      old_gear_id: null,
      new_gear_id: newId,
      swapped_at: new Date().toISOString(),
      jump_number_at_swap: jumpNumber,
    })
  }

  const newIdx = items.findIndex(i => i.id === newId)
  if (newIdx !== -1) items[newIdx].is_active = true

  writeAll(KEYS.gearItems, items)
  writeAll(KEYS.gearSwaps, swaps)
  scheduleBackup()
}

export async function setActiveRig(rigId, jumpNumber) {
  const items = getCollection(KEYS.gearItems)
  const rig = items.find(i => i.id === rigId)
  const { main_canopy_id, reserve_id, aad_id } = rig?.data || {}

  await setActiveGear('rig', rigId, jumpNumber)

  if (main_canopy_id) {
    await setActiveGear('main_canopy', main_canopy_id, jumpNumber)
    const canopy = getCollection(KEYS.gearItems).find(i => i.id === main_canopy_id)
    if (canopy?.data?.lineset_id) {
      await setActiveGear('lineset', canopy.data.lineset_id, jumpNumber)
    }
  }
  if (reserve_id) await setActiveGear('reserve', reserve_id, jumpNumber)
  if (aad_id) await setActiveGear('aad', aad_id, jumpNumber)
}

// ── Gear Swaps ─────────────────────────────────────────────────────────────

export async function getGearSwaps() {
  return [...getCollection(KEYS.gearSwaps)].sort((a, b) => (a.swapped_at > b.swapped_at ? 1 : -1))
}

export async function getJumpsOnGearItem(gearId, allJumps, allSwaps) {
  const activations = allSwaps
    .filter(s => s.new_gear_id === gearId)
    .sort((a, b) => new Date(a.swapped_at) - new Date(b.swapped_at))

  if (!activations.length) return 0

  const activatedAt = new Date(activations[0].swapped_at)

  const retirements = allSwaps
    .filter(s => s.old_gear_id === gearId)
    .sort((a, b) => new Date(a.swapped_at) - new Date(b.swapped_at))

  const retiredAt = retirements.length ? new Date(retirements[0].swapped_at) : null

  let count = 0
  for (const jump of allJumps) {
    const jumpDate = new Date(jump.date)
    if (jumpDate >= activatedAt && (!retiredAt || jumpDate < retiredAt)) {
      count += jump.number_of_jumps
    }
  }
  return count
}

// ── Templates ──────────────────────────────────────────────────────────────

export async function getTemplates(category) {
  return getCollection(KEYS.templates)
    .filter(t => t.category === category)
    .sort((a, b) => (a.value > b.value ? 1 : -1))
}

export async function addTemplate(category, value) {
  const templates = getCollection(KEYS.templates)
  const item = { id: uid(), category, value }
  templates.push(item)
  saveCollection(KEYS.templates, templates)
  return item
}

export async function deleteTemplate(id) {
  const templates = getCollection(KEYS.templates).filter(t => t.id !== id)
  saveCollection(KEYS.templates, templates)
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function getSettings() {
  return readAll(KEYS.settings)
}

export async function upsertSettings(settings) {
  const current = readAll(KEYS.settings) || {}
  const updated = { ...current, ...settings, updated_at: new Date().toISOString() }
  writeAll(KEYS.settings, updated)
  scheduleBackup()
}

// ── Bulk insert for AI import ───────────────────────────────────────────────

export async function clearAllJumps() {
  saveCollection(KEYS.jumps, [])
}

export async function bulkInsertJumps(jumps) {
  const existing = getCollection(KEYS.jumps)
  const withIds = jumps.map(j => ({ id: uid(), created_at: new Date().toISOString(), ...j }))
  saveCollection(KEYS.jumps, [...existing, ...withIds])
}
