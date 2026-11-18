import { useEffect, useState } from 'react'
import { api } from './auth'

interface Alarm { name: string; app: string; state: string; reason?: string; updatedAt?: string; description?: string }
interface Entry { app: string; fn: string; time: string; message: string }
interface Result { hours: number; alarms: Alarm[]; entries: Entry[] }

const ACCENT: Record<string, string> = { core: 'hub', carlog: 'car', gighunter: 'gig', foodlog: 'food' }
const NAME: Record<string, string> = { core: 'Core', carlog: 'CarLog', gighunter: 'GigHunter', foodlog: 'FoodLog', other: 'Other' }
const WINDOWS = [{ hours: 1, label: '1 h' }, { hours: 24, label: '24 h' }, { hours: 168, label: '7 days' }]

/** Strip the Lambda log prefix ("2026-…Z\t<request id>\tERROR\t") so the message itself is first. */
const clean = (m: string) => m.replace(/^\S+Z\t\S+\t(ERROR|WARN|INFO)\t/, '').trim()

export function Errors() {
  const [hours, setHours] = useState(24)
  const [data, setData] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true); setError('')
    api<Result>(`/errors?hours=${hours}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [hours])

  const firing = data?.alarms.filter((a) => a.state === 'ALARM') ?? []

  return (
    <>
      <header className="ot-header">
        <h1 className="ot-h2">Errors</h1>
        <div className="ot-segment" role="group" aria-label="Time window">
          {WINDOWS.map((w) => (
            <button key={w.hours} aria-pressed={hours === w.hours} onClick={() => setHours(w.hours)}>{w.label}</button>
          ))}
        </div>
      </header>
      <div className="ot-content">
        {error && <p className="err">{error}</p>}
        {loading && !data && <p className="ot-text">Searching the logs…</p>}
        {data && (
          <>
            <div className="ot-card">
              <div className="inline" style={{ justifyContent: 'space-between' }}>
                <h2 className="ot-h3">Alarms</h2>
                {firing.length ? <span className="ot-chip ot-chip--bad">{firing.length} firing</span> : <span className="ot-chip ot-chip--good">All OK</span>}
              </div>
              <div className="ot-list">
                {data.alarms.map((a) => (
                  <div key={a.name} className="ot-row" style={{ cursor: 'default' }} data-app={ACCENT[a.app]}>
                    <span className="ot-row__body">
                      <span className="ot-row__title">{a.name}</span>
                      <span className="ot-row__sub">{a.description || a.reason}</span>
                    </span>
                    <span className={`ot-chip ${a.state === 'ALARM' ? 'ot-chip--bad' : a.state === 'OK' ? 'ot-chip--good' : 'ot-chip--warn'}`}>{a.state}</span>
                  </div>
                ))}
                {!data.alarms.length && <p className="ot-caption">No alarms are set up.</p>}
              </div>
            </div>

            <div className="inline" style={{ justifyContent: 'space-between' }}>
              <h2 className="ot-h3">Error log lines</h2>
              <span className="ot-caption">{loading ? 'Updating…' : `${data.entries.length}${data.entries.length === 100 ? '+' : ''} in the last ${WINDOWS.find((w) => w.hours === data.hours)?.label}`}</span>
            </div>
            <div className="ot-list">
              {data.entries.map((e, i) => (
                <button key={i} className="ot-row" style={{ alignItems: 'flex-start' }} onClick={() => setOpen(open === i ? null : i)} data-app={ACCENT[e.app]}>
                  <span className="ot-chip" style={{ flex: 'none' }}>{NAME[e.app] ?? e.app}</span>
                  <span className="ot-row__body">
                    <span className="ot-row__sub">{new Date(e.time).toLocaleString()} · {e.fn}</span>
                    {open === i
                      ? <pre className="logline">{clean(e.message)}</pre>
                      : <span className="ot-row__title" style={{ fontWeight: 700 }}>{clean(e.message).split('\n')[0]}</span>}
                  </span>
                </button>
              ))}
              {!data.entries.length && <div className="ot-row ot-row--empty"><span className="ot-row__body">No errors in this window.</span></div>}
            </div>
          </>
        )}
      </div>
    </>
  )
}
