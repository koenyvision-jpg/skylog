export function evaluateAlerts(gearItems, jumpsOnItems, settings) {
  const alerts = []
  const today = new Date()

  const s = {
    reserveRepackWarningDays: settings?.reserve_repack_warning_days ?? 30,
    linesetWarningJumps: settings?.lineset_warning_jumps ?? 20,
    aadServiceWarningDays: settings?.aad_service_warning_days ?? 60,
    aadBatteryWarningDays: settings?.aad_battery_warning_days ?? 60,
  }

  for (const item of gearItems) {
    if (item.retired_date) continue
    const jumps = jumpsOnItems[item.id] ?? 0

    if (item.category === 'reserve') {
      const d = item.data
      if (d?.last_repack_date && d?.repack_validity_months) {
        const repackDate = new Date(d.last_repack_date)
        const expiryDate = new Date(repackDate)
        expiryDate.setMonth(expiryDate.getMonth() + Number(d.repack_validity_months))
        const daysUntil = Math.ceil((expiryDate - today) / 86400000)
        if (daysUntil <= 0) {
          alerts.push({ id: `reserve-expired-${item.id}`, severity: 'critical', category: 'reserve', gearId: item.id, message: `Reserve repack expired ${Math.abs(daysUntil)} days ago — ${item.label || 'Reserve'}` })
        } else if (daysUntil <= s.reserveRepackWarningDays) {
          alerts.push({ id: `reserve-soon-${item.id}`, severity: 'warning', category: 'reserve', gearId: item.id, message: `Reserve repack expires in ${daysUntil} days — ${item.label || 'Reserve'}` })
        }
      }
    }

    if (item.category === 'lineset') {
      const d = item.data
      if (d?.max_jumps) {
        const remaining = Number(d.max_jumps) - jumps
        if (remaining <= 0) {
          alerts.push({ id: `lineset-exceeded-${item.id}`, severity: 'critical', category: 'lineset', gearId: item.id, message: `Lineset max jumps exceeded — ${item.label || 'Lineset'}` })
        } else if (remaining <= s.linesetWarningJumps) {
          alerts.push({ id: `lineset-soon-${item.id}`, severity: 'warning', category: 'lineset', gearId: item.id, message: `${remaining} jumps remaining on lineset — ${item.label || 'Lineset'}` })
        }
      }
    }

    if (item.category === 'aad') {
      const d = item.data
      if (d?.last_service_date && d?.service_interval_years) {
        const service = new Date(d.last_service_date)
        const nextService = new Date(service)
        nextService.setFullYear(nextService.getFullYear() + Number(d.service_interval_years))
        const daysUntil = Math.ceil((nextService - today) / 86400000)
        if (daysUntil <= 0) {
          alerts.push({ id: `aad-service-${item.id}`, severity: 'critical', category: 'aad', gearId: item.id, message: `AAD service overdue — ${item.label || 'AAD'}` })
        } else if (daysUntil <= s.aadServiceWarningDays) {
          alerts.push({ id: `aad-service-soon-${item.id}`, severity: 'warning', category: 'aad', gearId: item.id, message: `AAD service due in ${daysUntil} days — ${item.label || 'AAD'}` })
        }
      }
      if (d?.battery_replacement_date) {
        const battDate = new Date(d.battery_replacement_date)
        const daysUntil = Math.ceil((battDate - today) / 86400000)
        if (daysUntil <= s.aadBatteryWarningDays) {
          alerts.push({ id: `aad-battery-${item.id}`, severity: 'warning', category: 'aad', gearId: item.id, message: `AAD battery replacement due in ${daysUntil} days — ${item.label || 'AAD'}` })
        }
      }
    }
  }

  return alerts
}

export function alertsForCategory(alerts, category) {
  return alerts.filter(a => a.category === category)
}
