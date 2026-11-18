import { useEffect, useState } from 'react'
import { auth, type SessionUser } from './auth'
import { Icon } from './icons'
import { Users } from './Users'
import { Overview } from './Overview'

type Tab = 'overview' | 'users' | 'settings'

export function App() {
  const [me, setMe] = useState<SessionUser | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    auth.then(async (a) => {
      const u = await a.currentUser()
      if (!u) return a.signIn(location.pathname)
      setMe(u)
    }).catch(() => setMe(null))
  }, [])

  if (me === undefined) return <div className="center"><p className="ot-text">Loading…</p></div>
  if (!me || !me.groups.includes('platform-admin'))
    return (
      <div className="center"><div className="stack" style={{ alignItems: 'center' }}>
        <h1 className="ot-h2">No access</h1>
        <p className="ot-text">The admin panel is for Only Tools administrators.</p>
        <a className="ot-btn" href="/">Back to Only Tools</a>
      </div></div>
    )

  const item = (id: Tab, label: string, icon: string, soon = false) => (
    <button className={`ot-nav__item${tab === id ? ' is-active' : ''}`} aria-current={tab === id ? 'page' : undefined}
      onClick={() => setTab(id)} disabled={soon} style={soon ? { opacity: 0.45 } : undefined}>
      <span className="ot-nav__pill"><Icon name={icon} /></span>{label}
    </button>
  )

  return (
    <div className="ot-shell">
      <div className="ot-layout">
        <nav className="ot-nav" aria-label="Admin">
          <a className="ot-brand ot-nav__brand" href="/"><b className="ot-logo" aria-hidden="true"><i /><i /><i /><i /></b><span>Admin</span></a>
          {item('overview', 'Overview', 'chart')}
          {item('users', 'Users', 'users')}
          {item('settings', 'Settings', 'gear', true)}
          <span className="ot-nav__spacer" />
          <a className="ot-nav__item" href="/"><span className="ot-nav__pill"><Icon name="home" /></span>Only Tools</a>
        </nav>
        <main className="ot-main">
          {tab === 'overview' && <Overview />}
          {tab === 'users' && <Users me={me} />}
        </main>
      </div>
    </div>
  )
}
