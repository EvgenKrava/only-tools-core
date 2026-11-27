// Daily job (EventBridge Scheduler): renew due subscriptions, retry failed cards, expire lapsed Plus.
import { getBilling } from './deps'

export async function handler() {
  const { billing } = await getBilling()
  // While payments are paused, renewals are not charged; expiries still run.
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    const result = await billing.daily({ charge: false })
    console.log(JSON.stringify({ msg: 'daily billing (paused)', ...result }))
    return result
  }
  const result = await billing.daily()
  console.log(JSON.stringify({ msg: 'daily billing', ...result }))
  return result
}
