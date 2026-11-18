import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { BillingError, type Actor } from './billing'
import { emailOf, getBilling } from './deps'
import { isPlan } from './plans'

type Event = APIGatewayProxyEventV2 & { requestContext: { authorizer?: { jwt?: { claims: Record<string, unknown> } } } }

const json = (status: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode: status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body),
})

function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String)
  if (typeof claim !== 'string' || !claim) return []
  return claim.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
}

export async function handler(event: Event): Promise<APIGatewayProxyResultV2> {
  try {
    return await route(event)
  } catch (e) {
    const status = e instanceof BillingError ? e.status : 500
    if (status >= 500 && status !== 503) console.error(e)
    // The site's CloudFront turns 404 into the HTML 404 page, so unknown routes answer 400.
    return json(status, { error: status >= 500 && status !== 503 ? 'Something went wrong' : (e as Error).message })
  }
}

async function route(event: Event): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method
  const path = event.rawPath.replace(/^\/api\/billing/, '') || '/'
  const raw = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8')) : Buffer.alloc(0)
  const body = () => { try { return raw.length ? JSON.parse(raw.toString('utf8')) : {} } catch { throw new BillingError(400, 'Bad JSON') } }
  const { billing, verify } = await getBilling()

  // Public routes (no sign-in).
  if (method === 'POST' && path === '/webhook') {
    if (!(await verify(raw, event.headers['x-sign']))) { console.warn('bad webhook signature'); return json(401, { error: 'bad signature' }) }
    await billing.onInvoice(JSON.parse(raw.toString('utf8')))
    return json(200, { ok: true })
  }
  if (method === 'GET' && path === '/plans') return json(200, await billing.plans())
  if (method === 'POST' && path === '/donate') return json(200, await billing.donate(body()))
  const order = path.match(/^\/order\/([\w-]{1,80})$/)
  if (method === 'GET' && order) return json(200, await billing.orderStatus(order[1]!))

  // Signed-in routes.
  const claims = event.requestContext.authorizer?.jwt?.claims
  if (!claims?.sub) throw new BillingError(401, 'Sign in first')
  const username = String(claims.username ?? claims['cognito:username'] ?? claims.sub)
  const actor: Actor = { sub: String(claims.sub), username }
  const groups = parseGroups(claims['cognito:groups'])

  if (method === 'GET' && path === '/me') return json(200, await billing.me(actor))
  if (method === 'POST' && path === '/checkout') {
    const { plan } = body()
    if (!isPlan(plan)) throw new BillingError(400, 'Unknown plan')
    actor.email = await emailOf(username).catch(() => undefined)
    return json(200, await billing.checkout(actor, plan))
  }
  if (method === 'POST' && path === '/cancel') return json(200, await billing.cancel(actor))
  if (method === 'POST' && path === '/resume') return json(200, await billing.resume(actor))
  if (method === 'POST' && path === '/card/forget') return json(200, await billing.forgetCard(actor))
  if (method === 'GET' && path === '/admin/summary') {
    if (!groups.includes('platform-admin')) throw new BillingError(403, 'Admins only')
    return json(200, await billing.summary())
  }
  throw new BillingError(400, 'Unknown request')
}
