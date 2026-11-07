export const ALTITUDE_OPTIONS = {
  ft: { min: 1000, max: 25000, step: 1000, defaultValue: 14000 },
  m: { min: 500, max: 7500, step: 250, defaultValue: 4250 },
}

export function defaultAltitude(unit = 'ft') {
  return (ALTITUDE_OPTIONS[unit] || ALTITUDE_OPTIONS.ft).defaultValue
}
