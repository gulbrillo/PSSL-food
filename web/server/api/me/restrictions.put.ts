import { db } from '../../utils/db'
import { requireDbUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<{ restrictionIds: string[] }>(event)
  const ids = Array.isArray(body?.restrictionIds) ? body.restrictionIds : []

  await db.$transaction([
    db.userRestriction.deleteMany({ where: { userId: user.id } }),
    db.userRestriction.createMany({
      data: ids.map((restrictionId) => ({ userId: user.id, restrictionId })),
      skipDuplicates: true
    })
  ])

  // Restriction changes affect the headcount of meetings whose RSVP deadline
  // already passed — flag those RSVPs as late so the order summary shows it.
  const now = new Date()
  const flagged = await db.rsvp.updateMany({
    where: {
      userId: user.id,
      attending: true,
      meeting: { rsvpDeadline: { lt: now }, date: { gt: now }, status: 'scheduled' }
    },
    data: { late: true }
  })

  return { ok: true, lateFlagged: flagged.count }
})
