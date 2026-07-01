import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; cuisine?: string; url?: string; notes?: string; active?: boolean }>(event)

  const data: any = {}
  if ('name' in body) {
    const name = (body.name || '').trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Caterer name cannot be empty' })
    data.name = name
  }
  if ('cuisine' in body) data.cuisine = body.cuisine?.trim() || null
  if ('url' in body) data.url = body.url?.trim() || null
  if ('notes' in body) data.notes = body.notes?.trim() || null
  if (typeof body.active === 'boolean') data.active = body.active

  try {
    return await db.caterer.update({ where: { id }, data })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw createError({ statusCode: 400, statusMessage: 'A caterer with that name already exists' })
    }
    throw e
  }
})
