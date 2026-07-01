import { requireAdmin } from '../../utils/auth'
import { getSetting } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return {
    dmReminders: (await getSetting('dmReminders', 'false')) === 'true'
  }
})
