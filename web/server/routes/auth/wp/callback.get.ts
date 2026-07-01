import { db } from '../../../utils/db'

interface WpUserinfo {
  sub: number
  email: string
  name: string
  first_name?: string
  last_name?: string
  username: string
  roles: string[]
}

/** Prefer a human name: WP display_name, unless it's empty or just the login
 *  name (e.g. "admin"), in which case fall back to first/last name. */
function pickName(u: WpUserinfo) {
  const display = (u.name || '').trim()
  const full = [u.first_name, u.last_name].map((s) => (s || '').trim()).filter(Boolean).join(' ')
  const generic = !display || display.toLowerCase() === (u.username || '').toLowerCase()
  return (generic ? full || display : display) || u.username || u.email
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { code, state } = getQuery(event)

  const session = await getUserSession(event)
  if (!code || !state || state !== (session as any)?.wpState) {
    return sendRedirect(event, '/login?error=state')
  }

  let userinfo: WpUserinfo
  try {
    const token = await $fetch<{ access_token: string }>(
      `${config.wpBaseUrl}/wp-json/pssl-sso/v1/token`,
      {
        method: 'POST',
        body: {
          grant_type: 'authorization_code',
          code,
          client_id: config.wpClientId,
          client_secret: config.wpClientSecret,
          redirect_uri: `${config.public.appUrl}/auth/wp/callback`
        }
      }
    )
    userinfo = await $fetch<WpUserinfo>(`${config.wpBaseUrl}/wp-json/pssl-sso/v1/userinfo`, {
      headers: { authorization: `Bearer ${token.access_token}` }
    })
  } catch (e) {
    console.error('WP SSO exchange failed:', e)
    return sendRedirect(event, '/login?error=sso')
  }

  const adminEmails = config.adminEmails
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean)
  const isAdmin =
    userinfo.roles.some((r) => ['administrator', 'editor'].includes(r)) ||
    adminEmails.includes(userinfo.email.toLowerCase())

  const name = pickName(userinfo)
  const user = await db.user.upsert({
    where: { wpId: userinfo.sub },
    create: {
      wpId: userinfo.sub,
      email: userinfo.email,
      name,
      username: userinfo.username,
      isAdmin
    },
    update: {
      email: userinfo.email,
      name,
      username: userinfo.username,
      isAdmin
    }
  })

  await replaceUserSession(event, {
    user: { id: user.id, name: user.name, isAdmin: user.isAdmin }
  })

  return sendRedirect(event, '/')
})
