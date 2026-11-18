// Only Tools Plus prices. Amounts are in kopecks (UAH minor units), as monobank expects.
import limits from '../limits.json'

export type PlanId = 'monthly' | 'yearly' | 'lifetime'

export interface Plan {
  id: PlanId
  amount: number
  /** Months added per payment; null = never expires. */
  months: number | null
}

export const PLANS: Record<PlanId, Plan> = {
  monthly: { id: 'monthly', amount: 99_00, months: 1 },
  yearly: { id: 'yearly', amount: 790_00, months: 12 },
  lifetime: { id: 'lifetime', amount: 1990_00, months: null },
}

/** Founding lifetime offer: only the first N buyers. */
export const LIFETIME_CAP = 100

export const PLUS_GROUP = limits.plusGroup
export const LIMITS = limits.apps

export const DONATION_MIN = 20_00
export const DONATION_MAX = 50_000_00

/** Days a failed renewal keeps Plus while we retry the card. */
export const GRACE_DAYS = 7
/** Days after a failed renewal attempt before the next one (attempt 1, 2, 3). */
export const RETRY_AFTER_DAYS = [1, 2, 3]

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

/** Monthly recurring revenue of one plan, in kopecks. */
export const monthlyValue = (plan: PlanId) => (plan === 'monthly' ? PLANS.monthly.amount : plan === 'yearly' ? Math.round(PLANS.yearly.amount / 12) : 0)
