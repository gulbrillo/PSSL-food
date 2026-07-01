import { requireAdmin } from '../../utils/auth'
import { getSetting } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return {
    dmReminders: (await getSetting('dmReminders', 'false')) === 'true',
    channelReminderHours: parseInt(await getSetting('channelReminderHours', '48'), 10) || 48,
    dmReminderHours: parseInt(await getSetting('dmReminderHours', '24'), 10) || 24
  }
})
