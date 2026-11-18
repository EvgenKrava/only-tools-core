// monobank internet acquiring (plata by mono) client. Docs: https://monobank.ua/api-docs/acquiring
import { createVerify } from 'node:crypto'

export type InvoiceStatus = 'created' | 'processing' | 'hold' | 'success' | 'failure' | 'reversed' | 'expired'

/** Webhook body; same shape as GET /api/merchant/invoice/status. Only the fields we use. */
export interface InvoiceEvent {
  invoiceId: string
  status: InvoiceStatus
  amount: number
  ccy?: number
  finalAmount?: number
  reference?: string
  modifiedDate?: string
  failureReason?: string
  errCode?: string
  paymentInfo?: { maskedPan?: string; fee?: number; paymentSystem?: string }
  walletData?: { cardToken: string; walletId: string; status: 'new' | 'created' | 'failed' } | null
}

export interface CreateInvoice {
  amount: number
  reference: string
  destination: string
  redirectUrl: string
  webHookUrl: string
  /** Save the card into this wallet for merchant-initiated renewals. */
  walletId?: string
}

export interface ChargeCard {
  cardToken: string
  amount: number
  reference: string
  destination: string
  webHookUrl: string
  redirectUrl: string
}

export interface ChargeResult {
  invoiceId: string
  status: InvoiceStatus
  failureReason?: string
}

export interface Mono {
  createInvoice(req: CreateInvoice): Promise<{ invoiceId: string; pageUrl: string }>
  invoiceStatus(invoiceId: string): Promise<InvoiceEvent>
  chargeCard(req: ChargeCard): Promise<ChargeResult>
  deleteCard(cardToken: string): Promise<void>
  /** Base64 of a PEM ECDSA public key, as returned by GET /api/merchant/pubkey. */
  pubkey(): Promise<string>
}

export class MonoError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export class HttpMono implements Mono {
  constructor(private token: string, private base = 'https://api.monobank.ua') {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { 'X-Token': this.token, 'content-type': 'application/json', 'X-Cms': 'onlytools' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const text = await res.text()
    if (!res.ok) throw new MonoError(res.status, `monobank ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
    return (text ? JSON.parse(text) : {}) as T
  }

  createInvoice(r: CreateInvoice) {
    return this.call<{ invoiceId: string; pageUrl: string }>('POST', '/api/merchant/invoice/create', {
      amount: r.amount, ccy: 980,
      merchantPaymInfo: { reference: r.reference, destination: r.destination },
      redirectUrl: r.redirectUrl, webHookUrl: r.webHookUrl, validity: 3600, paymentType: 'debit',
      ...(r.walletId ? { saveCardData: { saveCard: true, walletId: r.walletId } } : {}),
    })
  }

  invoiceStatus(invoiceId: string) {
    return this.call<InvoiceEvent>('GET', `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`)
  }

  async chargeCard(r: ChargeCard): Promise<ChargeResult> {
    const res = await this.call<Partial<ChargeResult>>('POST', '/api/merchant/wallet/payment', {
      cardToken: r.cardToken, amount: r.amount, ccy: 980, initiationKind: 'merchant', paymentType: 'debit',
      merchantPaymInfo: { reference: r.reference, destination: r.destination },
      webHookUrl: r.webHookUrl, redirectUrl: r.redirectUrl,
    })
    return { invoiceId: String(res.invoiceId ?? ''), status: res.status ?? 'processing', failureReason: res.failureReason }
  }

  async deleteCard(cardToken: string) {
    await this.call('DELETE', `/api/merchant/wallet/card?cardToken=${encodeURIComponent(cardToken)}`)
  }

  async pubkey() {
    return (await this.call<{ key: string }>('GET', '/api/merchant/pubkey')).key
  }
}

/** Checks the X-Sign header: base64 DER ECDSA/SHA-256 signature over the raw body bytes. */
export function verifySignature(rawBody: string | Buffer, xSign: string | undefined, pubkeyBase64: string): boolean {
  if (!xSign) return false
  try {
    const pem = Buffer.from(pubkeyBase64, 'base64').toString('utf8')
    const v = createVerify('SHA256')
    v.update(rawBody)
    v.end()
    return v.verify(pem, Buffer.from(xSign, 'base64'))
  } catch {
    return false
  }
}

/** Verifies with the cached key; on failure re-fetches the key once (monobank rotates it rarely). */
export function makeVerifier(mono: Pick<Mono, 'pubkey'>) {
  let cached: string | undefined
  return async (rawBody: string | Buffer, xSign: string | undefined) => {
    cached ??= await mono.pubkey()
    if (verifySignature(rawBody, xSign, cached)) return true
    const fresh = await mono.pubkey()
    if (fresh === cached) return false
    cached = fresh
    return verifySignature(rawBody, xSign, cached)
  }
}
