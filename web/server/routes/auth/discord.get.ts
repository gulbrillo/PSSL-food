import { randomBytes } from 'node:crypto'
import { requireDbUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireDbUser(event)
  const config = useRuntimeConfig(event)

  const state = randomBytes(16).toString('hex')
  const session = await getUserSession(event)
  await setUserSession(event, { ...(session as any), discordState: state })

  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', config.discordClientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', `${config.public.appUrl}/auth/discord/callback`)
  url.searchParams.set('scope', 'identify')
  url.searchParams.set('state', state)

  return sendRedirect(event, url.toString())
})
