// Only Tools Plus prices. Amounts are in minor units (kopecks, cents), as monobank expects.
import limits from '../limits.json'

export type PlanId = 'monthly' | 'yearly' | 'lifetime'
/** UAH for Ukraine, USD for everyone else. */
export type Currency = 'UAH' | 'USD'
export const CURRENCIES: Currency[] = ['UAH', 'USD']
/** ISO 4217 numeric codes monobank expects in `ccy`. */
export const CCY: Record<Currency, number> = { UAH: 980, USD: 840 }

export interface Plan {
  id: PlanId
  /** Months added per payment; null = never expires. */
  months: number | null
}

export const PLANS: Record<PlanId, Plan> = {
  monthly: { id: 'monthly', months: 1 },
  yearly: { id: 'yearly', months: 12 },
  lifetime: { id: 'lifetime', months: null },
}

/** Prices in minor units (kopecks, cents). */
export const PRICES: Record<Currency, Record<PlanId, number>> = {
  UAH: { monthly: 99_00, yearly: 790_00, lifetime: 1990_00 },
  USD: { monthly: 2_99, yearly: 24_00, lifetime: 49_00 },
}

/** Founding lifetime offer: only the first N buyers. */
export const LIFETIME_CAP = 100

export const PLUS_GROUP = limits.plusGroup
export const LIMITS = limits.apps

export const DONATION_LIMITS: Record<Currency, { min: number; max: number }> = {
  UAH: { min: 20_00, max: 50_000_00 },
  USD: { min: 1_00, max: 1_000_00 },
}

/** Days a failed renewal keeps Plus while we retry the card. */
export const GRACE_DAYS = 7
/** Days after a failed renewal attempt before the next one (attempt 1, 2, 3). */
export const RETRY_AFTER_DAYS = [1, 2, 3]

export const isCurrency = (v: unknown): v is Currency => v === 'UAH' || v === 'USD'
export const isPlan = (v: unknown): v is PlanId => v === 'monthly' || v === 'yearly' || v === 'lifetime'

/** Adds calendar months; the 31st becomes the last day of a shorter month. */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

export const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 86_400_000)

/** Monthly recurring revenue of one plan, in minor units of its currency. */
export const monthlyValue = (plan: PlanId, cur: Currency) =>
  plan === 'monthly' ? PRICES[cur].monthly : plan === 'yearly' ? Math.round(PRICES[cur].yearly / 12) : 0
