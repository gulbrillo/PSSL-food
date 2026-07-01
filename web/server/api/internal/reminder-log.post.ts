import { db } from '../../utils/db'
import { requireBot } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireBot(event)
  const body = await readBody<{ meetingId: string; kind: string }>(event)
  if (!body?.meetingId || !['channel', 'dm'].includes(body?.kind)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid reminder log' })
  }
  await db.reminderLog.upsert({
    where: { meetingId_kind: { meetingId: body.meetingId, kind: body.kind } },
    create: { meetingId: body.meetingId, kind: body.kind },
    update: {}
  })
  return { ok: true }
})
