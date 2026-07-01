import { db } from '../../../utils/db'
import { requireDbUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const catererId = getRouterParam(event, 'id')!

  const existing = await db.catererVote.findUnique({
    where: { userId_catererId: { userId: user.id, catererId } }
  })
  if (existing) {
    await db.catererVote.delete({ where: { userId_catererId: { userId: user.id, catererId } } })
    return { voted: false }
  }
  await db.catererVote.create({ data: { userId: user.id, catererId } })
  return { voted: true }
})
