import { useEffect, useState } from 'react'
import { api } from './auth'
import { LangSwitch, LOCALE, useT } from './i18n'

interface Snapshot {
  generatedAt: string
  currency: string
  budget: number
  cost: {
    monthToDate: number
    forecast: number | null
    lastMonth: number
    byApp: Record<string, { monthToDate: number; lastMonth: number }>
    daily: { date: string; amount: number }[]
  }
  apps: { id: string; name: string; users: number | null; legacyUsers: number | null; invocations7d: number; errors7d: number; invocations30d: number; daily: number[] }[]
}

const ACCENT: Record<string, string> = { core: 'hub', carlog: 'car', gighunter: 'gig', foodlog: 'food' }
const usd = (n: number) => `$${n.toFixed(2)}`

function Bars({ values, highlightLast = false, label }: { values: number[]; highlightLast?: boolean; label: string }) {
  const max = Math.max(...values, 0)
  return (
    <div className="ot-bars" style={{ height: 72, gap: 3 }} role="img" aria-label={label}>
      {values.map((v, i) => (
        <i key={i} className={highlightLast && i === values.length - 1 ? 'is-today' : undefined}
          style={{ ['--h' as string]: `${max ? Math.max(4, (v / max) * 100) : 4}%` }} title={String(v)} />
      ))}
    </div>
  )
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return <div className="ot-stat"><span className="ot-stat__value" style={{ fontSize: 26 }}>{value}</span><span className="ot-stat__unit">{unit}</span></div>
}

export function Overview() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { t, lang } = useT()
  const num = (n: number) => n.toLocaleString(LOCALE[lang])

  useEffect(() => { api<Snapshot>('/stats').then(setSnap).catch((e) => setError(e.message)) }, [])

  const refresh = async () => {
    setBusy(true); setNote('')
    try { setSnap(await api<Snapshot>('/stats/refresh', { method: 'POST' })) } catch (e) { setNote((e as Error).message) } finally { setBusy(false) }
  }

  if (error) return <div className="ot-content" style={{ paddingTop: 24 }}><p className="err">{error}</p></div>
  if (!snap) return <div className="ot-content" style={{ paddingTop: 24 }}><p className="ot-text">{t('loading')}</p></div>

  const { cost, budget } = snap
  const used = budget ? Math.min(100, (cost.monthToDate / budget) * 100) : 0
  const forecastOver = cost.forecast !== null && budget > 0 && cost.forecast > budget
  const totalUsers = snap.apps.reduce((s, a) => s + (a.users ?? 0), 0)

  return (
    <>
      <header className="ot-header">
        <h1 className="ot-h2">{t('overview')}</h1>
        <div className="inline"><span className="header-lang"><LangSwitch /></span>
        <button className="ot-btn ot-btn--sm ot-btn--outline" onClick={refresh} disabled={busy}>{busy ? t('refreshing') : t('refresh')}</button></div>
      </header>
      <div className="ot-content">
        <p className="ot-caption">{t('updated', { when: new Date(snap.generatedAt).toLocaleString(LOCALE[lang]) })}{note ? ` · ${note}` : ''}</p>

        <div className="ot-grid">
          <div className="ot-card" data-app="hub">
            <span className="ot-label">{t('awsMonth')}</span>
            <div className="ot-stat">
              <span className="ot-stat__value">{usd(cost.monthToDate)}</span>
              <span className="ot-stat__unit">{t('ofBudget', { budget: usd(budget) })}</span>
            </div>
            <div className="ot-progress"><i style={{ ['--p' as string]: `${used}%` }} /></div>
            <div className="inline">
              {cost.forecast !== null && <span className={`ot-chip ${forecastOver ? 'ot-chip--bad' : 'ot-chip--good'}`}>{t('forecast', { v: usd(cost.forecast) })}</span>}
              <span className="ot-chip ot-chip--neutral">{t('lastMonth', { v: usd(cost.lastMonth) })}</span>
            </div>
          </div>

          <div className="ot-card" data-app="hub">
            <span className="ot-label">{t('dailyCost')}</span>
            <Bars values={cost.daily.map((d) => d.amount)} highlightLast label={t('dailyCostAria')} />
            <span className="ot-caption">{t('costLag')}</span>
          </div>

          <div className="ot-card" data-app="hub">
            <span className="ot-label">{t('accounts')}</span>
            <div className="ot-stat"><span className="ot-stat__value">{num(totalUsers)}</span><span className="ot-stat__unit">{t('accountsUnit')}</span></div>
            <span className="ot-caption">{t('accountsHint')}</span>
          </div>
        </div>

        <h2 className="ot-h3" style={{ marginTop: 8 }}>{t('apps')}</h2>
        <div className="ot-grid">
          {snap.apps.map((a) => {
            const c = cost.byApp[a.id]
            return (
              <div key={a.id} className="ot-card" data-app={ACCENT[a.id]}>
                <div className="inline" style={{ justifyContent: 'space-between' }}>
                  <h3 className="ot-h3">{a.name}</h3>
                  {a.errors7d > 0 ? <span className="ot-chip ot-chip--bad">{t('errors7d', { n: num(a.errors7d) })}</span> : <span className="ot-chip ot-chip--good">{t('noErrors')}</span>}
                </div>
                <div className="stats">
                  {a.users !== null && <Stat value={num(a.users)} unit={t('usersUnit')} />}
                  {a.legacyUsers !== null && <Stat value={num(a.legacyUsers)} unit={t('ownSignIn')} />}
                  <Stat value={num(a.invocations7d)} unit={t('requests7d')} />
                  <Stat value={c ? usd(c.monthToDate) : '—'} unit={t('thisMonth')} />
                </div>
                <Bars values={a.daily} label={t('requestsAria', { app: a.name })} />
                <span className="ot-caption">{t('requestsDaily')}</span>
              </div>
            )
          })}
          {cost.byApp.other && (
            <div className="ot-card ot-card--flat">
              <h3 className="ot-h3">{t('shared')}</h3>
              <Stat value={usd(cost.byApp.other.monthToDate)} unit={t('sharedUnit')} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
