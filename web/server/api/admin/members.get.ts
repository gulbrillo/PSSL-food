import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const users = await db.user.findMany({
    orderBy: { name: 'asc' },
    include: { restrictions: { include: { restriction: true } } }
  })
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    discordLinked: !!u.discordId,
    discordUsername: u.discordUsername,
    restrictions: u.restrictions.map((r) => r.restriction.name)
  }))
})
