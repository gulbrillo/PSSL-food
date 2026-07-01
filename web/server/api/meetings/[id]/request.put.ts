import { db } from '../../../utils/db'
import { requireDbUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ text: string; saveAsUsual?: boolean }>(event)
  const text = (body?.text || '').trim().slice(0, 300)

  const meeting = await db.meeting.findUnique({ where: { id } })
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found' })
  if (!meeting.catererId) {
    throw createError({ statusCode: 400, statusMessage: 'No caterer selected for this meeting yet' })
  }
  if (meeting.rsvpDeadline < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'RSVP deadline has passed' })
  }

  if (text) {
    await db.mealRequest.upsert({
      where: { userId_meetingId: { userId: user.id, meetingId: id } },
      create: { userId: user.id, meetingId: id, text },
      update: { text }
    })
    if (body.saveAsUsual) {
      await db.catererPreference.upsert({
        where: { userId_catererId: { userId: user.id, catererId: meeting.catererId } },
        create: { userId: user.id, catererId: meeting.catererId, text },
        update: { text }
      })
    }
  } else {
    await db.mealRequest.deleteMany({ where: { userId: user.id, meetingId: id } })
  }
  return { ok: true }
})
