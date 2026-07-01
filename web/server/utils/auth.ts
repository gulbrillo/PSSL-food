import type { H3Event } from 'h3'
import { db } from './db'

export async function requireDbUser(event: H3Event) {
  const session = await getUserSession(event)
  const id = (session?.user as any)?.id
  if (!id) throw createError({ statusCode: 401, statusMessage: 'Not logged in' })
  const user = await db.user.findUnique({
    where: { id },
    include: { restrictions: { include: { restriction: true } } }
  })
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Not logged in' })
  return user
}

export async function requireAdmin(event: H3Event) {
  const user = await requireDbUser(event)
  if (!user.isAdmin) throw createError({ statusCode: 403, statusMessage: 'Admins only' })
  return user
}

/** For the Discord bot's internal API. */
export function requireBot(event: H3Event) {
  const config = useRuntimeConfig(event)
  const auth = getHeader(event, 'authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!config.botApiToken || token !== config.botApiToken) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid bot token' })
  }
}
