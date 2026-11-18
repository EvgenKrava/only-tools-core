// Daily job (EventBridge Scheduler): renew due subscriptions, retry failed cards, expire lapsed Plus.
import { getBilling } from './deps'

export async function handler() {
  const { billing } = await getBilling()
  const result = await billing.daily()
  console.log(JSON.stringify({ msg: 'daily billing', ...result }))
  return result
}
