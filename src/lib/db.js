import { supabase } from './supabase'

const QUEUE_KEY = 'skylog_offline_queue'

function enqueue(op) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  q.push(op)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export async function flushQueue() {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  if (!q.length) return
  const remaining = []
  for (const op of q) {
    try {
      await replayOp(op)
    } catch {
      remaining.push(op)
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
}

async function replayOp(op) {
  const { table, method, data, id } = op
  if (method === 'insert') {
    const { error } = await supabase.from(table).insert(data)
    if (error) throw error
  } else if (method === 'update') {
    const { error } = await supabase.from(table).update(data).eq('id', id)
    if (error) throw error
  } else if (method === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  } else if (method === 'upsert') {
    const { error } = await supabase.from(table).upsert(data)
    if (error) throw error
  }
}

async function writeOrQueue(table, method, data, id) {
  try {
    await replayOp({ table, method, data, id })
  } catch {
    enqueue({ table, method, data, id })
    throw new Error('offline')
  }
}

// ── Jumps ──────────────────────────────────────────────────────────────────

export async function getJumps({ page = 0, limit = 50, filters = {} } = {}) {
  let q = supabase
    .from('jumps')
    .select('*')
    .order('date', { ascending: false })
    .order('jump_number_start', { ascending: false })
    .range(page * limit, page * limit + limit - 1)

  if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
  if (filters.dateTo)   q = q.lte('date', filters.dateTo)
  if (filters.jumpType) q = q.eq('jump_type', filters.jumpType)
  if (filters.location) q = q.ilike('location', `%${filters.location}%`)

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function getAllJumpsForStats() {
  const { data, error } = await supabase
    .from('jumps')
    .select('date, jump_number_start, jump_number_end, number_of_jumps, gear_snapshot')
    .order('date', { ascending: true })
  if (error) throw error
  return data
}

export async function insertJump(jump) {
  const { data: { session } } = await supabase.auth.getSession()
  const payload = { ...jump, user_id: session.user.id }
  await writeOrQueue('jumps', 'insert', payload)
}

export async function updateJump(id, data) {
  await writeOrQueue('jumps', 'update', data, id)
}

export async function deleteJump(id) {
  await writeOrQueue('jumps', 'delete', null, id)
}

export async function getNextJumpNumber(startingJumpNumber = 1) {
  const { data, error } = await supabase
    .from('jumps')
    .select('jump_number_end')
    .order('jump_number_end', { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) return startingJumpNumber
  return data[0].jump_number_end + 1
}

// ── Gear ───────────────────────────────────────────────────────────────────

export async function getGearItems(category) {
  let q = supabase.from('gear_items').select('*').order('created_at', { ascending: false })
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function insertGearItem(item) {
  const { data: { session } } = await supabase.auth.getSession()
  const payload = { ...item, user_id: session.user.id }
  await writeOrQueue('gear_items', 'insert', payload)
}

export async function updateGearItem(id, data) {
  await writeOrQueue('gear_items', 'update', data, id)
}

export async function retireGearItem(id, reason, salePrice) {
  const data = {
    is_active: false,
    retired_date: new Date().toISOString().split('T')[0],
    retired_reason: reason,
    sale_price: salePrice || null,
  }
  await writeOrQueue('gear_items', 'update', data, id)
}

export async function setActiveGear(category, newId, jumpNumber) {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session.user.id

  // Deactivate current active item and record swap
  const { data: current } = await supabase
    .from('gear_items')
    .select('id')
    .eq('category', category)
    .eq('is_active', true)
    .eq('user_id', userId)

  if (current && current.length > 0) {
    const oldId = current[0].id
    await supabase.from('gear_items').update({ is_active: false }).eq('id', oldId)
    await supabase.from('gear_swaps').insert({
      user_id: userId,
      category,
      old_gear_id: oldId,
      new_gear_id: newId,
      swapped_at: new Date().toISOString(),
      jump_number_at_swap: jumpNumber,
    })
  } else {
    await supabase.from('gear_swaps').insert({
      user_id: userId,
      category,
      old_gear_id: null,
      new_gear_id: newId,
      swapped_at: new Date().toISOString(),
      jump_number_at_swap: jumpNumber,
    })
  }

  await supabase.from('gear_items').update({ is_active: true }).eq('id', newId)
}

export async function setActiveRig(rigId, jumpNumber) {
  const { data: rigRow, error } = await supabase
    .from('gear_items')
    .select('data')
    .eq('id', rigId)
    .single()
  if (error) throw error

  const { main_canopy_id, reserve_id, aad_id } = rigRow.data || {}

  await setActiveGear('rig', rigId, jumpNumber)

  if (main_canopy_id) {
    await setActiveGear('main_canopy', main_canopy_id, jumpNumber)
    const { data: canopy } = await supabase.from('gear_items').select('data').eq('id', main_canopy_id).single()
    if (canopy?.data?.lineset_id) {
      await setActiveGear('lineset', canopy.data.lineset_id, jumpNumber)
    }
  }
  if (reserve_id) await setActiveGear('reserve', reserve_id, jumpNumber)
  if (aad_id)     await setActiveGear('aad', aad_id, jumpNumber)
}

// ── Gear Swaps ─────────────────────────────────────────────────────────────

export async function getGearSwaps() {
  const { data, error } = await supabase
    .from('gear_swaps')
    .select('*')
    .order('swapped_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getJumpsOnGearItem(gearId, allJumps, allSwaps) {
  // Find activation date (when this gear became active)
  const activations = allSwaps
    .filter(s => s.new_gear_id === gearId)
    .sort((a, b) => new Date(a.swapped_at) - new Date(b.swapped_at))

  if (!activations.length) return 0

  const activatedAt = new Date(activations[0].swapped_at)

  // Find retirement date (when this gear was deactivated)
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
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .order('value', { ascending: true })
  if (error) throw error
  return data
}

export async function addTemplate(category, value) {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('templates')
    .insert({ user_id: session.user.id, category, value })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) throw error
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertSettings(settings) {
  const { data: { session } } = await supabase.auth.getSession()
  const payload = { ...settings, user_id: session.user.id, updated_at: new Date().toISOString() }
  await writeOrQueue('settings', 'upsert', payload)
}

// ── Bulk insert for AI import ───────────────────────────────────────────────

export async function clearAllJumps() {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase.from('jumps').delete().eq('user_id', session.user.id)
  if (error) throw error
}

export async function bulkInsertJumps(jumps) {
  const { data: { session } } = await supabase.auth.getSession()
  const payload = jumps.map(j => ({ ...j, user_id: session.user.id }))
  const { error } = await supabase.from('jumps').insert(payload)
  if (error) throw error
}
