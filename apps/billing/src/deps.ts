// Wires the real AWS + monobank dependencies. The monobank token lives in SSM (SecureString).
import { SSMClient, GetParameterCommand, ParameterNotFound } from '@aws-sdk/client-ssm'
import {
  CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand, AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { Billing, BillingError, type Groups } from './billing'
import { HttpMono, makeVerifier, type Mono } from './mono'
import { DynamoStore } from './store'
import { PLUS_GROUP } from './plans'

const idp = new CognitoIdentityProviderClient({})
const POOL = () => process.env.USER_POOL_ID!

export const cognitoGroups: Groups = {
  async add(username) {
    await idp.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL(), Username: username, GroupName: PLUS_GROUP }))
  },
  async remove(username) {
    try { await idp.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL(), Username: username, GroupName: PLUS_GROUP })) }
    catch (e) { if ((e as Error).name !== 'UserNotFoundException') throw e }
  },
}

export async function emailOf(username: string): Promise<string | undefined> {
  const u = await idp.send(new AdminGetUserCommand({ UserPoolId: POOL(), Username: username }))
  return u.UserAttributes?.find((a) => a.Name === 'email')?.Value
}

let monoPromise: Promise<Mono | null> | undefined
async function loadMono(): Promise<Mono | null> {
  try {
    const r = await new SSMClient({}).send(new GetParameterCommand({ Name: process.env.MONO_TOKEN_PARAM!, WithDecryption: true }))
    const token = r.Parameter?.Value?.trim()
    return token ? new HttpMono(token) : null
  } catch (e) {
    if (e instanceof ParameterNotFound) return null
    throw e
  }
}

const unconfigured: Mono = new Proxy({} as Mono, {
  get: () => async () => { throw new BillingError(503, 'Payments are not set up yet. Please try again later.') },
})

let billing: { billing: Billing; verify: ReturnType<typeof makeVerifier> } | undefined
export async function getBilling() {
  if (billing) return billing
  monoPromise ??= loadMono()
  const mono = (await monoPromise) ?? unconfigured
  billing = {
    billing: new Billing({ store: new DynamoStore(), mono, groups: cognitoGroups, siteUrl: process.env.SITE_URL! }),
    verify: makeVerifier(mono),
  }
  return billing
}
