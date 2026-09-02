export const KEYS = {
  jumps: 'skylog_jumps',
  gearItems: 'skylog_gear_items',
  gearSwaps: 'skylog_gear_swaps',
  templates: 'skylog_templates',
  settings: 'skylog_settings',
}

export function readAll(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

export function writeAll(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
