import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ meetings: { date: string; rsvpDeadline: string; title?: string }[] }>(event)

  const items = (body?.meetings || [])
    .map((m) => ({
      date: new Date(m.date),
      rsvpDeadline: new Date(m.rsvpDeadline),
      title: (m.title || 'PSSL Group Meeting').trim()
    }))
    .filter((m) => !isNaN(m.date.getTime()) && !isNaN(m.rsvpDeadline.getTime()))

  if (!items.length) throw createError({ statusCode: 400, statusMessage: 'No valid meetings' })

  await db.meeting.createMany({ data: items })
  return { ok: true, created: items.length }
})
