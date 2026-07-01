import { db } from '../../../utils/db'
import { requireDbUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const catererId = getRouterParam(event, 'id')!
  const body = await readBody<{ text: string }>(event)
  const text = (body?.text || '').trim().slice(0, 300)

  if (text) {
    await db.catererPreference.upsert({
      where: { userId_catererId: { userId: user.id, catererId } },
      create: { userId: user.id, catererId, text },
      update: { text }
    })
  } else {
    await db.catererPreference.deleteMany({ where: { userId: user.id, catererId } })
  }
  return { ok: true }
})
