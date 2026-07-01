import { db } from '../../utils/db'
import { requireDbUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  await db.user.update({
    where: { id: user.id },
    data: { discordId: null, discordUsername: null }
  })
  return { ok: true }
})
