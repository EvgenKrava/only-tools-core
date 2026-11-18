// Only Tools Plus and donations: checkout, webhooks, renewals, cancel/resume, admin summary.
// Plus is granted by the Cognito group "plus"; apps read it from the user's token.
import { randomUUID } from 'node:crypto'
import type { InvoiceEvent, Mono } from './mono'
import type { Order, Payment, Store, Subscription } from './store'
import {
  DONATION_MAX, DONATION_MIN, GRACE_DAYS, LIFETIME_CAP, LIMITS, PLANS, RETRY_AFTER_DAYS, addDays, addMonths, monthlyValue, type PlanId,
} from './plans'

export interface Groups {
  add(username: string): Promise<void>
  remove(username: string): Promise<void>
}

export interface Deps {
  store: Store
  mono: Mono
  groups: Groups
  /** https://onlytools.click */
  siteUrl: string
  now?: () => Date
  log?: (msg: string, data?: unknown) => void
}

export class BillingError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export interface Actor { sub: string; username: string; email?: string }

const DESTINATION: Record<PlanId, string> = {
  monthly: 'Only Tools Plus, 1 місяць',
  yearly: 'Only Tools Plus, 12 місяців',
  lifetime: 'Only Tools Plus, назавжди',
}

/** True while the subscription should keep the plus group. */
export function hasPlus(s: Subscription | undefined, now: Date): boolean {
  if (!s || s.status === 'expired') return false
  if (s.plan === 'lifetime') return true
  return !!s.periodEnd && Date.parse(s.periodEnd) > now.getTime() - (s.status === 'past_due' ? GRACE_DAYS * 86_400_000 : 0)
}

export class Billing {
  private now: () => Date
  private log: (msg: string, data?: unknown) => void
  constructor(private d: Deps) {
    this.now = d.now ?? (() => new Date())
    this.log = d.log ?? ((m, x) => console.log(JSON.stringify({ msg: m, ...(x as object) })))
  }

  private get webhook() { return `${this.d.siteUrl}/api/billing/webhook` }

  /** Public info for the pricing page. */
  async plans() {
    const sold = await this.d.store.lifetimeSold()
    return {
      currency: 'UAH',
      plans: Object.values(PLANS).map((p) => ({ id: p.id, amount: p.amount, months: p.months })),
      lifetimeLeft: Math.max(0, LIFETIME_CAP - sold),
      donation: { min: DONATION_MIN, max: DONATION_MAX },
      limits: LIMITS,
    }
  }

  async me(actor: Actor) {
    const s = await this.d.store.getSub(actor.sub)
    const now = this.now()
    return {
      plus: hasPlus(s, now),
      subscription: s ? {
        plan: s.plan, status: s.status, periodEnd: s.periodEnd, autoRenew: s.autoRenew,
        nextChargeAt: s.autoRenew ? s.nextChargeAt ?? null : null, maskedPan: s.maskedPan ?? null,
      } : null,
    }
  }

  /** Starts a payment page. Monthly and yearly save the card so the daily job can renew. */
  async checkout(actor: Actor, plan: PlanId) {
    const now = this.now()
    const current = await this.d.store.getSub(actor.sub)
    if (current?.plan === 'lifetime' && current.status !== 'expired') throw new BillingError(409, 'You already have Plus for life.')
    if (plan !== 'lifetime' && hasPlus(current, now) && current?.autoRenew)
      throw new BillingError(409, 'You already have Plus. Manage it on this page.')
    if (plan === 'lifetime' && (await this.d.store.lifetimeSold()) >= LIFETIME_CAP)
      throw new BillingError(410, 'The founding lifetime offer is sold out.')

    const p = PLANS[plan]
    const order: Order = {
      id: `plus_${randomUUID()}`, kind: 'plus', amount: p.amount, sub: actor.sub, username: actor.username, email: actor.email,
      plan, status: 'created', createdAt: now.toISOString(),
    }
    await this.d.store.putOrder(order)
    const inv = await this.d.mono.createInvoice({
      amount: p.amount, reference: order.id, destination: DESTINATION[plan],
      redirectUrl: `${this.d.siteUrl}/plus/?order=${order.id}`, webHookUrl: this.webhook,
      walletId: plan === 'lifetime' ? undefined : actor.sub,
    })
    await this.d.store.putOrder({ ...order, invoiceId: inv.invoiceId })
    return { orderId: order.id, pageUrl: inv.pageUrl }
  }

  async donate(input: { amount: unknown; donor?: unknown; note?: unknown }, actor?: Actor) {
    const amount = Math.round(Number(input.amount) * 100)
    if (!Number.isFinite(amount) || amount < DONATION_MIN || amount > DONATION_MAX)
      throw new BillingError(400, `Amount must be between ${DONATION_MIN / 100} and ${DONATION_MAX / 100} UAH.`)
    const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, n) : '') || undefined
    const order: Order = {
      id: `don_${randomUUID()}`, kind: 'donation', amount, sub: actor?.sub, email: actor?.email,
      donor: clean(input.donor, 60), note: clean(input.note, 280), status: 'created', createdAt: this.now().toISOString(),
    }
    await this.d.store.putOrder(order)
    const inv = await this.d.mono.createInvoice({
      amount, reference: order.id, destination: 'Добровільна підтримка Only Tools',
      redirectUrl: `${this.d.siteUrl}/plus/?thanks=${order.id}#support`, webHookUrl: this.webhook,
    })
    await this.d.store.putOrder({ ...order, invoiceId: inv.invoiceId })
    return { orderId: order.id, pageUrl: inv.pageUrl }
  }

  /** Status of one of the caller's orders, for the page monobank redirects back to. */
  async orderStatus(id: string, actor?: Actor) {
    const o = await this.d.store.getOrder(id)
    if (!o || (o.sub && o.sub !== actor?.sub)) throw new BillingError(400, 'Unknown order')
    // If the webhook has not come yet, ask monobank directly.
    if (o.invoiceId && (o.status === 'created' || o.status === 'processing')) {
      const ev = await this.d.mono.invoiceStatus(o.invoiceId)
      await this.onInvoice({ ...ev, reference: ev.reference || o.id })
      return { status: ev.status, kind: o.kind }
    }
    return { status: o.status, kind: o.kind }
  }

  /** Handles a verified webhook (or a status we fetched). Idempotent and safe against out-of-order delivery. */
  async onInvoice(ev: InvoiceEvent) {
    const id = ev.reference
    if (!id) { this.log('webhook without reference', { invoiceId: ev.invoiceId }); return }
    const order = await this.d.store.getOrder(id)
    if (!order) { this.log('webhook for unknown order', { id, invoiceId: ev.invoiceId }); return }
    if (order.invoiceId && order.invoiceId !== ev.invoiceId) { this.log('invoice mismatch', { id, invoiceId: ev.invoiceId }); return }
    const modified = new Date(ev.modifiedDate ?? this.now()).toISOString()
    const newer = await this.d.store.setOrderStatus(id, ev.status, modified, ev.invoiceId)

    if (ev.status === 'success') {
      if (ev.amount !== order.amount) { this.log('amount mismatch', { id, got: ev.amount, want: order.amount }); return }
      await this.applyPaid(order, ev)
    } else if (newer && ev.status === 'failure' && order.kind === 'renewal') {
      await this.renewalFailed(order, ev.failureReason)
    } else if (newer && ev.status === 'reversed' && order.kind !== 'donation') {
      this.log('payment reversed, review manually', { id, sub: order.sub })
    }
    // Card saved (or failed to save) after a first payment: keep the token for renewals.
    if (ev.walletData?.cardToken && ev.walletData.status !== 'failed' && order.sub && order.kind === 'plus') {
      const s = await this.d.store.getSub(order.sub)
      if (s && s.cardToken !== ev.walletData.cardToken && s.plan !== 'lifetime') {
        await this.d.store.putSub({ ...s, cardToken: ev.walletData.cardToken, maskedPan: ev.paymentInfo?.maskedPan ?? s.maskedPan ?? null, updatedAt: this.now().toISOString() })
      }
    }
  }

  private async applyPaid(order: Order, ev: InvoiceEvent) {
    if (!(await this.d.store.claimApply(order.id))) return
    const now = this.now()
    const payment: Payment = {
      at: now.toISOString(), orderId: order.id, kind: order.kind, amount: ev.amount, fee: ev.paymentInfo?.fee,
      plan: order.plan, sub: order.sub, email: order.email, donor: order.donor, note: order.note,
    }
    await this.d.store.addPayment(payment)
    if (order.kind === 'donation') { this.log('donation', { id: order.id, amount: ev.amount }); return }

    const sub = order.sub!
    const plan = order.plan!
    const prev = await this.d.store.getSub(sub)
    const card = ev.walletData?.cardToken && ev.walletData.status !== 'failed' ? ev.walletData.cardToken : prev?.cardToken
    let next: Subscription
    if (plan === 'lifetime') {
      next = {
        ...(prev ?? baseSub(order, now)), plan, status: 'active', periodEnd: null, autoRenew: false, nextChargeAt: null,
        failedAttempts: 0, updatedAt: now.toISOString(),
      }
      await this.d.store.incLifetimeSold()
      if (prev?.cardToken) await this.d.mono.deleteCard(prev.cardToken).catch((e) => this.log('deleteCard failed', { e: String(e) }))
      next.cardToken = null
    } else {
      // Extend from the end of the current period if it is still running (or this renews it), else from now.
      const keepAnchor = prev?.periodEnd && (Date.parse(prev.periodEnd) > now.getTime() || order.kind === 'renewal')
      const from = keepAnchor ? new Date(prev!.periodEnd!) : now
      const end = addMonths(from, PLANS[plan].months!)
      next = {
        ...(prev ?? baseSub(order, now)), plan, status: 'active', periodEnd: end.toISOString(), autoRenew: true,
        nextChargeAt: end.toISOString(), cardToken: card ?? null,
        maskedPan: ev.paymentInfo?.maskedPan ?? prev?.maskedPan ?? null, failedAttempts: 0, updatedAt: now.toISOString(),
      }
    }
    if (order.email) next.email = order.email
    await this.d.store.putSub(next)
    await this.d.groups.add(next.username)
    this.log('plus paid', { id: order.id, sub, plan, periodEnd: next.periodEnd })
  }

  private async renewalFailed(order: Order, reason?: string) {
    const s = await this.d.store.getSub(order.sub!)
    if (!s) return
    const now = this.now()
    const attempts = s.failedAttempts + 1
    const retryIn = RETRY_AFTER_DAYS[attempts - 1]
    const graceEnd = addDays(new Date(s.periodEnd ?? now), GRACE_DAYS)
    const retryAt = retryIn !== undefined ? addDays(now, retryIn) : null
    const next: Subscription = {
      ...s, status: 'past_due', failedAttempts: attempts,
      nextChargeAt: retryAt && retryAt < graceEnd ? retryAt.toISOString() : null, updatedAt: now.toISOString(),
    }
    await this.d.store.putSub(next)
    this.log('renewal failed', { sub: s.sub, attempts, reason })
  }

  async cancel(actor: Actor) {
    const s = await this.d.store.getSub(actor.sub)
    if (!s || !hasPlus(s, this.now()) || s.plan === 'lifetime') throw new BillingError(400, 'Nothing to cancel.')
    // Plus stays until the paid period ends; the daily job removes it then.
    await this.d.store.putSub({ ...s, autoRenew: false, status: 'canceled', nextChargeAt: null, updatedAt: this.now().toISOString() })
    return this.me(actor)
  }

  async resume(actor: Actor) {
    const s = await this.d.store.getSub(actor.sub)
    const now = this.now()
    if (!s || s.status !== 'canceled' || !hasPlus(s, now)) throw new BillingError(400, 'Nothing to resume. Choose a plan instead.')
    if (!s.cardToken) throw new BillingError(400, 'No saved card. Choose a plan to pay again.')
    await this.d.store.putSub({ ...s, autoRenew: true, status: 'active', nextChargeAt: s.periodEnd, updatedAt: now.toISOString() })
    return this.me(actor)
  }

  /** Removes the saved card; renewals stop, Plus lasts to the end of the period. */
  async forgetCard(actor: Actor) {
    const s = await this.d.store.getSub(actor.sub)
    if (!s?.cardToken) throw new BillingError(400, 'No saved card.')
    await this.d.mono.deleteCard(s.cardToken)
    await this.d.store.putSub({
      ...s, cardToken: null, maskedPan: null, autoRenew: false, nextChargeAt: null,
      status: s.status === 'active' || s.status === 'past_due' ? 'canceled' : s.status, updatedAt: this.now().toISOString(),
    })
    return this.me(actor)
  }

  /** Daily job: charge due renewals, retry failed ones, and take Plus away when it ran out. */
  async daily() {
    const now = this.now()
    const out = { charged: 0, failed: 0, expired: 0 }
    for (const s of await this.d.store.listSubs()) {
      if (s.status === 'expired' || s.plan === 'lifetime') continue
      if (s.autoRenew && s.cardToken && s.nextChargeAt && Date.parse(s.nextChargeAt) <= now.getTime()) {
        const ok = await this.chargeRenewal(s)
        ok ? out.charged++ : out.failed++
        continue
      }
      if (!hasPlus(s, now)) {
        await this.d.store.putSub({ ...s, status: 'expired', autoRenew: false, nextChargeAt: null, updatedAt: now.toISOString() })
        await this.d.groups.remove(s.username)
        if (s.cardToken) await this.d.mono.deleteCard(s.cardToken).catch(() => undefined)
        out.expired++
        this.log('plus expired', { sub: s.sub })
      }
    }
    return out
  }

  private async chargeRenewal(s: Subscription): Promise<boolean> {
    const now = this.now()
    const plan = PLANS[s.plan]
    const order: Order = {
      id: `ren_${randomUUID()}`, kind: 'renewal', amount: plan.amount, sub: s.sub, username: s.username, email: s.email,
      plan: s.plan, status: 'created', createdAt: now.toISOString(),
    }
    await this.d.store.putOrder(order)
    // Move nextChargeAt now so a slow webhook never causes a second charge the next day.
    await this.d.store.putSub({ ...s, nextChargeAt: null, updatedAt: now.toISOString() })
    try {
      const r = await this.d.mono.chargeCard({
        cardToken: s.cardToken!, amount: plan.amount, reference: order.id, destination: DESTINATION[s.plan],
        webHookUrl: this.webhook, redirectUrl: `${this.d.siteUrl}/plus/`,
      })
      if (r.invoiceId) await this.d.store.putOrder({ ...order, invoiceId: r.invoiceId })
      if (r.status === 'success') {
        await this.onInvoice({ invoiceId: r.invoiceId, status: 'success', amount: plan.amount, reference: order.id, modifiedDate: now.toISOString() })
        return true
      }
      if (r.status === 'failure') {
        await this.onInvoice({ invoiceId: r.invoiceId, status: 'failure', amount: plan.amount, reference: order.id, modifiedDate: now.toISOString(), failureReason: r.failureReason })
        return false
      }
      return true // processing: the webhook finishes it
    } catch (e) {
      this.log('renewal charge error', { sub: s.sub, e: String(e) })
      await this.renewalFailed(order, String(e))
      return false
    }
  }

  /** Admin: subscribers and revenue (kopecks). */
  async summary() {
    const now = this.now()
    const [subs, payments] = await Promise.all([this.d.store.listSubs(), this.d.store.listPayments()])
    const month = now.toISOString().slice(0, 7)
    const sum = (ps: Payment[]) => ps.reduce((a, p) => a + p.amount, 0)
    const live = subs.filter((s) => hasPlus(s, now))
    const byMonth = new Map<string, { plus: number; donations: number }>()
    for (const p of payments) {
      const m = p.at.slice(0, 7)
      const row = byMonth.get(m) ?? { plus: 0, donations: 0 }
      p.kind === 'donation' ? (row.donations += p.amount) : (row.plus += p.amount)
      byMonth.set(m, row)
    }
    return {
      currency: 'UAH',
      counts: {
        plus: live.length,
        monthly: live.filter((s) => s.plan === 'monthly').length,
        yearly: live.filter((s) => s.plan === 'yearly').length,
        lifetime: live.filter((s) => s.plan === 'lifetime').length,
        canceling: live.filter((s) => s.status === 'canceled').length,
        pastDue: live.filter((s) => s.status === 'past_due').length,
      },
      mrr: live.filter((s) => s.autoRenew).reduce((a, s) => a + monthlyValue(s.plan), 0),
      revenue: {
        thisMonth: sum(payments.filter((p) => p.at.startsWith(month))),
        total: sum(payments),
        plusTotal: sum(payments.filter((p) => p.kind !== 'donation')),
        donationsTotal: sum(payments.filter((p) => p.kind === 'donation')),
        fees: payments.reduce((a, p) => a + (p.fee ?? 0), 0),
      },
      months: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([m, v]) => ({ month: m, ...v })),
      subscribers: subs
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((s) => ({ email: s.email ?? s.username, plan: s.plan, status: hasPlus(s, now) ? s.status : 'expired', periodEnd: s.periodEnd, autoRenew: s.autoRenew, since: s.createdAt })),
      recent: payments.slice(0, 30).map((p) => ({ at: p.at, kind: p.kind, amount: p.amount, plan: p.plan, who: p.kind === 'donation' ? p.donor ?? p.email ?? null : p.email ?? null, note: p.note })),
    }
  }
}

function baseSub(order: Order, now: Date): Subscription {
  return {
    sub: order.sub!, username: order.username!, email: order.email, plan: order.plan!, status: 'active', periodEnd: null,
    autoRenew: false, failedAttempts: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  }
}
