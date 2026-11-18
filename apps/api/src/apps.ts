// What the admin dashboard knows about each app: how to find its cost, its Lambdas and its users.
export interface AppInfo {
  id: string
  name: string
  /** Cost Explorer tag that marks the app's resources. */
  costTag: { key: 'Project' | 'aws:cloudformation:stack-name'; value: string }
  /** Prefix of the app's Lambda function names. */
  lambdaPrefix: string
  /** Group in the shared pool that grants access; core has none. */
  userGroup?: string
  /** The app's own pool until it moves to the shared one. */
  legacyPoolId?: string
}

export const APP_INFO: AppInfo[] = [
  { id: 'core', name: 'Only Tools core', costTag: { key: 'Project', value: 'onlytools' }, lambdaPrefix: 'onlytools-' },
  { id: 'carlog', name: 'CarLog', costTag: { key: 'aws:cloudformation:stack-name', value: 'CarLogStack' }, lambdaPrefix: 'CarLogStack-', userGroup: 'carlog-user', legacyPoolId: 'us-east-1_9rAPEPc5f' },
  { id: 'gighunter', name: 'GigHunter', costTag: { key: 'Project', value: 'gighunter' }, lambdaPrefix: 'gighunter-', userGroup: 'gighunter-user', legacyPoolId: 'us-east-1_LUdGl9JCZ' },
  { id: 'foodlog', name: 'FoodLog', costTag: { key: 'Project', value: 'foodlog' }, lambdaPrefix: 'foodlog-', userGroup: 'foodlog-user' },
]

/** Which app a Cost Explorer group belongs to. Keys look like "Project$gighunter" and "aws:cloudformation:stack-name$CarLogStack". */
export function appForCostKeys(projectKey: string, stackKey: string): string {
  const project = projectKey.split('$')[1] ?? ''
  const stack = stackKey.split('$')[1] ?? ''
  const hit = APP_INFO.find((a) =>
    (a.costTag.key === 'Project' && a.costTag.value === project) ||
    (a.costTag.key === 'aws:cloudformation:stack-name' && a.costTag.value === stack))
  return hit?.id ?? 'other'
}
