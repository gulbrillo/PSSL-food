import { db } from '../../../utils/db'
import { requireDbUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ attending: boolean }>(event)

  const meeting = await db.meeting.findUnique({ where: { id } })
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found' })
  if (meeting.status === 'cancelled') {
    throw createError({ statusCode: 400, statusMessage: 'Meeting is cancelled' })
  }
  if (meeting.rsvpDeadline < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'RSVP deadline has passed' })
  }

  await db.rsvp.upsert({
    where: { userId_meetingId: { userId: user.id, meetingId: id } },
    create: { userId: user.id, meetingId: id, attending: !!body.attending },
    update: { attending: !!body.attending }
  })
  return { ok: true }
})
