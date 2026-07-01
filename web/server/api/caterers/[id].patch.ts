import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; cuisine?: string; url?: string; notes?: string; active?: boolean }>(event)

  const data: any = {}
  if (body.name?.trim()) data.name = body.name.trim()
  if ('cuisine' in body) data.cuisine = body.cuisine?.trim() || null
  if ('url' in body) data.url = body.url?.trim() || null
  if ('notes' in body) data.notes = body.notes?.trim() || null
  if (typeof body.active === 'boolean') data.active = body.active

  return db.caterer.update({ where: { id }, data })
})
