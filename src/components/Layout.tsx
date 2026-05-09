import { useNavigate, useLocation } from 'react-router-dom'

// SVG icons inline
const IconMusic = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M5.5 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5.5 9.5V3l6-1.5v6M11.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
)

const IconSetlist = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 6h6M5 8.5h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
)

interface LayoutProps { children: React.ReactNode }

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { label: 'Песни', path: '/', icon: <IconMusic /> },
    { label: 'Сетлисты', path: '/setlists', icon: <IconSetlist /> },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <div style={{
        borderRight: '1px solid var(--hairline)',
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        gap: 2,
      }}>
        {/* Brand */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: 14, fontWeight: 500,
          color: 'var(--text)',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'var(--text)', color: 'var(--bg)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          }}>A</div>
          Arrange
        </div>

        {/* Nav */}
        {navItems.map(item => {
          const active = item.path === '/'
            ? location.pathname === '/' || location.pathname.startsWith('/songs')
            : location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-2)',
                fontSize: 13.5, fontWeight: active ? 500 : 400,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                transition: 'background 120ms',
              }}
            >
              <span style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
