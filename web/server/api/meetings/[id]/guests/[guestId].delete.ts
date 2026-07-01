import { db } from '../../../../utils/db'
import { requireDbUser } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireDbUser(event)
  const guestId = getRouterParam(event, 'guestId')!
  await db.guest.delete({ where: { id: guestId } })
  return { ok: true }
})
