export const APPS = ['carlog', 'gighunter', 'foodlog'] as const
export type AppId = (typeof APPS)[number]
export const PLATFORM_ADMIN = 'platform-admin'
export const ROLES: string[] = [PLATFORM_ADMIN, ...APPS.flatMap((a) => [`${a}-user`, `${a}-admin`])]

export const isRole = (g: string) => ROLES.includes(g)

/** Groups claim from an API Gateway JWT authorizer: either a real array or the string "[a b c]". */
export function parseGroups(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String)
  if (typeof claim !== 'string' || !claim) return []
  return claim.replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean)
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** An admin may not lock themselves out. */
export function assertCanChange(actorSub: string, targetSub: string, group: string | null, action: 'add' | 'remove' | 'disable' | 'signout') {
  if (actorSub !== targetSub) return
  if (action === 'disable') throw new HttpError(400, 'You cannot disable your own account.')
  if (action === 'remove' && group === PLATFORM_ADMIN) throw new HttpError(400, 'You cannot remove your own platform-admin role.')
}
