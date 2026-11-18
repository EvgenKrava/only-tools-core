import { useCallback, useEffect, useState } from 'react'
import { api, type SessionUser } from './auth'
import { Icon } from './icons'
import { APPS, type User } from './types'

const appOf = (g: string) => APPS.find((a) => g.startsWith(`${a.id}-`))

function RoleChips({ groups }: { groups: string[] }) {
  return (
    <span className="chips">
      {groups.includes('platform-admin') && <span className="ot-chip" data-app="hub">admin</span>}
      {groups.filter((g) => g.endsWith('-user')).map((g) => {
        const a = appOf(g)
        return <span key={g} className="ot-chip" data-app={a?.accent}>{a?.name ?? g}</span>
      })}
    </span>
  )
}

export function Users({ me }: { me: SessionUser }) {
  const [users, setUsers] = useState<User[] | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState<User | null>(null)
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async (q = '') => {
    setError('')
    try { setUsers((await api<{ users: User[] }>(`/users${q ? `?search=${encodeURIComponent(q)}` : ''}`)).users) }
    catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setTimeout(() => load(search.trim()), 300); return () => clearTimeout(t) }, [search, load])

  const replace = (u: User) => { setUsers((list) => list?.map((x) => (x.username === u.username ? u : x)) ?? null); setOpen(u) }

  if (open) return <UserDetail user={open} me={me} onBack={() => setOpen(null)} onChange={replace} />
  if (inviting) return <Invite onDone={(u) => { setInviting(false); if (u) { setUsers((l) => [u, ...(l ?? [])]); setOpen(u) } }} />

  return (
    <>
      <header className="ot-header">
        <h1 className="ot-h2">Users</h1>
        <button className="ot-btn ot-btn--sm" onClick={() => setInviting(true)}><Icon name="plus" />Invite</button>
      </header>
      <div className="ot-content">
        <label className="ot-search">
          <Icon name="search" />
          <input className="ot-input" placeholder="Search by email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {error && <p className="err">{error}</p>}
        {users && <p className="ot-caption">{users.length} {users.length === 1 ? 'user' : 'users'}</p>}
        <div className="ot-list">
          {users?.map((u) => (
            <button key={u.username} className="ot-row" onClick={() => setOpen(u)}>
              <span className="ot-avatar">{(u.name || u.email || '?')[0]!.toUpperCase()}</span>
              <span className="ot-row__body">
                <span className="ot-row__title">{u.email}</span>
                <span className="ot-row__sub">{u.providers.join(' + ')}{u.enabled ? '' : ' · disabled'}</span>
                <RoleChips groups={u.groups} />
              </span>
            </button>
          ))}
          {users?.length === 0 && <div className="ot-row ot-row--empty"><span className="ot-row__body">No users found.</span></div>}
        </div>
      </div>
    </>
  )
}

function UserDetail({ user, me, onBack, onChange }: { user: User; me: SessionUser; onBack: () => void; onChange: (u: User) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isMe = user.email === me.email
  const u = encodeURIComponent(user.username)

  const run = async (path: string, method: string) => {
    setBusy(true); setError('')
    try { onChange(await api<User>(path, { method })) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const toggle = (group: string, on: boolean) => run(`/users/${u}/groups/${encodeURIComponent(group)}`, on ? 'PUT' : 'DELETE')
  const has = (g: string) => user.groups.includes(g)

  return (
    <>
      <header className="ot-header">
        <div className="inline">
          <button className="ot-btn ot-btn--icon ot-btn--ghost" onClick={onBack} aria-label="Back"><Icon name="back" /></button>
          <h1 className="ot-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</h1>
        </div>
      </header>
      <div className="ot-content">
        <div className="ot-card">
          <div className="inline">
            <span className={`ot-chip ${user.enabled ? 'ot-chip--good' : 'ot-chip--bad'}`}>{user.enabled ? 'Active' : 'Disabled'}</span>
            <span className="ot-chip ot-chip--neutral">{user.providers.join(' + ')}</span>
            {user.createdAt && <span className="ot-caption">Joined {new Date(user.createdAt).toLocaleDateString()}</span>}
          </div>
          {error && <p className="err">{error}</p>}
        </div>

        <div className="ot-card">
          <h2 className="ot-h3">Roles</h2>
          <div className="role-grid">
            <span className="head">App</span><span className="head">Access</span><span className="head">Admin</span>
            {APPS.map((a) => (
              <div key={a.id} style={{ display: 'contents' }} data-app={a.accent}>
                <span className="inline"><span className="ot-appicon" data-app={a.accent} />{a.name}</span>
                <input type="checkbox" className="ot-switch" disabled={busy} checked={has(`${a.id}-user`)}
                  onChange={(e) => toggle(`${a.id}-user`, e.target.checked)} aria-label={`${a.name} access`} />
                <input type="checkbox" className="ot-switch" disabled={busy} checked={has(`${a.id}-admin`)}
                  onChange={(e) => toggle(`${a.id}-admin`, e.target.checked)} aria-label={`${a.name} admin`} />
              </div>
            ))}
            <span className="inline"><b>Only Tools admin</b></span>
            <span />
            <input type="checkbox" className="ot-switch" disabled={busy || isMe} checked={has('platform-admin')}
              onChange={(e) => toggle('platform-admin', e.target.checked)} aria-label="Platform admin" />
          </div>
          <p className="ot-hint">Changes reach the user's apps within an hour, or right away after "Sign out everywhere".</p>
        </div>

        <div className="ot-card">
          <h2 className="ot-h3">Account</h2>
          <div className="inline">
            <button className="ot-btn ot-btn--sm ot-btn--outline" disabled={busy} onClick={() => run(`/users/${u}/signout`, 'POST')}>Sign out everywhere</button>
            {!isMe && (user.enabled
              ? <button className="ot-btn ot-btn--sm ot-btn--danger" disabled={busy} onClick={() => confirm(`Disable ${user.email}? They lose access to every app.`) && run(`/users/${u}/disable`, 'POST')}>Disable account</button>
              : <button className="ot-btn ot-btn--sm" disabled={busy} onClick={() => run(`/users/${u}/enable`, 'POST')}>Enable account</button>)}
          </div>
        </div>
      </div>
    </>
  )
}

function Invite({ onDone }: { onDone: (u?: User) => void }) {
  const [email, setEmail] = useState('')
  const [groups, setGroups] = useState<string[]>(['carlog-user', 'foodlog-user'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const flip = (g: string) => setGroups((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { onDone(await api<User>('/users', { method: 'POST', body: JSON.stringify({ email, groups }) })) }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <header className="ot-header">
        <div className="inline">
          <button className="ot-btn ot-btn--icon ot-btn--ghost" onClick={() => onDone()} aria-label="Back"><Icon name="back" /></button>
          <h1 className="ot-h2">Invite</h1>
        </div>
      </header>
      <form className="ot-content" onSubmit={submit}>
        <div className="ot-card">
          <label className="ot-field">
            <span className="ot-label">Email</span>
            <input className="ot-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            <span className="ot-hint">They get an email with a temporary password for onlytools.click.</span>
          </label>
          <span className="ot-label">Access</span>
          {APPS.map((a) => (
            <label key={a.id} className="inline" style={{ justifyContent: 'space-between' }}>
              <span>{a.name}</span>
              <input type="checkbox" className="ot-switch" checked={groups.includes(`${a.id}-user`)} onChange={() => flip(`${a.id}-user`)} />
            </label>
          ))}
          {error && <p className="err">{error}</p>}
          <button className="ot-btn ot-btn--block" disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</button>
        </div>
      </form>
    </>
  )
}
