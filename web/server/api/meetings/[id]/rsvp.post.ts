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

  // changes are always allowed — after the deadline they are just flagged as late
  const late = meeting.rsvpDeadline < new Date()

  await db.rsvp.upsert({
    where: { userId_meetingId: { userId: user.id, meetingId: id } },
    create: { userId: user.id, meetingId: id, attending: !!body.attending, late },
    update: { attending: !!body.attending, late }
  })
  return { ok: true, late }
})
