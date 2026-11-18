// Tiny OIDC (authorization code + PKCE) client for the shared Only Tools pool. No dependencies.
const KEY = 'ot.session'
let cfgPromise
const config = () => (cfgPromise ??= fetch('/config.json').then((r) => r.json()))

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)))
const decode = (jwt) => JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
const redirectUri = () => `${location.origin}/auth/callback`

export async function signIn(returnTo = location.pathname) {
  const { domain, clientId } = await config()
  const verifier = random(48)
  const state = random(16)
  sessionStorage.setItem('ot.pkce', JSON.stringify({ verifier, state, returnTo }))
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const q = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri(), scope: 'openid email profile',
    state, code_challenge: challenge, code_challenge_method: 'S256',
  })
  location.assign(`https://${domain}/oauth2/authorize?${q}`)
}

async function token(body) {
  const { domain, clientId } = await config()
  const res = await fetch(`https://${domain}/oauth2/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...body }),
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  return res.json()
}

const save = (t, refresh) => {
  const s = { idToken: t.id_token, accessToken: t.access_token, refreshToken: t.refresh_token ?? refresh, expiresAt: Date.now() + t.expires_in * 1000 }
  localStorage.setItem(KEY, JSON.stringify(s))
  return s
}

export async function handleCallback() {
  const p = new URLSearchParams(location.search)
  const saved = JSON.parse(sessionStorage.getItem('ot.pkce') ?? 'null')
  sessionStorage.removeItem('ot.pkce')
  if (!saved || p.get('state') !== saved.state || !p.get('code')) throw new Error(p.get('error_description') ?? 'Sign-in failed')
  save(await token({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), code_verifier: saved.verifier }))
  return saved.returnTo || '/'
}

/** Current user ({ email, name, groups, accessToken }) or null; refreshes tokens when they are about to expire. */
export async function currentUser() {
  let s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  if (!s) return null
  if (s.expiresAt < Date.now() + 60_000) {
    try { s = save(await token({ grant_type: 'refresh_token', refresh_token: s.refreshToken }), s.refreshToken) }
    catch { localStorage.removeItem(KEY); return null }
  }
  const c = decode(s.idToken)
  return { email: c.email, name: c.name ?? c.email, groups: c['cognito:groups'] ?? [], accessToken: s.accessToken }
}

export async function signOut() {
  const { domain, clientId } = await config()
  localStorage.removeItem(KEY)
  location.assign(`https://${domain}/logout?${new URLSearchParams({ client_id: clientId, logout_uri: `${location.origin}/` })}`)
}
