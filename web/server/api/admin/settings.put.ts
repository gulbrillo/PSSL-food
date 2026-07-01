import { requireAdmin } from '../../utils/auth'
import { setSetting } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ dmReminders?: boolean }>(event)
  if (typeof body.dmReminders === 'boolean') {
    await setSetting('dmReminders', body.dmReminders ? 'true' : 'false')
  }
  return { ok: true }
})
