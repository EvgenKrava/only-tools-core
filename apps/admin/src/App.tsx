import { useEffect, useState } from 'react'
import { auth, type SessionUser } from './auth'
import { Icon } from './icons'
import { Users } from './Users'
import { Overview } from './Overview'
import { Errors } from './Errors'
import { LangSwitch, useT } from './i18n'

type Tab = 'overview' | 'users' | 'errors' | 'settings'

export function App() {
  const [me, setMe] = useState<SessionUser | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('overview')
  const { t } = useT()

  useEffect(() => {
    auth.then(async (a) => {
      const u = await a.currentUser()
      if (!u) return a.signIn(location.pathname)
      setMe(u)
    }).catch(() => setMe(null))
  }, [])

  if (me === undefined) return <div className="center"><p className="ot-text">{t('loading')}</p></div>
  if (!me || !me.groups.includes('platform-admin'))
    return (
      <div className="center"><div className="stack" style={{ alignItems: 'center' }}>
        <h1 className="ot-h2">{t('noAccess')}</h1>
        <p className="ot-text">{t('noAccessText')}</p>
        <LangSwitch />
        <a className="ot-btn" href="/">{t('backHome')}</a>
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
          {item('overview', t('overview'), 'chart')}
          {item('users', t('users'), 'users')}
          {item('errors', t('errors'), 'alert')}
          {item('settings', t('settings'), 'gear', true)}
          <span className="ot-nav__spacer" />
          <div className="nav-lang"><LangSwitch /></div>
          <a className="ot-nav__item" href="/"><span className="ot-nav__pill"><Icon name="home" /></span>Only Tools</a>
        </nav>
        <main className="ot-main">
          {tab === 'overview' && <Overview />}
          {tab === 'users' && <Users me={me} />}
          {tab === 'errors' && <Errors />}
        </main>
      </div>
    </div>
  )
}
