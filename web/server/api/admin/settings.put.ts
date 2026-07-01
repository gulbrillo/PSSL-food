import { requireAdmin } from '../../utils/auth'
import { setSetting } from '../../utils/settings'

const clampHours = (n: number) => Math.min(336, Math.max(1, Math.round(n)))

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{
    dmReminders?: boolean
    channelReminderHours?: number
    dmReminderHours?: number
  }>(event)

  if (typeof body.dmReminders === 'boolean') {
    await setSetting('dmReminders', body.dmReminders ? 'true' : 'false')
  }
  if (typeof body.channelReminderHours === 'number' && isFinite(body.channelReminderHours)) {
    await setSetting('channelReminderHours', String(clampHours(body.channelReminderHours)))
  }
  if (typeof body.dmReminderHours === 'number' && isFinite(body.dmReminderHours)) {
    await setSetting('dmReminderHours', String(clampHours(body.dmReminderHours)))
  }
  return { ok: true }
})
