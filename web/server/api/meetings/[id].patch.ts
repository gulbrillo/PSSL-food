import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    date?: string
    rsvpDeadline?: string
    status?: string
    title?: string
    catererId?: string | null
    menuNotes?: string | null
  }>(event)

  const data: any = {}
  if (body.date) data.date = new Date(body.date)
  if (body.rsvpDeadline) data.rsvpDeadline = new Date(body.rsvpDeadline)
  if (body.status && ['scheduled', 'cancelled'].includes(body.status)) data.status = body.status
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if ('catererId' in body) data.catererId = body.catererId || null
  if ('menuNotes' in body) data.menuNotes = body.menuNotes?.trim() || null

  return db.meeting.update({ where: { id }, data })
})
