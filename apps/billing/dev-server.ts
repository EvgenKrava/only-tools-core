// Local preview: serves the landing (with /plus) and a fake /api/billing backed by memory and a fake monobank.
// Run: pnpm --filter @onlytools/billing dev (no AWS, no monobank)  → http://localhost:5180/plus/
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { Billing } from './src/billing'
import { MemoryStore } from './src/store'
import type { Mono } from './src/mono'

const PORT = Number(process.env.PORT ?? 5187)
const HERE = join(import.meta.dirname, '..') // .dev/ → apps/billing
const PUBLIC = join(HERE, '../landing/public')
const store = new MemoryStore()
const invoices = new Map<string, { amount: number; reference: string }>()
let n = 0
const mono: Mono = {
  async createInvoice(r) { const id = `fake${++n}`; invoices.set(id, r); return { invoiceId: id, pageUrl: `/__pay?invoice=${id}&back=${encodeURIComponent(r.redirectUrl)}` } },
  async invoiceStatus(id) { const i = invoices.get(id)!; return { invoiceId: id, status: 'created', amount: i.amount, reference: i.reference } },
  async chargeCard() { return { invoiceId: `fake${++n}`, status: 'success' } },
  async deleteCard() {},
  async pubkey() { return '' },
}
const billing = new Billing({ store, mono, groups: { add: async () => {}, remove: async () => {} }, siteUrl: `http://localhost:${PORT}` })
const actor = { sub: 'dev-sub', username: 'dev', email: 'dev@example.com' }
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' }

createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://x')
  const send = (s: number, b: unknown) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)) }
  try {
    if (url.pathname === '/__pay') {
      // Fake payment page: pay → mark the invoice paid with a saved card, then go back.
      const id = url.searchParams.get('invoice')!; const i = invoices.get(id)!
      await billing.onInvoice({ invoiceId: id, reference: i.reference, amount: i.amount, status: 'success', modifiedDate: new Date().toISOString(),
        paymentInfo: { maskedPan: '537541******1234' }, walletData: i.reference.startsWith('plus_') ? { cardToken: 'tok', walletId: 'dev-sub', status: 'created' } : null })
      res.writeHead(302, { location: url.searchParams.get('back')! }); return res.end()
    }
    if (url.pathname.startsWith('/api/billing')) {
      let body = ''; for await (const c of req) body += c
      const b = body ? JSON.parse(body) : {}
      const p = url.pathname.replace('/api/billing', '')
      if (p === '/plans') return send(200, await billing.plans())
      if (p === '/me') return send(200, await billing.me(actor))
      if (p === '/checkout') return send(200, await billing.checkout(actor, b.plan))
      if (p === '/donate') return send(200, await billing.donate(b))
      if (p === '/cancel') return send(200, await billing.cancel(actor))
      if (p === '/resume') return send(200, await billing.resume(actor))
      if (p === '/card/forget') return send(200, await billing.forgetCard(actor))
      if (p === '/admin/summary') return send(200, await billing.summary())
      const o = p.match(/^\/order\/(.+)$/); if (o) return send(200, await billing.orderStatus(o[1]!))
      return send(400, { error: 'Unknown' })
    }
    if (url.pathname === '/config.json') return send(200, { domain: 'auth.onlytools.click', clientId: 'local' })
    const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname
    // /admin/* comes from the admin build (pnpm --filter @onlytools/admin build), SPA fallback to its index.html.
    const admin = path.startsWith('/admin') ? join(HERE, '../admin/dist', extname(path) ? path.replace(/^\/admin/, '') : '/index.html') : null
    const file = admin ?? (path === '/only-tools.css' ? join(HERE, '../../packages/ui/only-tools.css') : join(PUBLIC, path))
    const data = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(data)
  } catch (e) { send((e as { status?: number }).status ?? 404, { error: (e as Error).message }) }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/plus/`))
