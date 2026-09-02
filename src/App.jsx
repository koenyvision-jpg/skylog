import { useState, useEffect } from 'react'
import './App.css'
import { useAlerts } from './hooks/useAlerts'
import { getSettings } from './lib/db'
import { hasLocalData, isGithubConfigured, restoreFromGithub } from './lib/githubBackup'
import LogPage from './pages/LogPage'
import LogbookPage from './pages/LogbookPage'
import GearPage from './pages/GearPage'
import GearCloset from './pages/GearCloset'
import AllGearClosetPage from './pages/AllGearClosetPage'
import SettingsPage from './pages/SettingsPage'
import BottomNav from './components/BottomNav'
import AIAssistant from './components/AIAssistant'

export default function App() {
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState('log')
  const [gearClosetCategory, setGearClosetCategory] = useState(null)
  const [settings, setSettings] = useState(null)
  const [logPrefill, setLogPrefill] = useState(null)
  const { alerts, criticalCount } = useAlerts(settings)

  useEffect(() => {
    const init = async () => {
      if (!hasLocalData() && isGithubConfigured()) {
        try { await restoreFromGithub() } catch { /* fall through to empty state */ }
      }
      const s = await getSettings().catch(() => null)
      setSettings(s)
      setReady(true)
    }
    init()
  }, [])

  if (!ready) {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  const handleOpenGearCloset = (category) => {
    setGearClosetCategory(category)
  }

  const handleCloseGearCloset = () => {
    setGearClosetCategory(null)
  }

  const handleAILogPrefill = (data) => {
    setLogPrefill(data)
    setActiveTab('log')
  }

  const renderPage = () => {
    if (gearClosetCategory) {
      return <GearCloset category={gearClosetCategory} onBack={handleCloseGearCloset} settings={settings} />
    }
    switch (activeTab) {
      case 'log':
        return <LogPage settings={settings} prefill={logPrefill} onPrefillConsumed={() => setLogPrefill(null)} />
      case 'logbook':
        return <LogbookPage settings={settings} />
      case 'gear':
        return <GearPage onOpenCloset={handleOpenGearCloset} alerts={alerts} settings={settings} />
      case 'closet':
        return <AllGearClosetPage onOpenCloset={handleOpenGearCloset} />
      case 'settings':
        return <SettingsPage settings={settings} onSettingsChange={setSettings} />
      default:
        return <LogPage settings={settings} prefill={logPrefill} onPrefillConsumed={() => setLogPrefill(null)} />
    }
  }

  return (
    <>
      {renderPage()}
      {!gearClosetCategory && (
        <>
          <BottomNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            alertCount={criticalCount}
          />
          <AIAssistant
            settings={settings}
            onLogPrefill={handleAILogPrefill}
          />
        </>
      )}
    </>
  )
}
