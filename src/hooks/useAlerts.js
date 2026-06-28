import { useState, useEffect } from 'react'
import { getGearItems, getAllJumpsForStats, getGearSwaps, getJumpsOnGearItem } from '../lib/db'
import { evaluateAlerts } from '../lib/alerts'

export function useAlerts(settings) {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    async function run() {
      try {
        const [gear, allJumps, swaps] = await Promise.all([
          getGearItems(),
          getAllJumpsForStats(),
          getGearSwaps(),
        ])
        const jumpsOnItems = {}
        for (const item of gear) {
          jumpsOnItems[item.id] = await getJumpsOnGearItem(item.id, allJumps, swaps)
        }
        setAlerts(evaluateAlerts(gear, jumpsOnItems, settings))
      } catch {
        // Silently skip alerts if data not available
      }
    }
    run()
  }, [settings])

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount = alerts.filter(a => a.severity === 'warning').length

  return { alerts, criticalCount, warningCount }
}
