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
  return { ok: true }
})
