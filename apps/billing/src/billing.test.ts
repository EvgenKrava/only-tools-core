import { describe, expect, it, beforeEach } from 'vitest'
import { generateKeyPairSync, createSign } from 'node:crypto'
import { Billing, BillingError, hasPlus } from './billing'
import { makeVerifier, verifySignature, type ChargeCard, type CreateInvoice, type InvoiceEvent, type Mono } from './mono'
import { MemoryStore } from './store'
import { addMonths, PRICES } from './plans'

class FakeMono implements Mono {
  invoices: (CreateInvoice & { invoiceId: string })[] = []
  charges: ChargeCard[] = []
  deleted: string[] = []
  chargeResult: 'success' | 'failure' | 'processing' | 'throw' = 'success'
  key = 'k1'
  n = 0
  async createInvoice(r: CreateInvoice) {
    const invoiceId = `inv${++this.n}`
    this.invoices.push({ ...r, invoiceId })
    return { invoiceId, pageUrl: `https://pay.mbnk.biz/${invoiceId}` }
  }
  async invoiceStatus(invoiceId: string): Promise<InvoiceEvent> {
    const i = this.invoices.find((x) => x.invoiceId === invoiceId)!
    return { invoiceId, status: 'success', amount: i.amount, reference: i.reference, modifiedDate: new Date().toISOString() }
  }
  async chargeCard(r: ChargeCard) {
    this.charges.push(r)
    if (this.chargeResult === 'throw') throw new Error('network')
    return { invoiceId: `chg${++this.n}`, status: this.chargeResult }
  }
  async deleteCard(t: string) { this.deleted.push(t) }
  async pubkey() { return this.key }
}

class FakeGroups {
  members = new Set<string>()
  async add(u: string) { this.members.add(u) }
  async remove(u: string) { this.members.delete(u) }
}

const actor = { sub: 'sub-1', username: 'google_1', email: 'a@b.c' }
let now: Date
let store: MemoryStore
let mono: FakeMono
let groups: FakeGroups
let billing: Billing

const paid = (inv: { invoiceId: string; reference: string; amount: number }, extra: Partial<InvoiceEvent> = {}): InvoiceEvent => ({
  invoiceId: inv.invoiceId, reference: inv.reference, amount: inv.amount, status: 'success',
  modifiedDate: now.toISOString(), paymentInfo: { maskedPan: '444403******1902', fee: 150 },
  walletData: { cardToken: 'tok-1', walletId: actor.sub, status: 'created' }, ...extra,
})

beforeEach(() => {
  now = new Date('2026-11-18T10:00:00Z')
  store = new MemoryStore()
  mono = new FakeMono()
  groups = new FakeGroups()
  billing = new Billing({ store, mono, groups, siteUrl: 'https://onlytools.click', now: () => now, log: () => {} })
})

describe('checkout and webhook', () => {
  it('creates an invoice that saves the card, then grants Plus on success', async () => {
    const r = await billing.checkout(actor, 'monthly')
    expect(r.pageUrl).toContain('pay.mbnk.biz')
    const inv = mono.invoices[0]!
    expect(inv).toMatchObject({ amount: 9900, walletId: 'sub-1', webHookUrl: 'https://onlytools.click/api/billing/webhook' })
    expect(inv.redirectUrl).toBe(`https://onlytools.click/plus/?order=${r.orderId}`)

    await billing.onInvoice(paid(inv))
    const s = (await store.getSub('sub-1'))!
    expect(s).toMatchObject({ plan: 'monthly', status: 'active', autoRenew: true, cardToken: 'tok-1', maskedPan: '444403******1902' })
    expect(s.periodEnd).toBe('2026-12-18T10:00:00.000Z')
    expect(groups.members.has('google_1')).toBe(true)
    expect(store.payments).toHaveLength(1)
    expect((await billing.me(actor)).plus).toBe(true)
  })

  it('applies a payment once even if the webhook repeats', async () => {
    await billing.checkout(actor, 'yearly')
    const ev = paid(mono.invoices[0]!)
    await billing.onInvoice(ev)
    await billing.onInvoice(ev)
    await billing.onInvoice({ ...ev, modifiedDate: '2026-11-18T10:05:00Z' })
    expect(store.payments).toHaveLength(1)
    expect((await store.getSub('sub-1'))!.periodEnd).toBe('2027-11-18T10:00:00.000Z')
  })

  it('ignores a stale processing webhook that arrives after success', async () => {
    await billing.checkout(actor, 'monthly')
    const inv = mono.invoices[0]!
    await billing.onInvoice(paid(inv))
    await billing.onInvoice({ ...paid(inv), status: 'processing', modifiedDate: '2026-11-18T09:59:00Z' })
    expect((await store.getOrder(inv.reference))!.status).toBe('success')
  })

  it('rejects a webhook whose amount differs from the order', async () => {
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice({ ...paid(mono.invoices[0]!), amount: 100 })
    expect(await store.getSub('sub-1')).toBeUndefined()
    expect(groups.members.size).toBe(0)
  })

  it('ignores webhooks for unknown orders or another invoice id', async () => {
    await billing.onInvoice({ invoiceId: 'x', reference: 'nope', amount: 9900, status: 'success' })
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice({ ...paid(mono.invoices[0]!), invoiceId: 'other' })
    expect(store.payments).toHaveLength(0)
  })

  it('does not let an active subscriber buy monthly twice', async () => {
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice(paid(mono.invoices[0]!))
    await expect(billing.checkout(actor, 'monthly')).rejects.toThrow(BillingError)
  })

  it('lifetime: no saved card, never expires, counts toward the cap, deletes an old card', async () => {
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice(paid(mono.invoices[0]!))
    await billing.checkout(actor, 'lifetime')
    const inv = mono.invoices[1]!
    expect(inv.walletId).toBeUndefined()
    await billing.onInvoice(paid(inv, { walletData: null }))
    const s = (await store.getSub('sub-1'))!
    expect(s).toMatchObject({ plan: 'lifetime', periodEnd: null, autoRenew: false, cardToken: null })
    expect(mono.deleted).toEqual(['tok-1'])
    expect(store.lifetime).toBe(1)
    now = new Date('2040-01-01T00:00:00Z')
    expect(await billing.daily()).toEqual({ charged: 0, failed: 0, expired: 0 })
    expect(groups.members.has('google_1')).toBe(true)
    expect((await billing.plans()).lifetimeLeft).toBe(99)
  })
})

describe('renewals', () => {
  beforeEach(async () => {
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice(paid(mono.invoices[0]!))
  })

  it('does nothing before the period ends', async () => {
    now = new Date('2026-12-17T10:00:00Z')
    expect(await billing.daily()).toEqual({ charged: 0, failed: 0, expired: 0 })
    expect(mono.charges).toHaveLength(0)
  })

  it('charges the saved card as a merchant-initiated payment and extends from the old period end', async () => {
    now = new Date('2026-12-18T11:00:00Z')
    expect((await billing.daily()).charged).toBe(1)
    expect(mono.charges[0]).toMatchObject({ cardToken: 'tok-1', amount: 9900 })
    const s = (await store.getSub('sub-1'))!
    expect(s.periodEnd).toBe('2027-01-18T10:00:00.000Z')
    expect(s.nextChargeAt).toBe('2027-01-18T10:00:00.000Z')
    expect(store.payments).toHaveLength(2)
    // A second run the same day does not charge again.
    await billing.daily()
    expect(mono.charges).toHaveLength(1)
  })

  it('retries a failed card, keeps Plus for the grace period, then expires', async () => {
    mono.chargeResult = 'failure'
    now = new Date('2026-12-18T11:00:00Z')
    await billing.daily()
    let s = (await store.getSub('sub-1'))!
    expect(s).toMatchObject({ status: 'past_due', failedAttempts: 1, nextChargeAt: '2026-12-19T11:00:00.000Z' })
    expect(hasPlus(s, now)).toBe(true)

    now = new Date('2026-12-19T11:00:00Z'); await billing.daily()
    now = new Date('2026-12-21T11:00:00Z'); await billing.daily()
    expect((await store.getSub('sub-1'))!.nextChargeAt).toBe('2026-12-24T11:00:00.000Z')
    now = new Date('2026-12-24T11:00:00Z'); await billing.daily()
    s = (await store.getSub('sub-1'))!
    expect(s.failedAttempts).toBe(4)
    expect(s.nextChargeAt).toBeNull()
    expect(mono.charges).toHaveLength(4)
    expect(hasPlus(s, now)).toBe(true)

    now = new Date('2026-12-25T11:00:00Z')
    expect((await billing.daily()).expired).toBe(1)
    expect((await store.getSub('sub-1'))!.status).toBe('expired')
    expect(groups.members.has('google_1')).toBe(false)
    expect(mono.deleted).toContain('tok-1')
  })

  it('a network error on renewal counts as a failed attempt', async () => {
    mono.chargeResult = 'throw'
    now = new Date('2026-12-18T11:00:00Z')
    expect((await billing.daily()).failed).toBe(1)
    expect((await store.getSub('sub-1'))!.status).toBe('past_due')
  })

  it('a renewal that succeeds later (via webhook) recovers a past-due subscription', async () => {
    mono.chargeResult = 'processing'
    now = new Date('2026-12-18T11:00:00Z')
    await billing.daily()
    const c = mono.charges[0]!
    await billing.onInvoice({ invoiceId: 'chg2', reference: c.reference, amount: 9900, status: 'success', modifiedDate: now.toISOString() })
    expect((await store.getSub('sub-1'))!).toMatchObject({ status: 'active', periodEnd: '2027-01-18T10:00:00.000Z' })
  })
})

describe('cancel, resume, forget card', () => {
  beforeEach(async () => {
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice(paid(mono.invoices[0]!))
  })

  it('cancel keeps Plus until the period ends, then removes it without charging', async () => {
    const me = await billing.cancel(actor)
    expect(me).toMatchObject({ plus: true, subscription: { status: 'canceled', autoRenew: false } })
    now = new Date('2026-12-18T11:00:00Z')
    expect(await billing.daily()).toEqual({ charged: 0, failed: 0, expired: 1 })
    expect(mono.charges).toHaveLength(0)
    expect(groups.members.size).toBe(0)
  })

  it('resume turns renewals back on', async () => {
    await billing.cancel(actor)
    const me = await billing.resume(actor)
    expect(me.subscription).toMatchObject({ status: 'active', autoRenew: true, nextChargeAt: '2026-12-18T10:00:00.000Z' })
  })

  it('forget card deletes the token at monobank and stops renewals', async () => {
    await billing.forgetCard(actor)
    expect(mono.deleted).toEqual(['tok-1'])
    const s = (await store.getSub('sub-1'))!
    expect(s).toMatchObject({ cardToken: null, autoRenew: false, status: 'canceled' })
  })

  it('a canceled user can buy again after it expired', async () => {
    await billing.cancel(actor)
    now = new Date('2026-12-20T00:00:00Z')
    await billing.daily()
    await billing.checkout(actor, 'yearly')
    await billing.onInvoice(paid(mono.invoices[1]!, { walletData: { cardToken: 'tok-2', walletId: 'sub-1', status: 'created' } }))
    expect((await store.getSub('sub-1'))!).toMatchObject({ plan: 'yearly', status: 'active', cardToken: 'tok-2', periodEnd: '2027-12-20T00:00:00.000Z' })
    expect(groups.members.has('google_1')).toBe(true)
  })
})

describe('donations and admin summary', () => {
  it('validates the amount and records a donation without touching Plus', async () => {
    await expect(billing.donate({ amount: 5 })).rejects.toThrow(/between 20/)
    await expect(billing.donate({ amount: 'abc' })).rejects.toThrow(BillingError)
    const r = await billing.donate({ amount: 100, donor: '  Ivan ', note: 'дякую!' })
    const inv = mono.invoices[0]!
    expect(inv.amount).toBe(10000)
    expect(inv.walletId).toBeUndefined()
    expect(inv.redirectUrl).toContain(`thanks=${r.orderId}`)
    await billing.onInvoice({ invoiceId: inv.invoiceId, reference: inv.reference, amount: 10000, status: 'success', modifiedDate: now.toISOString() })
    expect(store.payments[0]).toMatchObject({ kind: 'donation', amount: 10000, donor: 'Ivan', note: 'дякую!' })
    expect(groups.members.size).toBe(0)
  })

  it('order status falls back to asking monobank when the webhook is late', async () => {
    const r = await billing.donate({ amount: 50 })
    expect(await billing.orderStatus(r.orderId)).toEqual({ status: 'success', kind: 'donation' })
    expect(store.payments).toHaveLength(1)
  })

  it('sums subscribers, MRR and revenue', async () => {
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice(paid(mono.invoices[0]!))
    const b = { sub: 'sub-2', username: 'u2', email: 'b@c.d' }
    await billing.checkout(b, 'yearly')
    await billing.onInvoice(paid(mono.invoices[1]!))
    const d = await billing.donate({ amount: 250 })
    await billing.onInvoice({ invoiceId: mono.invoices[2]!.invoiceId, reference: d.orderId, amount: 25000, status: 'success', modifiedDate: now.toISOString() })
    const s = await billing.summary()
    expect(s.counts).toMatchObject({ plus: 2, monthly: 1, yearly: 1 })
    expect(s.mrr).toEqual({ UAH: 9900 + Math.round(79000 / 12), USD: 0 })
    expect(s.revenue.UAH).toMatchObject({ thisMonth: 9900 + 79000 + 25000, donationsTotal: 25000, plusTotal: 88900 })
    expect(s.months).toEqual([{ month: '2026-11', total: { UAH: 113900, USD: 0 } }])
    expect(s.subscribers).toHaveLength(2)
  })
})

describe('plans', () => {
  it('adds calendar months and clamps month ends', () => {
    expect(addMonths(new Date('2026-01-31T12:00:00Z'), 1).toISOString()).toBe('2026-02-28T12:00:00.000Z')
    expect(addMonths(new Date('2026-11-30T00:00:00Z'), 12).toISOString()).toBe('2027-11-30T00:00:00.000Z')
  })
  it('prices are in minor units', () => {
    expect(PRICES.UAH).toEqual({ monthly: 9900, yearly: 79000, lifetime: 199000 })
    expect(PRICES.USD).toEqual({ monthly: 299, yearly: 2400, lifetime: 4900 })
  })
})

describe('webhook signature', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pubB64 = Buffer.from(publicKey.export({ type: 'spki', format: 'pem' })).toString('base64')
  const body = JSON.stringify({ invoiceId: 'p2_x', status: 'success', amount: 9900 })
  const sign = (b: string) => { const s = createSign('SHA256'); s.update(b); s.end(); return s.sign(privateKey).toString('base64') }

  it('accepts a valid signature and rejects tampering or a missing header', () => {
    expect(verifySignature(body, sign(body), pubB64)).toBe(true)
    expect(verifySignature(body.replace('9900', '1'), sign(body), pubB64)).toBe(false)
    expect(verifySignature(body, undefined, pubB64)).toBe(false)
    expect(verifySignature(body, 'garbage', pubB64)).toBe(false)
  })

  it('refetches the key once when the cached one fails (key rotation)', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey
    const keys = [Buffer.from(other.export({ type: 'spki', format: 'pem' })).toString('base64'), pubB64]
    let calls = 0
    const verify = makeVerifier({ pubkey: async () => keys[Math.min(calls++, 1)]! })
    expect(await verify(body, sign(body))).toBe(true)
    expect(calls).toBe(2)
    expect(await verify(body, sign(body))).toBe(true)
    expect(calls).toBe(2)
  })
})

describe('USD', () => {
  const usd = { sub: 'sub-us', username: 'u-us', email: 'us@example.com' }

  it('charges in dollars (ccy 840) and renews in dollars', async () => {
    await billing.checkout(usd, 'monthly', 'USD')
    const inv = mono.invoices[0]!
    expect(inv).toMatchObject({ amount: 299, ccy: 840 })
    await billing.onInvoice(paid(inv, { ccy: 840 }))
    expect((await store.getSub('sub-us'))!.currency).toBe('USD')
    expect((await billing.me(usd)).subscription).toMatchObject({ currency: 'USD', amount: 299 })
    now = new Date('2026-12-18T11:00:00Z')
    await billing.daily()
    expect(mono.charges[0]).toMatchObject({ amount: 299, ccy: 840 })
    expect(store.payments.map((p) => p.currency)).toEqual(['USD', 'USD'])
    const sum = await billing.summary()
    expect(sum.mrr).toEqual({ UAH: 0, USD: 299 })
    expect(sum.revenue.USD.total).toBe(598)
  })

  it('rejects a webhook in another currency', async () => {
    await billing.checkout(usd, 'monthly', 'USD')
    await billing.onInvoice(paid(mono.invoices[0]!, { ccy: 980 }))
    expect(await store.getSub('sub-us')).toBeUndefined()
  })

  it('donations in dollars have their own limits', async () => {
    await expect(billing.donate({ amount: 0.5, currency: 'USD' })).rejects.toThrow(/between 1 and 1000 USD/)
    await billing.donate({ amount: 5, currency: 'USD' })
    expect(mono.invoices[0]).toMatchObject({ amount: 500, ccy: 840 })
  })

  it('old records without a currency count as hryvnia', async () => {
    await billing.checkout(actor, 'monthly')
    expect(mono.invoices[0]).toMatchObject({ amount: 9900, ccy: 980 })
  })
})

describe('paused payments', () => {
  it('daily without charging still expires lapsed Plus but never charges a card', async () => {
    await billing.checkout(actor, 'monthly')
    await billing.onInvoice(paid(mono.invoices[0]!))
    now = new Date('2026-12-18T09:00:00Z')
    expect(await billing.daily({ charge: false })).toEqual({ charged: 0, failed: 0, expired: 0 })
    now = new Date('2026-12-18T11:00:00Z')
    expect((await billing.daily({ charge: false })).expired).toBe(1)
    expect(mono.charges).toHaveLength(0)
    expect(groups.members.size).toBe(0)
  })
})
