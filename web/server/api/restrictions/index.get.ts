import { db } from '../../utils/db'
import { requireDbUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireDbUser(event)
  return db.restriction.findMany({ orderBy: { name: 'asc' } })
})
