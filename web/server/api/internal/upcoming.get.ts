import { db } from '../../utils/db'
import { requireBot } from '../../utils/auth'
import { getSetting } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  requireBot(event)
  const config = useRuntimeConfig(event)
  const now = new Date()
  const dmReminders = (await getSetting('dmReminders', 'false')) === 'true'

  const [meetings, totalMembers] = await Promise.all([
    db.meeting.findMany({
      where: { status: 'scheduled', date: { gte: now } },
      orderBy: { date: 'asc' },
      include: { caterer: true, rsvps: true, reminders: true }
    }),
    db.user.count()
  ])

  const linkedUsers = await db.user.findMany({
    where: { discordId: { not: null } },
    select: { id: true, discordId: true }
  })

  return {
    appUrl: config.public.appUrl,
    dmReminders,
    totalMembers,
    meetings: meetings.map((m) => {
      const respondedIds = new Set(m.rsvps.map((r) => r.userId))
      return {
        id: m.id,
        title: m.title,
        date: m.date,
        rsvpDeadline: m.rsvpDeadline,
        catererName: m.caterer?.name ?? null,
        menuNotes: m.menuNotes,
        attending: m.rsvps.filter((r) => r.attending).length,
        responded: m.rsvps.length,
        nonResponderDiscordIds: linkedUsers
          .filter((u) => !respondedIds.has(u.id))
          .map((u) => u.discordId!),
        remindersSent: m.reminders.map((r) => r.kind)
      }
    })
  }
})
