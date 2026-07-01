import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const state = randomBytes(16).toString('hex')
  await setUserSession(event, { wpState: state } as any)

  const url = new URL(config.wpBaseUrl)
  url.searchParams.set('pssl_sso', 'authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.wpClientId)
  url.searchParams.set('redirect_uri', `${config.public.appUrl}/auth/wp/callback`)
  url.searchParams.set('state', state)

  return sendRedirect(event, url.toString())
})
