// The landing ships the OIDC client at /auth.js; the admin reuses it at runtime so both share one session.
export interface SessionUser { email: string; name: string; groups: string[]; accessToken: string }
interface AuthModule {
  currentUser(): Promise<SessionUser | null>
  signIn(returnTo?: string): Promise<void>
  signOut(): Promise<void>
}
const url = '/auth.js'
export const auth: Promise<AuthModule> = import(/* @vite-ignore */ url)

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = await (await auth).currentUser()
  if (!user) { await (await auth).signIn(location.pathname); throw new Error('Signing in…') }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { authorization: `Bearer ${user.accessToken}`, 'content-type': 'application/json', ...init.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}
