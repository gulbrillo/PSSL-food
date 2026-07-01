import { requireDbUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    restrictionIds: user.restrictions.map((r) => r.restrictionId)
  }
})
