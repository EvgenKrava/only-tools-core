// Cognito post-confirmation trigger: grant the default app roles to every new account,
// and platform-admin to the emails listed in ADMIN_EMAILS.
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider'

const cognito = new CognitoIdentityProviderClient({})
const DEFAULT_GROUPS = (process.env.DEFAULT_GROUPS ?? '').split(',').filter(Boolean)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').toLowerCase().split(',').filter(Boolean)
const ADMIN_GROUPS = (process.env.ADMIN_GROUPS ?? '').split(',').filter(Boolean)

export const handler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event
  const email = event.request.userAttributes.email?.toLowerCase()
  const groups = [...DEFAULT_GROUPS, ...(ADMIN_EMAILS.includes(email) ? ADMIN_GROUPS : [])]
  for (const GroupName of new Set(groups)) {
    await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: event.userPoolId, Username: event.userName, GroupName }))
  }
  return event
}
