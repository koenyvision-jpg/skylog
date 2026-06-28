import { useState, useEffect } from 'react'
import './App.css'
import { useSupabase } from './hooks/useSupabase'
import { useAlerts } from './hooks/useAlerts'
import { useOfflineQueue } from './hooks/useOfflineQueue'
import { getSettings } from './lib/db'
import LoginPage from './pages/LoginPage'
import LogPage from './pages/LogPage'
import LogbookPage from './pages/LogbookPage'
import GearPage from './pages/GearPage'
import GearCloset from './pages/GearCloset'
import AllGearClosetPage from './pages/AllGearClosetPage'
import SettingsPage from './pages/SettingsPage'
import BottomNav from './components/BottomNav'
import AIAssistant from './components/AIAssistant'

export default function App() {
  const { session, loading, signInWithGoogle, signOut } = useSupabase()
  const [activeTab, setActiveTab] = useState('log')
  const [gearClosetCategory, setGearClosetCategory] = useState(null)
  const [settings, setSettings] = useState(null)
  const [logPrefill, setLogPrefill] = useState(null)
  const { isOnline } = useOfflineQueue()
  const { alerts, criticalCount } = useAlerts(settings)

  useEffect(() => {
    if (session) {
      getSettings().then(s => setSettings(s)).catch(() => {})
    }
  }, [session])

  if (loading) {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!session) {
    return <LoginPage onSignIn={signInWithGoogle} />
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
        return <SettingsPage session={session} settings={settings} onSettingsChange={setSettings} onSignOut={signOut} />
      default:
        return <LogPage settings={settings} prefill={logPrefill} onPrefillConsumed={() => setLogPrefill(null)} />
    }
  }

  return (
    <>
      {!isOnline && (
        <div className="offline-pill">
          <span>●</span> Offline — changes saved locally
        </div>
      )}
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
