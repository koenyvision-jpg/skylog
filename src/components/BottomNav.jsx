const TABS = [
  { id: 'log',      label: 'Log',      icon: '✈️' },
  { id: 'logbook',  label: 'Logbook',  icon: '📖' },
  { id: 'gear',     label: 'Gear',     icon: '🪂' },
  { id: 'closet',   label: 'Closet',   icon: '🧳' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function BottomNav({ activeTab, onTabChange, alertCount = 0 }) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: 'rgba(10, 10, 20, 0.85)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px 20px 0 0',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      zIndex: 50,
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        const showBadge = tab.id === 'gear' && alertCount > 0
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '12px 0 10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 22, position: 'relative', display: 'inline-block' }}>
              {tab.icon}
              {showBadge && (
                <span style={{
                  position: 'absolute',
                  top: -2, right: -4,
                  width: 8, height: 8,
                  background: 'var(--danger)',
                  borderRadius: '50%',
                  border: '1.5px solid #0a0a0f',
                }} />
              )}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              letterSpacing: '0.3px',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
