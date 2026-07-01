import { db } from '../../../utils/db'
import { requireAdmin } from '../../../utils/auth'

// Admin action: post an RSVP reminder for this meeting to the Discord channel right now.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const config = useRuntimeConfig(event)
  if (!config.discordBotToken || !config.discordChannelId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The Discord bot is not configured (missing bot token / channel id in .env)'
    })
  }

  const id = getRouterParam(event, 'id')!
  const [meeting, totalMembers] = await Promise.all([
    db.meeting.findUnique({ where: { id }, include: { caterer: true, rsvps: true } }),
    db.user.count()
  ])
  if (!meeting) throw createError({ statusCode: 404, statusMessage: 'Meeting not found' })
  if (meeting.status === 'cancelled') {
    throw createError({ statusCode: 400, statusMessage: 'Meeting is cancelled' })
  }

  const ts = (d: Date, style = 'F') => `<t:${Math.floor(d.getTime() / 1000)}:${style}>`
  const responded = meeting.rsvps.length
  const deadlineFuture = meeting.rsvpDeadline > new Date()

  const description = [
    `**When:** ${ts(meeting.date)}`,
    deadlineFuture
      ? `**RSVP by:** ${ts(meeting.rsvpDeadline)} (${ts(meeting.rsvpDeadline, 'R')})`
      : `**RSVP deadline has passed** — late responses are still welcome!`,
    meeting.caterer ? `**Caterer:** ${meeting.caterer.name}` : '**Caterer:** TBA',
    meeting.menuNotes ? `**Menu:** ${meeting.menuNotes}` : null,
    '',
    `**${responded} / ${totalMembers}** responded so far — use \`/rsvp\` here or ${config.public.appUrl}`
  ]
    .filter(Boolean)
    .join('\n')

  try {
    await $fetch(`https://discord.com/api/v10/channels/${config.discordChannelId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bot ${config.discordBotToken}` },
      body: {
        embeds: [
          {
            color: 0xfa4616,
            title: `🍕 RSVP for ${meeting.title}`,
            description
          }
        ]
      }
    })
  } catch (e) {
    console.error('Manual Discord reminder failed:', e)
    throw createError({
      statusCode: 502,
      statusMessage: 'Discord rejected the message — is the bot in the server with access to the channel?'
    })
  }

  return { ok: true }
})
