import { db } from '../../../utils/db'
import { requireAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!

  const [meeting, allUsers] = await Promise.all([
    db.meeting.findUnique({
      where: { id },
      include: {
        caterer: true,
        requests: { include: { user: true } },
        rsvps: {
          include: { user: { include: { restrictions: { include: { restriction: true } } } } }
        }
      }
    }),
    db.user.findMany({ select: { id: true, name: true } })
  ])
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found' })

  const attending = meeting.rsvps.filter((r) => r.attending)
  const notAttending = meeting.rsvps.filter((r) => !r.attending)
  const respondedIds = new Set(meeting.rsvps.map((r) => r.userId))

  const restrictionCounts: Record<string, number> = {}
  for (const r of attending) {
    for (const ur of r.user.restrictions) {
      restrictionCounts[ur.restriction.name] = (restrictionCounts[ur.restriction.name] || 0) + 1
    }
  }

  return {
    attending: attending.map((r) => ({
      name: r.user.name,
      restrictions: r.user.restrictions.map((ur) => ur.restriction.name)
    })),
    notAttending: notAttending.map((r) => r.user.name),
    noResponse: allUsers.filter((u) => !respondedIds.has(u.id)).map((u) => u.name),
    restrictionCounts,
    requests: meeting.requests.map((q) => ({ name: q.user.name, text: q.text }))
  }
})
