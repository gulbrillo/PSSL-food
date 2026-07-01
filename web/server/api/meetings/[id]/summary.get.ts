import { db } from '../../../utils/db'
import { requireDbUser } from '../../../utils/auth'

// Visible to every member: who's coming, dietary counts, requests, guests.
export default defineEventHandler(async (event) => {
  await requireDbUser(event)
  const id = getRouterParam(event, 'id')!

  const [meeting, allUsers] = await Promise.all([
    db.meeting.findUnique({
      where: { id },
      include: {
        caterer: true,
        guests: { orderBy: { createdAt: 'asc' } },
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
  const bump = (name: string) => (restrictionCounts[name] = (restrictionCounts[name] || 0) + 1)
  for (const r of attending) {
    for (const ur of r.user.restrictions) bump(ur.restriction.name)
  }
  for (const g of meeting.guests) {
    for (const name of g.restrictions) bump(name)
  }

  return {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      caterer: meeting.caterer?.name ?? null
    },
    attending: attending.map((r) => ({
      name: r.user.name,
      late: r.late,
      restrictions: r.user.restrictions.map((ur) => ur.restriction.name)
    })),
    guests: meeting.guests.map((g) => ({
      id: g.id,
      name: g.name,
      restrictions: g.restrictions,
      addedByName: g.addedByName
    })),
    notAttending: notAttending.map((r) => ({ name: r.user.name, late: r.late })),
    noResponse: allUsers.filter((u) => !respondedIds.has(u.id)).map((u) => u.name),
    restrictionCounts,
    requests: meeting.requests.map((q) => ({ name: q.user.name, text: q.text, late: q.late })),
    totalAttending: attending.length + meeting.guests.length
  }
})
