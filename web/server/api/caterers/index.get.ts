import { db } from '../../utils/db'
import { requireDbUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const { all } = getQuery(event)

  const caterers = await db.caterer.findMany({
    where: all ? {} : { active: true },
    include: { votes: true, prefs: { where: { userId: user.id } } },
    orderBy: { name: 'asc' }
  })

  return caterers
    .map((c) => ({
      id: c.id,
      name: c.name,
      cuisine: c.cuisine,
      url: c.url,
      notes: c.notes,
      active: c.active,
      voteCount: c.votes.length,
      myVote: c.votes.some((v) => v.userId === user.id),
      myUsual: c.prefs[0]?.text ?? ''
    }))
    .sort((a, b) => b.voteCount - a.voteCount || a.name.localeCompare(b.name))
})
