import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda'
import * as cognito from './cognito'
import { buildSnapshot, loadSnapshot, saveSnapshot } from './stats'
import { alarms, recentErrors } from './errors'
import { APPS, PLATFORM_ADMIN, ROLES, HttpError, assertCanChange, isRole, parseGroups } from './roles'

type Event = APIGatewayProxyEventV2WithJWTAuthorizer
const json = (status: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode: status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body),
})

export async function handler(event: Event): Promise<APIGatewayProxyResultV2> {
  try {
    return await route(event)
  } catch (e) {
    const status = e instanceof HttpError ? e.status : (e as { status?: number }).status ?? 500
    if (status >= 500) console.error(e)
    const name = (e as { name?: string }).name
    if (name === 'UsernameExistsException') return json(409, { error: 'This email already has an account.' })
    return json(status, { error: status >= 500 ? 'Something went wrong' : (e as Error).message })
  }
}

async function route(event: Event): Promise<APIGatewayProxyResultV2> {
  const claims = event.requestContext.authorizer.jwt.claims
  const actor = { sub: String(claims.sub), groups: parseGroups(claims['cognito:groups']) }
  const method = event.requestContext.http.method
  const path = event.rawPath.replace(/^\/api/, '') || '/'
  const body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {}

  if (method === 'GET' && path === '/me') return json(200, actor)
  if (!actor.groups.includes(PLATFORM_ADMIN)) throw new HttpError(403, 'Admins only')

  if (method === 'GET' && path === '/roles') return json(200, { roles: ROLES, apps: APPS })
  if (method === 'GET' && path === '/stats') {
    let snap = await loadSnapshot()
    if (!snap) { snap = await buildSnapshot(); await saveSnapshot(snap) }
    return json(200, snap)
  }
  if (method === 'POST' && path === '/stats/refresh') {
    const snap = await loadSnapshot()
    const ageMs = snap ? Date.now() - Date.parse(snap.generatedAt) : Infinity
    // Each refresh costs two Cost Explorer calls ($0.02); allow one every 6 hours.
    if (ageMs < 6 * 3_600_000) throw new HttpError(429, `Fresh enough: refreshed ${Math.round(ageMs / 60_000)} min ago. Next refresh in ${Math.ceil((6 * 3_600_000 - ageMs) / 60_000)} min.`)
    const fresh = await buildSnapshot()
    await saveSnapshot(fresh)
    return json(200, fresh)
  }
  if (method === 'GET' && path === '/errors') {
    const hours = Math.min(168, Math.max(1, Number(event.queryStringParameters?.hours ?? 24) || 24))
    const [a, e] = await Promise.all([alarms(), recentErrors(hours)])
    return json(200, { hours, alarms: a, entries: e })
  }
  if (method === 'GET' && path === '/users') return json(200, { users: await cognito.listUsers(event.queryStringParameters?.search) })
  if (method === 'POST' && path === '/users') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const groups: string[] = Array.isArray(body.groups) ? body.groups.filter(isRole) : []
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Enter a valid email.')
    const username = await cognito.invite(email, groups)
    return json(201, await cognito.getUser(username))
  }

  const m = path.match(/^\/users\/([^/]+)(?:\/(groups)\/([^/]+)|\/(enable|disable|signout))?$/)
  if (!m) throw new HttpError(400, 'Unknown request')
  const username = decodeURIComponent(m[1]!)
  const target = await cognito.getUser(username)

  if (method === 'GET' && !m[2] && !m[4]) return json(200, target)
  if (m[2]) {
    const group = decodeURIComponent(m[3]!)
    if (!isRole(group)) throw new HttpError(400, 'Unknown role')
    if (method === 'PUT') { assertCanChange(actor.sub, target.sub, group, 'add'); await cognito.addToGroup(username, group) }
    else if (method === 'DELETE') { assertCanChange(actor.sub, target.sub, group, 'remove'); await cognito.removeFromGroup(username, group) }
    else throw new HttpError(405, 'Method not allowed')
  } else if (method === 'POST' && m[4]) {
    const action = m[4] as 'enable' | 'disable' | 'signout'
    if (action === 'signout') { assertCanChange(actor.sub, target.sub, null, 'signout'); await cognito.signOutEverywhere(username) }
    else { assertCanChange(actor.sub, target.sub, null, action === 'disable' ? 'disable' : 'add'); await cognito.setEnabled(username, action === 'enable') }
  } else throw new HttpError(405, 'Method not allowed')
  return json(200, await cognito.getUser(username))
}
