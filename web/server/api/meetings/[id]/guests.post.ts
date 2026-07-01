import { db } from '../../../utils/db'
import { requireDbUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name: string; restrictions?: string[] }>(event)

  const name = (body?.name || '').trim().slice(0, 80)
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Guest name required' })

  const meeting = await db.meeting.findUnique({ where: { id } })
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found' })

  const restrictions = Array.isArray(body.restrictions)
    ? body.restrictions.map((r) => String(r).trim()).filter(Boolean).slice(0, 20)
    : []

  return db.guest.create({
    data: { meetingId: id, name, restrictions, addedByName: user.name }
  })
})
