import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; description?: string }>(event)

  const data: any = {}
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name || name.length > 60) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid restriction name' })
    }
    data.name = name
  }
  if ('description' in body) {
    data.description = (body.description || '').trim().slice(0, 500) || null
  }

  try {
    return await db.restriction.update({ where: { id }, data })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw createError({ statusCode: 400, statusMessage: 'A restriction with that name already exists' })
    }
    throw e
  }
})
