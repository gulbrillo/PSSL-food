import { db } from '../../utils/db'
import { requireBot } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireBot(event)
  const body = await readBody<{
    discordId: string
    meetingId?: string
    attending: boolean
    request?: string
  }>(event)

  const user = await db.user.findUnique({ where: { discordId: body.discordId } })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'not_linked' })
  }

  const now = new Date()
  const meeting = body.meetingId
    ? await db.meeting.findUnique({ where: { id: body.meetingId }, include: { caterer: true } })
    : await db.meeting.findFirst({
        where: { status: 'scheduled', date: { gt: now } },
        orderBy: { date: 'asc' },
        include: { caterer: true }
      })

  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'no_open_meeting' })
  if (meeting.status === 'cancelled') throw createError({ statusCode: 400, statusMessage: 'meeting_cancelled' })
  if (meeting.date < now) throw createError({ statusCode: 400, statusMessage: 'meeting_over' })

  // late responses are allowed — they just get flagged, like on the website
  const late = meeting.rsvpDeadline < now

  await db.rsvp.upsert({
    where: { userId_meetingId: { userId: user.id, meetingId: meeting.id } },
    create: { userId: user.id, meetingId: meeting.id, attending: !!body.attending, late },
    update: { attending: !!body.attending, late }
  })

  const request = (body.request || '').trim().slice(0, 300)
  if (request && meeting.catererId) {
    await db.mealRequest.upsert({
      where: { userId_meetingId: { userId: user.id, meetingId: meeting.id } },
      create: { userId: user.id, meetingId: meeting.id, text: request, late },
      update: { text: request, late }
    })
  }

  return {
    ok: true,
    late,
    meeting: {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      catererName: meeting.caterer?.name ?? null
    },
    requestSaved: !!(request && meeting.catererId)
  }
})
