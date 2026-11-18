import { useEffect, useState } from 'react'
import { api } from './auth'
import { LangSwitch, LOCALE, useT } from './i18n'

type Plan = 'monthly' | 'yearly' | 'lifetime'
type Status = 'active' | 'canceled' | 'past_due' | 'expired'
interface Summary {
  currency: string
  counts: { plus: number; monthly: number; yearly: number; lifetime: number; canceling: number; pastDue: number }
  mrr: number
  revenue: { thisMonth: number; total: number; plusTotal: number; donationsTotal: number; fees: number }
  months: { month: string; plus: number; donations: number }[]
  subscribers: { email: string; plan: Plan; status: Status; periodEnd: string | null; autoRenew: boolean; since: string }[]
  recent: { at: string; kind: 'plus' | 'renewal' | 'donation'; amount: number; plan?: Plan; who: string | null; note?: string }[]
}

const CHIP: Record<Status, string> = { active: 'ot-chip--good', canceled: 'ot-chip--warn', past_due: 'ot-chip--bad', expired: 'ot-chip--neutral' }
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export function Billing() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const { t, lang } = useT()
  const loc = LOCALE[lang]
  const uah = (kop: number) => `${(kop / 100).toLocaleString(loc, { maximumFractionDigits: 0 })} ₴`
  const date = (iso: string) => new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })

  useEffect(() => { api<Summary>('/billing/admin/summary').then(setData).catch((e) => setError(e.message)) }, [])

  const header = (
    <header className="ot-header">
      <h1 className="ot-h2">{t('billing')}</h1>
      <span className="header-lang"><LangSwitch /></span>
    </header>
  )
  if (error) return <>{header}<div className="ot-content"><p className="err">{error}</p></div></>
  if (!data) return <>{header}<div className="ot-content"><p className="ot-text">{t('loading')}</p></div></>

  const { counts, revenue } = data
  const max = Math.max(1, ...data.months.map((m) => m.plus + m.donations))
  const planName = (p: Plan) => t(`plan${cap(p)}` as 'planMonthly')

  return (
    <>
      {header}
      <div className="ot-content">
        <div className="ot-grid">
          <div className="ot-card" data-app="hub">
            <span className="ot-label">{t('subsActive')}</span>
            <div className="ot-stat"><span className="ot-stat__value">{counts.plus}</span>
              <span className="ot-stat__unit">{t('subsSplit', { m: counts.monthly, y: counts.yearly, l: counts.lifetime })}</span></div>
            <div className="inline">
              {counts.canceling > 0 && <span className="ot-chip ot-chip--warn">{t('canceling', { n: counts.canceling })}</span>}
              {counts.pastDue > 0 && <span className="ot-chip ot-chip--bad">{t('pastDue', { n: counts.pastDue })}</span>}
            </div>
          </div>
          <div className="ot-card" data-app="hub">
            <span className="ot-label">{t('mrr')}</span>
            <div className="ot-stat"><span className="ot-stat__value">{uah(data.mrr)}</span><span className="ot-stat__unit">{t('mrrUnit')}</span></div>
          </div>
          <div className="ot-card" data-app="hub">
            <span className="ot-label">{t('revenueMonth')}</span>
            <div className="ot-stat"><span className="ot-stat__value">{uah(revenue.thisMonth)}</span></div>
            <div className="inline">
              <span className="ot-chip ot-chip--neutral">{t('revenueTotal', { v: uah(revenue.total) })}</span>
              <span className="ot-chip ot-chip--neutral">{t('donationsTotal', { v: uah(revenue.donationsTotal) })}</span>
              {revenue.fees > 0 && <span className="ot-chip ot-chip--neutral">{t('feesTotal', { v: uah(revenue.fees) })}</span>}
            </div>
          </div>
        </div>

        {data.months.length > 1 && (
          <div className="ot-card">
            <span className="ot-label">{t('byMonth')}</span>
            <div className="ot-bars" style={{ height: 96, gap: 6 }} role="img" aria-label={t('byMonth')}>
              {data.months.map((m) => (
                <i key={m.month} title={`${m.month}: ${uah(m.plus)} + ${uah(m.donations)}`}
                  style={{ ['--h' as string]: `${Math.max(4, ((m.plus + m.donations) / max) * 100)}%` }} />
              ))}
            </div>
            <span className="ot-caption">{data.months[0]!.month} → {data.months.at(-1)!.month}</span>
          </div>
        )}

        <h2 className="ot-h3">{t('subscribers')}</h2>
        <div className="ot-list">
          {data.subscribers.length === 0 && <div className="ot-row ot-row--empty">{t('noSubscribers')}</div>}
          {data.subscribers.map((s) => (
            <div key={s.email + s.since} className="ot-row">
              <div className="ot-row__body">
                <span className="ot-row__title">{s.email}</span>
                <span className="ot-row__sub">{planName(s.plan)} · {s.periodEnd ? t('until', { date: date(s.periodEnd) }) : t('forLife')}</span>
              </div>
              <span className={`ot-chip ${CHIP[s.status]}`}>{t(`st${cap(s.status)}` as 'stActive')}</span>
            </div>
          ))}
        </div>

        <h2 className="ot-h3">{t('recentPayments')}</h2>
        <div className="ot-list">
          {data.recent.length === 0 && <div className="ot-row ot-row--empty">{t('noPayments')}</div>}
          {data.recent.map((p) => (
            <div key={p.at + p.amount} className="ot-row">
              <div className="ot-row__body">
                <span className="ot-row__title">{p.who ?? t('anonymous')}</span>
                <span className="ot-row__sub">
                  {t(`kind${cap(p.kind)}` as 'kindPlus')}{p.plan ? ` · ${planName(p.plan)}` : ''} · {date(p.at)}{p.note ? ` · “${p.note}”` : ''}
                </span>
              </div>
              <span className="ot-row__value">{uah(p.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
