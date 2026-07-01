import { db } from '../../utils/db'
import { requireDbUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireDbUser(event)
  const body = await readBody<{ name: string }>(event)
  const name = (body?.name || '').trim()
  if (!name || name.length > 60) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid restriction name' })
  }
  return db.restriction.upsert({ where: { name }, create: { name }, update: {} })
})
