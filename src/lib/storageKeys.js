export const KEYS = {
  jumps: 'skylog_jumps',
  gearItems: 'skylog_gear_items',
  gearSwaps: 'skylog_gear_swaps',
  templates: 'skylog_templates',
  settings: 'skylog_settings',
  // Device-only: never included in the GitHub backup or exports.
  anthropicApiKey: 'skylog_anthropic_api_key',
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
