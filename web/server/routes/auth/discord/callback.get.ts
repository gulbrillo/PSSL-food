import { db } from '../../../utils/db'
import { requireDbUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const config = useRuntimeConfig(event)
  const { code, state } = getQuery(event)

  const session = await getUserSession(event)
  if (!code || !state || state !== (session as any)?.discordState) {
    return sendRedirect(event, '/profile?error=discord')
  }

  try {
    const token = await $fetch<{ access_token: string }>('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: `${config.public.appUrl}/auth/discord/callback`
      }).toString()
    })

    const me = await $fetch<{ id: string; username: string; global_name?: string }>(
      'https://discord.com/api/users/@me',
      { headers: { authorization: `Bearer ${token.access_token}` } }
    )

    const existing = await db.user.findUnique({ where: { discordId: me.id } })
    if (existing && existing.id !== user.id) {
      return sendRedirect(event, '/profile?error=discord_taken')
    }

    await db.user.update({
      where: { id: user.id },
      data: { discordId: me.id, discordUsername: me.global_name || me.username }
    })
  } catch (e) {
    console.error('Discord link failed:', e)
    return sendRedirect(event, '/profile?error=discord')
  }

  return sendRedirect(event, '/profile?linked=1')
})
