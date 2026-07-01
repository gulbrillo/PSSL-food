import { db } from '../../utils/db'
import { requireDbUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const { scope } = getQuery(event)
  const now = new Date()

  const where =
    scope === 'past'
      ? { date: { lt: now } }
      : scope === 'all'
        ? {}
        : { date: { gte: new Date(now.getTime() - 4 * 3600_000) } } // still show today's meeting a few hours in

  const [meetings, myPrefs] = await Promise.all([
    db.meeting.findMany({
      where,
      orderBy: { date: scope === 'past' ? 'desc' : 'asc' },
      include: {
        caterer: true,
        requests: true,
        rsvps: {
          include: {
            user: {
              include: { restrictions: { include: { restriction: true } } }
            }
          }
        }
      }
    }),
    db.catererPreference.findMany({ where: { userId: user.id } })
  ])

  return meetings.map((m) => {
    const attending = m.rsvps.filter((r) => r.attending)
    const restrictionCounts: Record<string, number> = {}
    for (const r of attending) {
      for (const ur of r.user.restrictions) {
        restrictionCounts[ur.restriction.name] = (restrictionCounts[ur.restriction.name] || 0) + 1
      }
    }
    const myRsvp = m.rsvps.find((r) => r.userId === user.id)
    const myRequest = m.requests.find((r) => r.userId === user.id)
    const myUsual = m.catererId ? myPrefs.find((p) => p.catererId === m.catererId) : undefined

    return {
      id: m.id,
      title: m.title,
      date: m.date,
      rsvpDeadline: m.rsvpDeadline,
      status: m.status,
      menuNotes: m.menuNotes,
      caterer: m.caterer
        ? { id: m.caterer.id, name: m.caterer.name, cuisine: m.caterer.cuisine, url: m.caterer.url }
        : null,
      attendingCount: attending.length,
      notAttendingCount: m.rsvps.filter((r) => !r.attending).length,
      restrictionCounts,
      myRsvp: myRsvp ? myRsvp.attending : null,
      myRequest: myRequest?.text ?? null,
      suggestedRequest: myRequest?.text ?? myUsual?.text ?? '',
      deadlinePassed: m.rsvpDeadline < now
    }
  })
})
