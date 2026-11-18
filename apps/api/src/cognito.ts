import {
  CognitoIdentityProviderClient, ListUsersCommand, AdminListGroupsForUserCommand, AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand, AdminEnableUserCommand, AdminDisableUserCommand, AdminUserGlobalSignOutCommand,
  AdminCreateUserCommand, ListUsersInGroupCommand, type UserType,
} from '@aws-sdk/client-cognito-identity-provider'

const client = new CognitoIdentityProviderClient({})
const POOL = () => process.env.USER_POOL_ID!

export interface User {
  username: string
  sub: string
  email: string
  name?: string
  enabled: boolean
  status: string
  providers: string[]
  createdAt?: string
  groups: string[]
}

const attr = (u: UserType, n: string) => u.Attributes?.find((a) => a.Name === n)?.Value

function providersOf(u: UserType): string[] {
  const ids = attr(u, 'identities')
  const linked = ids ? (JSON.parse(ids) as { providerName: string }[]).map((i) => i.providerName) : []
  return u.UserStatus === 'EXTERNAL_PROVIDER' ? linked : ['Email', ...linked]
}

async function groupsOf(username: string): Promise<string[]> {
  const out = await client.send(new AdminListGroupsForUserCommand({ UserPoolId: POOL(), Username: username, Limit: 60 }))
  return (out.Groups ?? []).map((g) => g.GroupName!).sort()
}

const toUser = async (u: UserType): Promise<User> => ({
  username: u.Username!,
  sub: attr(u, 'sub') ?? u.Username!,
  email: attr(u, 'email') ?? '',
  name: attr(u, 'name'),
  enabled: u.Enabled ?? true,
  status: u.UserStatus ?? 'UNKNOWN',
  providers: providersOf(u),
  createdAt: u.UserCreateDate?.toISOString(),
  groups: await groupsOf(u.Username!),
})

export async function listUsers(search?: string): Promise<User[]> {
  const users: UserType[] = []
  let token: string | undefined
  const filter = search ? `email ^= "${search.replace(/"/g, '').toLowerCase()}"` : undefined
  do {
    const out = await client.send(new ListUsersCommand({ UserPoolId: POOL(), Filter: filter, Limit: 60, PaginationToken: token }))
    users.push(...(out.Users ?? []))
    token = out.PaginationToken
  } while (token && users.length < 300)
  return Promise.all(users.map(toUser))
}

export async function getUser(username: string): Promise<User> {
  const out = await client.send(new ListUsersCommand({ UserPoolId: POOL(), Filter: `username = "${username.replace(/"/g, '')}"`, Limit: 1 }))
  const u = out.Users?.[0]
  if (!u) throw Object.assign(new Error('User not found'), { status: 400 })
  return toUser(u)
}

export const addToGroup = (username: string, group: string) =>
  client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL(), Username: username, GroupName: group }))
export const removeFromGroup = (username: string, group: string) =>
  client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL(), Username: username, GroupName: group }))
export const setEnabled = (username: string, enabled: boolean) =>
  client.send(enabled
    ? new AdminEnableUserCommand({ UserPoolId: POOL(), Username: username })
    : new AdminDisableUserCommand({ UserPoolId: POOL(), Username: username }))
export const signOutEverywhere = (username: string) =>
  client.send(new AdminUserGlobalSignOutCommand({ UserPoolId: POOL(), Username: username }))

export async function invite(email: string, groups: string[]): Promise<string> {
  const out = await client.send(new AdminCreateUserCommand({
    UserPoolId: POOL(), Username: email,
    UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }],
    DesiredDeliveryMediums: ['EMAIL'],
  }))
  const username = out.User!.Username!
  for (const g of groups) await addToGroup(username, g)
  return username
}

export async function countInGroup(group: string): Promise<number> {
  let n = 0
  let token: string | undefined
  do {
    const out = await client.send(new ListUsersInGroupCommand({ UserPoolId: POOL(), GroupName: group, Limit: 60, NextToken: token }))
    n += out.Users?.length ?? 0
    token = out.NextToken
  } while (token)
  return n
}
