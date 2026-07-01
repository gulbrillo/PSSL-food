import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ name: string; cuisine?: string; url?: string; notes?: string }>(event)
  const name = (body?.name || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name required' })

  return db.caterer.create({
    data: {
      name,
      cuisine: body.cuisine?.trim() || null,
      url: body.url?.trim() || null,
      notes: body.notes?.trim() || null
    }
  })
})
