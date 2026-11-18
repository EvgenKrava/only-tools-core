// Billing state in one DynamoDB table (on-demand):
//   USER#<sub>      / SUB              the user's Plus subscription
//   ORDER#<id>      / ORDER            one checkout, renewal or donation (id = monobank "reference")
//   LEDGER          / <iso>#<orderId>  every successful payment, for revenue in the admin
//   META            / COUNTERS         lifetime offers sold
import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { InvoiceStatus } from './mono'
import type { PlanId } from './plans'

export type SubStatus = 'active' | 'past_due' | 'canceled' | 'expired'

export interface Subscription {
  sub: string
  username: string
  email?: string
  plan: PlanId
  status: SubStatus
  /** Plus lasts until this time; null for lifetime. */
  periodEnd: string | null
  autoRenew: boolean
  /** When the daily job charges the saved card next (renewal or retry). */
  nextChargeAt?: string | null
  cardToken?: string | null
  maskedPan?: string | null
  failedAttempts: number
  createdAt: string
  updatedAt: string
}

export type OrderKind = 'plus' | 'renewal' | 'donation'

export interface Order {
  id: string
  kind: OrderKind
  amount: number
  sub?: string
  username?: string
  email?: string
  plan?: PlanId
  /** Donation: name and note the donor chose to leave. */
  donor?: string
  note?: string
  invoiceId?: string
  status: InvoiceStatus
  modifiedDate?: string
  applied?: boolean
  createdAt: string
}

export interface Payment {
  at: string
  orderId: string
  kind: OrderKind
  amount: number
  fee?: number
  plan?: PlanId
  sub?: string
  email?: string
  donor?: string
  note?: string
}

export interface Store {
  getSub(sub: string): Promise<Subscription | undefined>
  putSub(s: Subscription): Promise<void>
  listSubs(): Promise<Subscription[]>
  getOrder(id: string): Promise<Order | undefined>
  putOrder(o: Order): Promise<void>
  /** Saves a newer status; false when the stored one is as new or newer (out-of-order webhook). */
  setOrderStatus(id: string, status: InvoiceStatus, modifiedDate: string, invoiceId?: string): Promise<boolean>
  /** Marks a paid order as applied exactly once; false if it already was. */
  claimApply(id: string): Promise<boolean>
  addPayment(p: Payment): Promise<void>
  listPayments(): Promise<Payment[]>
  lifetimeSold(): Promise<number>
  incLifetimeSold(): Promise<void>
}

export class DynamoStore implements Store {
  private db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })
  constructor(private table = process.env.TABLE_NAME!) {}

  async getSub(sub: string) {
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: `USER#${sub}`, sk: 'SUB' } }))
    return r.Item as Subscription | undefined
  }
  async putSub(s: Subscription) {
    await this.db.send(new PutCommand({ TableName: this.table, Item: { pk: `USER#${s.sub}`, sk: 'SUB', type: 'sub', ...s } }))
  }
  async listSubs() {
    const out: Subscription[] = []
    let start: Record<string, unknown> | undefined
    do {
      const r = await this.db.send(new ScanCommand({
        TableName: this.table, FilterExpression: '#t = :t', ExpressionAttributeNames: { '#t': 'type' },
        ExpressionAttributeValues: { ':t': 'sub' }, ExclusiveStartKey: start,
      }))
      out.push(...((r.Items ?? []) as Subscription[]))
      start = r.LastEvaluatedKey
    } while (start)
    return out
  }
  async getOrder(id: string) {
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: `ORDER#${id}`, sk: 'ORDER' } }))
    return r.Item as Order | undefined
  }
  async putOrder(o: Order) {
    // 90 days is plenty to match late webhooks; the ledger keeps the payment itself.
    const ttl = Math.floor(Date.now() / 1000) + 90 * 86_400
    await this.db.send(new PutCommand({ TableName: this.table, Item: { pk: `ORDER#${o.id}`, sk: 'ORDER', type: 'order', ttl, ...o } }))
  }
  async setOrderStatus(id: string, status: InvoiceStatus, modifiedDate: string, invoiceId?: string) {
    try {
      await this.db.send(new UpdateCommand({
        TableName: this.table, Key: { pk: `ORDER#${id}`, sk: 'ORDER' },
        UpdateExpression: invoiceId ? 'SET #s = :s, modifiedDate = :m, invoiceId = :i' : 'SET #s = :s, modifiedDate = :m',
        ConditionExpression: 'attribute_exists(pk) AND (attribute_not_exists(modifiedDate) OR modifiedDate < :m)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': status, ':m': modifiedDate, ...(invoiceId ? { ':i': invoiceId } : {}) },
      }))
      return true
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) return false
      throw e
    }
  }
  async claimApply(id: string) {
    try {
      await this.db.send(new UpdateCommand({
        TableName: this.table, Key: { pk: `ORDER#${id}`, sk: 'ORDER' }, UpdateExpression: 'SET applied = :t',
        ConditionExpression: 'attribute_exists(pk) AND (attribute_not_exists(applied) OR applied = :f)',
        ExpressionAttributeValues: { ':t': true, ':f': false },
      }))
      return true
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) return false
      throw e
    }
  }
  async addPayment(p: Payment) {
    await this.db.send(new PutCommand({ TableName: this.table, Item: { pk: 'LEDGER', sk: `${p.at}#${p.orderId}`, type: 'payment', ...p } }))
  }
  async listPayments() {
    const out: Payment[] = []
    let start: Record<string, unknown> | undefined
    do {
      const r = await this.db.send(new QueryCommand({
        TableName: this.table, KeyConditionExpression: 'pk = :p', ExpressionAttributeValues: { ':p': 'LEDGER' },
        ScanIndexForward: false, ExclusiveStartKey: start,
      }))
      out.push(...((r.Items ?? []) as Payment[]))
      start = r.LastEvaluatedKey
    } while (start)
    return out
  }
  async lifetimeSold() {
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: 'META', sk: 'COUNTERS' } }))
    return Number(r.Item?.lifetimeSold ?? 0)
  }
  async incLifetimeSold() {
    await this.db.send(new UpdateCommand({
      TableName: this.table, Key: { pk: 'META', sk: 'COUNTERS' }, UpdateExpression: 'ADD lifetimeSold :one',
      ExpressionAttributeValues: { ':one': 1 },
    }))
  }
}

/** In-memory store for tests and local runs. */
export class MemoryStore implements Store {
  subs = new Map<string, Subscription>()
  orders = new Map<string, Order>()
  payments: Payment[] = []
  lifetime = 0
  async getSub(sub: string) { const s = this.subs.get(sub); return s && { ...s } }
  async putSub(s: Subscription) { this.subs.set(s.sub, { ...s }) }
  async listSubs() { return [...this.subs.values()].map((s) => ({ ...s })) }
  async getOrder(id: string) { const o = this.orders.get(id); return o && { ...o } }
  async putOrder(o: Order) { this.orders.set(o.id, { ...o }) }
  async setOrderStatus(id: string, status: InvoiceStatus, modifiedDate: string, invoiceId?: string) {
    const o = this.orders.get(id)
    if (!o || (o.modifiedDate && o.modifiedDate >= modifiedDate)) return false
    Object.assign(o, { status, modifiedDate }, invoiceId ? { invoiceId } : {})
    return true
  }
  async claimApply(id: string) {
    const o = this.orders.get(id)
    if (!o || o.applied) return false
    o.applied = true
    return true
  }
  async addPayment(p: Payment) { this.payments.push({ ...p }) }
  async listPayments() { return [...this.payments].sort((a, b) => b.at.localeCompare(a.at)) }
  async lifetimeSold() { return this.lifetime }
  async incLifetimeSold() { this.lifetime++ }
}
