// Builds the admin dashboard snapshot (cost, users, activity) and stores it in DynamoDB.
// Cost Explorer charges $0.01 per request, so one snapshot makes a single CE call (the Budgets API,
// which gives month-to-date and forecast, is free),
// and it runs once a day (plus a manual refresh the API rate-limits).
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer'
import { BudgetsClient, DescribeBudgetCommand } from '@aws-sdk/client-budgets'
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import { CognitoIdentityProviderClient, DescribeUserPoolCommand } from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { APP_INFO, appForCostKeys } from './apps'
import { countInGroup } from './cognito'

const ce = new CostExplorerClient({ region: 'us-east-1' })
const budgets = new BudgetsClient({ region: 'us-east-1' })
const cw = new CloudWatchClient({})
const idp = new CognitoIdentityProviderClient({})
const ddb = new DynamoDBClient({})

export interface Snapshot {
  generatedAt: string
  currency: string
  budget: number
  cost: {
    monthToDate: number
    forecast: number | null
    lastMonth: number
    byApp: Record<string, { monthToDate: number; lastMonth: number }>
    daily: { date: string; amount: number }[]
  }
  apps: {
    id: string
    name: string
    users: number | null
    legacyUsers: number | null
    invocations7d: number
    errors7d: number
    invocations30d: number
    daily: number[]
  }[]
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const round = (n: number) => Math.round(n * 100) / 100

export async function buildSnapshot(now = new Date()): Promise<Snapshot> {
  const [cost, activity, users] = await Promise.all([costs(now), lambdaActivity(now), userCounts()])
  return {
    generatedAt: now.toISOString(),
    currency: 'USD',
    budget: cost.budget,
    cost: cost.cost,
    apps: APP_INFO.map((a) => ({
      id: a.id, name: a.name, ...users[a.id]!, ...(activity[a.id] ?? { invocations7d: 0, errors7d: 0, invocations30d: 0, daily: [] }),
    })),
  }
}

async function costs(now: Date): Promise<{ budget: number; cost: Snapshot['cost'] }> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

  // Daily cost from the start of last month, split by app tags.
  const byApp: Snapshot['cost']['byApp'] = {}
  const dailyMap = new Map<string, number>()
  let monthToDate = 0
  let lastMonth = 0
  let token: string | undefined
  do {
    const out = await ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: iso(lastMonthStart), End: iso(tomorrow) },
      Granularity: 'DAILY', Metrics: ['UnblendedCost'], NextPageToken: token,
      GroupBy: [{ Type: 'TAG', Key: 'Project' }, { Type: 'TAG', Key: 'aws:cloudformation:stack-name' }],
    }))
    for (const day of out.ResultsByTime ?? []) {
      const date = day.TimePeriod!.Start!
      const inThisMonth = date >= iso(monthStart)
      for (const g of day.Groups ?? []) {
        const amount = Number(g.Metrics?.UnblendedCost?.Amount ?? 0)
        const app = appForCostKeys(g.Keys?.[0] ?? '', g.Keys?.[1] ?? '')
        const slot = (byApp[app] ??= { monthToDate: 0, lastMonth: 0 })
        if (inThisMonth) { slot.monthToDate += amount; monthToDate += amount; dailyMap.set(date, (dailyMap.get(date) ?? 0) + amount) }
        else { slot.lastMonth += amount; lastMonth += amount }
      }
    }
    token = out.NextPageToken
  } while (token)

  // Budgets API (free): limit, AWS's own month-to-date and forecast for the whole account.
  let budget = 0
  let forecast: number | null = null
  try {
    const b = await budgets.send(new DescribeBudgetCommand({ AccountId: process.env.ACCOUNT_ID ?? (await accountId()), BudgetName: process.env.BUDGET_NAME }))
    budget = Number(b.Budget?.BudgetLimit?.Amount ?? 0)
    const f = b.Budget?.CalculatedSpend?.ForecastedSpend?.Amount
    forecast = f ? round(Number(f)) : null
  } catch (e) { console.warn('budget unavailable', (e as Error).message) }

  for (const v of Object.values(byApp)) { v.monthToDate = round(v.monthToDate); v.lastMonth = round(v.lastMonth) }
  return {
    budget,
    cost: {
      monthToDate: round(monthToDate), forecast, lastMonth: round(lastMonth), byApp,
      daily: [...dailyMap].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount: round(amount) })),
    },
  }
}

const accountId = async () => {
  const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts')
  return (await new STSClient({}).send(new GetCallerIdentityCommand({}))).Account!
}

async function lambdaActivity(now: Date) {
  // One SEARCH per metric returns a series per function (labelled with its name); group them by app here.
  const search = (metric: string) => `SEARCH('{AWS/Lambda,FunctionName} MetricName="${metric}"', 'Sum', 86400)`
  const out = await cw.send(new GetMetricDataCommand({
    StartTime: new Date(now.getTime() - 30 * 86_400_000), EndTime: now, ScanBy: 'TimestampAscending',
    MetricDataQueries: [{ Id: 'inv', Expression: search('Invocations') }, { Id: 'err', Expression: search('Errors') }],
  }))
  const weekAgo = now.getTime() - 7 * 86_400_000
  const result: Record<string, { invocations7d: number; errors7d: number; invocations30d: number; daily: number[] }> = {}
  const days = new Map<string, Map<number, number>>()
  for (const a of APP_INFO) { result[a.id] = { invocations7d: 0, errors7d: 0, invocations30d: 0, daily: [] }; days.set(a.id, new Map()) }
  for (const r of out.MetricDataResults ?? []) {
    const app = APP_INFO.find((a) => (r.Label ?? '').startsWith(a.lambdaPrefix))
    if (!app) continue
    const slot = result[app.id]!
    ;(r.Timestamps ?? []).forEach((t, k) => {
      const v = r.Values?.[k] ?? 0
      const recent = t.getTime() >= weekAgo
      if (r.Id === 'inv') {
        slot.invocations30d += v
        if (recent) slot.invocations7d += v
        const day = Math.floor(t.getTime() / 86_400_000)
        days.get(app.id)!.set(day, (days.get(app.id)!.get(day) ?? 0) + v)
      } else if (recent) slot.errors7d += v
    })
  }
  const today = Math.floor(now.getTime() / 86_400_000)
  for (const a of APP_INFO) {
    const slot = result[a.id]!
    slot.daily = Array.from({ length: 30 }, (_, i) => Math.round(days.get(a.id)!.get(today - 29 + i) ?? 0))
    slot.invocations7d = Math.round(slot.invocations7d); slot.invocations30d = Math.round(slot.invocations30d); slot.errors7d = Math.round(slot.errors7d)
  }
  return result
}

async function userCounts() {
  const out: Record<string, { users: number | null; legacyUsers: number | null }> = {}
  await Promise.all(APP_INFO.map(async (a) => {
    const users = a.userGroup ? await countInGroup(a.userGroup).catch(() => null) : null
    const legacyUsers = a.legacyPoolId
      ? await idp.send(new DescribeUserPoolCommand({ UserPoolId: a.legacyPoolId })).then((r) => r.UserPool?.EstimatedNumberOfUsers ?? null).catch(() => null)
      : null
    out[a.id] = { users, legacyUsers }
  }))
  return out
}

const KEY = { pk: { S: 'stats' } }
export async function saveSnapshot(s: Snapshot) {
  await ddb.send(new PutItemCommand({ TableName: process.env.TABLE_NAME!, Item: { ...KEY, data: { S: JSON.stringify(s) } } }))
}
export async function loadSnapshot(): Promise<Snapshot | null> {
  const out = await ddb.send(new GetItemCommand({ TableName: process.env.TABLE_NAME!, Key: KEY }))
  return out.Item?.data?.S ? JSON.parse(out.Item.data.S) : null
}

/** Scheduled entry point: refresh the snapshot. */
export async function scheduled() {
  const s = await buildSnapshot()
  await saveSnapshot(s)
  return { ok: true, generatedAt: s.generatedAt }
}
