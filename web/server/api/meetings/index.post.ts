import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ meetings: { date: string; rsvpDeadline: string; title?: string }[] }>(event)

  const now = new Date()
  const items = (body?.meetings || [])
    .map((m) => {
      const date = new Date(m.date)
      let rsvpDeadline = new Date(m.rsvpDeadline)
      // meeting created inside the deadline window (e.g. "2 days before" but the
      // meeting is tomorrow): keep RSVPs open until the meeting starts
      if (rsvpDeadline < now) rsvpDeadline = date
      return { date, rsvpDeadline, title: (m.title || 'PSSL Group Meeting').trim() }
    })
    .filter((m) => !isNaN(m.date.getTime()) && !isNaN(m.rsvpDeadline.getTime()))

  if (!items.length) throw createError({ statusCode: 400, statusMessage: 'No valid meetings' })

  await db.meeting.createMany({ data: items })
  return { ok: true, created: items.length }
})
