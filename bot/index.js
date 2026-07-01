import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js'

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_CHANNEL_ID,
  WEB_API_URL = 'http://web:3000',
  PUBLIC_APP_URL = '',
  BOT_API_TOKEN,
  CHANNEL_REMINDER_HOURS = '48',
  DM_REMINDER_HOURS = '24'
} = process.env

const CHECK_INTERVAL_MS = 5 * 60 * 1000

async function api(path, options = {}) {
  const res = await fetch(`${WEB_API_URL}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${BOT_API_TOKEN}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`API ${path} -> ${res.status} ${body}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

const ts = (iso, style = 'F') => `<t:${Math.floor(new Date(iso).getTime() / 1000)}:${style}>`

/** Yes/No RSVP buttons attached to reminder messages. */
const rsvpRow = (meetingId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rsvp|yes|${meetingId}`).setLabel("I'm in ✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rsvp|no|${meetingId}`).setLabel("Can't make it ❌").setStyle(ButtonStyle.Danger)
  )

/** Red error embed: the click did NOT register — impossible to miss. */
const notLinkedPayload = () => ({
  embeds: [
    new EmbedBuilder()
      .setColor(0xcf2f3e)
      .setTitle('🚨 Your RSVP was NOT recorded')
      .setDescription(
        `Your Discord account isn't linked to LunchPad yet, so I don't know who you are.\n\n` +
          `**Fix it in 10 seconds:**\n` +
          `1. Open ${PUBLIC_APP_URL}/profile\n` +
          `2. Click **Connect Discord**\n` +
          `3. Come back and tap the RSVP button again`
      )
  ],
  ephemeral: true
})

function rsvpReply(result, attending) {
  const when = ts(result.meeting.date)
  let msg = attending
    ? `✅ You're in for **${result.meeting.title}** on ${when}!`
    : `❌ Noted — you won't be at **${result.meeting.title}** on ${when}.`
  if (result.late) {
    msg += `\n⏰ Heads-up: the RSVP deadline had already passed, so the food may already be ordered — we'll do our best to accommodate you.`
  }
  return msg
}

/** Reply payload for a failed RSVP — not-linked gets the loud red embed. */
function rsvpErrorPayload(e) {
  if (e.status === 404 && e.message.includes('not_linked')) return notLinkedPayload()
  let content = '⚠️ Your RSVP was **not** recorded — something went wrong, please try again later.'
  if (e.message.includes('no_open_meeting')) content = 'There is no upcoming meeting to RSVP for right now.'
  else if (e.message.includes('meeting_cancelled')) content = 'That meeting has been cancelled — no food to RSVP for.'
  else if (e.message.includes('meeting_over')) content = 'That meeting has already happened.'
  return { content, ephemeral: true }
}

/* ------------------------------------------------------------- reminders */

async function checkReminders(client) {
  let data
  try {
    data = await api('/api/internal/upcoming')
  } catch (e) {
    const cause = e.cause?.code || e.cause?.message || ''
    console.error('Could not fetch upcoming meetings:', e.message, cause)
    return
  }

  // live values from Admin → Settings, env vars are only the fallback
  const channelHours = Number(data.channelReminderHours ?? CHANNEL_REMINDER_HOURS)
  const dmHours = Number(data.dmReminderHours ?? DM_REMINDER_HOURS)

  const now = Date.now()
  for (const m of data.meetings) {
    const hoursToDeadline = (new Date(m.rsvpDeadline).getTime() - now) / 3600_000
    const deadlineFuture = hoursToDeadline > 0

    // 1) channel reminder — also fires immediately for meetings created inside
    //    the reminder window (even if their RSVP deadline has already passed)
    if (hoursToDeadline <= channelHours && !m.remindersSent.includes('channel')) {
      try {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID)
        const embed = new EmbedBuilder()
          .setColor(0xfa4616)
          .setTitle(`🍕 RSVP for ${m.title}`)
          .setDescription(
            [
              `**When:** ${ts(m.date)}`,
              deadlineFuture
                ? `**RSVP by:** ${ts(m.rsvpDeadline)} (${ts(m.rsvpDeadline, 'R')})`
                : `**RSVP deadline has passed** — late responses are still welcome!`,
              m.catererName ? `**Caterer:** ${m.catererName}` : '**Caterer:** TBA',
              m.menuNotes ? `**Menu:** ${m.menuNotes}` : null,
              '',
              `**${m.responded} / ${data.totalMembers}** responded so far — use \`/rsvp\` here or ${PUBLIC_APP_URL}`
            ]
              .filter(Boolean)
              .join('\n')
          )
        await channel.send({ embeds: [embed], components: [rsvpRow(m.id)] })
        await api('/api/internal/reminder-log', {
          method: 'POST',
          body: JSON.stringify({ meetingId: m.id, kind: 'channel' })
        })
        console.log(`Channel reminder sent for meeting ${m.id}`)
      } catch (e) {
        console.error('Channel reminder failed:', e.message)
      }
    }

    // 2) DM the linked members who still haven't responded
    //    (only if the admins enabled DM reminders in the web app — off by default;
    //    never after the deadline, nagging late is just annoying)
    if (data.dmReminders && deadlineFuture && hoursToDeadline <= dmHours && !m.remindersSent.includes('dm')) {
      for (const discordId of m.nonResponderDiscordIds) {
        try {
          const dmUser = await client.users.fetch(discordId)
          await dmUser.send({
            content:
              `👋 Friendly reminder: you haven't RSVP'd for **${m.title}** on ${ts(m.date)}.\n` +
              `RSVP closes ${ts(m.rsvpDeadline, 'R')} — tap a button below, or visit ${PUBLIC_APP_URL}`,
            components: [rsvpRow(m.id)]
          })
        } catch (e) {
          // user may have DMs disabled — reminder is best-effort
          console.error(`DM to ${discordId} failed:`, e.message)
        }
      }
      try {
        await api('/api/internal/reminder-log', {
          method: 'POST',
          body: JSON.stringify({ meetingId: m.id, kind: 'dm' })
        })
        console.log(`DM reminders sent for meeting ${m.id}`)
      } catch (e) {
        console.error('Logging DM reminder failed:', e.message)
      }
    }
  }
}

/* --------------------------------------------------------- slash commands */

const commands = [
  new SlashCommandBuilder()
    .setName('rsvp')
    .setDescription("RSVP for the next lab meeting's food")
    .addStringOption((o) =>
      o
        .setName('attending')
        .setDescription('Will you be there?')
        .setRequired(true)
        .addChoices({ name: "Yes, I'm in 🍕", value: 'yes' }, { name: "No, can't make it", value: 'no' })
    )
    .addStringOption((o) =>
      o.setName('request').setDescription('Special food request (e.g. "margarita pizza please")').setMaxLength(300)
    ),
  new SlashCommandBuilder().setName('meeting').setDescription('Show the next lab meeting and RSVP status')
].map((c) => c.toJSON())

async function handleInteraction(interaction) {
  // Yes/No buttons under reminder messages (customId: "rsvp|yes|<meetingId>")
  if (interaction.isButton() && interaction.customId.startsWith('rsvp|')) {
    const [, choice, meetingId] = interaction.customId.split('|')
    const attending = choice === 'yes'
    try {
      const result = await api('/api/internal/rsvp', {
        method: 'POST',
        body: JSON.stringify({ discordId: interaction.user.id, meetingId, attending })
      })
      await interaction.reply({ content: rsvpReply(result, attending), ephemeral: true })
    } catch (e) {
      await interaction.reply(rsvpErrorPayload(e))
    }
    return
  }

  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === 'rsvp') {
    const attending = interaction.options.getString('attending') === 'yes'
    const request = interaction.options.getString('request') || undefined
    try {
      const result = await api('/api/internal/rsvp', {
        method: 'POST',
        body: JSON.stringify({ discordId: interaction.user.id, attending, request })
      })
      let msg = rsvpReply(result, attending)
      if (result.requestSaved) msg += `\n📝 Request saved for ${result.meeting.catererName}.`
      else if (request && !result.requestSaved)
        msg += `\n(No caterer is set for that meeting yet, so your request wasn't saved.)`
      await interaction.reply({ content: msg, ephemeral: true })
    } catch (e) {
      await interaction.reply(rsvpErrorPayload(e))
    }
  }

  if (interaction.commandName === 'meeting') {
    try {
      const data = await api('/api/internal/upcoming')
      const m = data.meetings[0]
      if (!m) {
        await interaction.reply({ content: 'No upcoming meetings scheduled.', ephemeral: true })
        return
      }
      await interaction.reply({
        content:
          `**${m.title}** — ${ts(m.date)}\n` +
          `RSVP by ${ts(m.rsvpDeadline)} (${ts(m.rsvpDeadline, 'R')})\n` +
          `Caterer: ${m.catererName || 'TBA'}${m.menuNotes ? ` — ${m.menuNotes}` : ''}\n` +
          `${m.attending} attending, ${m.responded}/${data.totalMembers} responded · ${PUBLIC_APP_URL}`,
        ephemeral: true
      })
    } catch (e) {
      await interaction.reply({ content: 'Could not reach the food site, try again later.', ephemeral: true })
    }
  }
}

/* ------------------------------------------------------------------ boot */

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`)
  try {
    const rest = new REST().setToken(DISCORD_BOT_TOKEN)
    await rest.put(Routes.applicationGuildCommands(client.application.id, DISCORD_GUILD_ID), {
      body: commands
    })
    console.log('Slash commands registered')
  } catch (e) {
    console.error('Registering slash commands failed:', e.message)
  }

  checkReminders(client)
  setInterval(() => checkReminders(client), CHECK_INTERVAL_MS)
})

client.on('interactionCreate', handleInteraction)

client.login(DISCORD_BOT_TOKEN)
