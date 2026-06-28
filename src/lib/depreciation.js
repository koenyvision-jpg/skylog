export function calcDepreciation(item, jumpsOnItem) {
  const jumpWear = item.lifespan_jumps ? jumpsOnItem / item.lifespan_jumps : 0
  const yearsOld = item.purchase_date
    ? (Date.now() - new Date(item.purchase_date).getTime()) / (365.25 * 86400 * 1000)
    : 0
  const ageWear = item.lifespan_years ? yearsOld / item.lifespan_years : 0
  const rate = Math.min(Math.max(jumpWear, ageWear), 1)
  const currentValue = Math.max((item.purchase_price ?? 0) * (1 - rate), 0)
  return { rate, currentValue, jumpWear, ageWear }
}

export function depreciationColor(rate) {
  if (rate >= 0.85) return 'danger'
  if (rate >= 0.6)  return 'warning'
  return 'good'
}
