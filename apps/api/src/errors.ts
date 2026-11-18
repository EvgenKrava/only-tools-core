// Errors view: CloudWatch alarms and recent error log lines from every app's Lambdas.
// Runs only when an admin opens the tab; one Logs Insights query over a small window (cents per GB scanned).
import { CloudWatchClient, DescribeAlarmsCommand } from '@aws-sdk/client-cloudwatch'
import { CloudWatchLogsClient, DescribeLogGroupsCommand, GetQueryResultsCommand, StartQueryCommand } from '@aws-sdk/client-cloudwatch-logs'
import { APP_INFO } from './apps'

const cw = new CloudWatchClient({})
const logs = new CloudWatchLogsClient({})

export interface AlarmInfo { name: string; app: string; state: string; reason?: string; updatedAt?: string; description?: string }
export interface ErrorEntry { app: string; fn: string; time: string; message: string }

const appOfName = (name: string) => APP_INFO.find((a) => name.startsWith(a.lambdaPrefix) || name.startsWith(`/aws/lambda/${a.lambdaPrefix}`))?.id ?? 'other'

export async function alarms(): Promise<AlarmInfo[]> {
  const out = await cw.send(new DescribeAlarmsCommand({ MaxRecords: 100 }))
  return (out.MetricAlarms ?? [])
    .map((a) => ({
      name: a.AlarmName!, app: appOfName(a.AlarmName!), state: a.StateValue ?? 'UNKNOWN',
      reason: a.StateReason, updatedAt: a.StateUpdatedTimestamp?.toISOString(), description: a.AlarmDescription,
    }))
    .sort((x, y) => Number(y.state === 'ALARM') - Number(x.state === 'ALARM') || x.name.localeCompare(y.name))
}

export const ERROR_FILTER = String.raw`@message like /(?i)(\berror\b|exception|task timed out|"level":\s*"?(error|fatal|50|60)"?|unhandled|runtime\.)/ and @message not like /(?i)"level":\s*"?(info|debug|warn|30|40)"?/`

export async function recentErrors(hours: number, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<ErrorEntry[]> {
  const groups: string[] = []
  let token: string | undefined
  do {
    const out = await logs.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: '/aws/lambda/', nextToken: token }))
    for (const g of out.logGroups ?? []) if (appOfName(g.logGroupName!) !== 'other') groups.push(g.logGroupName!)
    token = out.nextToken
  } while (token && groups.length < 50)
  if (!groups.length) return []

  const end = Math.floor(Date.now() / 1000)
  const { queryId } = await logs.send(new StartQueryCommand({
    logGroupNames: groups.slice(0, 50), startTime: end - hours * 3600, endTime: end,
    queryString: `fields @timestamp, @log, @message | filter ${ERROR_FILTER} | sort @timestamp desc | limit 100`,
  }))
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    const r = await logs.send(new GetQueryResultsCommand({ queryId }))
    if (r.status === 'Complete' || r.status === 'Failed' || r.status === 'Cancelled' || r.status === 'Timeout') {
      return (r.results ?? []).map((row) => {
        const f = Object.fromEntries(row.map((c) => [c.field, c.value ?? '']))
        const fn = (f['@log'] ?? '').split(':/aws/lambda/')[1] ?? f['@log'] ?? ''
        return { app: appOfName(fn), fn, time: new Date(`${f['@timestamp']}Z`).toISOString(), message: (f['@message'] ?? '').slice(0, 2000) }
      })
    }
  }
  throw new Error('Log query took too long; try a shorter window.')
}
