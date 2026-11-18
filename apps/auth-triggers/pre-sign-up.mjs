// Cognito pre-sign-up trigger: one person = one account across email and Google sign-in.
// - Google sign-in for an email that already has an email/password account: link Google to it.
// - Email sign-up for an email that already signed in with Google: refuse, ask to use Google.
import {
  CognitoIdentityProviderClient, ListUsersCommand, AdminLinkProviderForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const cognito = new CognitoIdentityProviderClient({})

const usersByEmail = async (poolId, email) => {
  const out = await cognito.send(new ListUsersCommand({
    UserPoolId: poolId, Filter: `email = "${email.replace(/"/g, '')}"`, Limit: 10,
  }))
  return out.Users ?? []
}

export const handler = async (event) => {
  const email = event.request.userAttributes.email?.toLowerCase()
  if (!email) return event
  const existing = await usersByEmail(event.userPoolId, email)

  if (event.triggerSource === 'PreSignUp_ExternalProvider') {
    const [providerName, providerUserId] = event.userName.split('_')
    const native = existing.find((u) => u.UserStatus !== 'EXTERNAL_PROVIDER')
    if (native) {
      await cognito.send(new AdminLinkProviderForUserCommand({
        UserPoolId: event.userPoolId,
        DestinationUser: { ProviderName: 'Cognito', ProviderAttributeValue: native.Username },
        SourceUser: { ProviderName: providerName, ProviderAttributeName: 'Cognito_Subject', ProviderAttributeValue: providerUserId },
      }))
    }
    event.response.autoConfirmUser = true
    event.response.autoVerifyEmail = true
    return event
  }

  if (event.triggerSource === 'PreSignUp_SignUp' && existing.some((u) => u.UserStatus === 'EXTERNAL_PROVIDER')) {
    throw new Error('This email already uses Google sign-in. Please continue with Google.')
  }
  return event
}
