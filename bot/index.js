import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
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

const CHECK_INTERVAL_MS = 10 * 60 * 1000

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

/* ------------------------------------------------------------- reminders */

async function checkReminders(client) {
  let data
  try {
    data = await api('/api/internal/upcoming')
  } catch (e) {
    console.error('Could not fetch upcoming meetings:', e.message)
    return
  }

  const now = Date.now()
  for (const m of data.meetings) {
    const hoursToDeadline = (new Date(m.rsvpDeadline).getTime() - now) / 3600_000
    if (hoursToDeadline <= 0) continue

    // 1) channel reminder
    if (hoursToDeadline <= Number(CHANNEL_REMINDER_HOURS) && !m.remindersSent.includes('channel')) {
      try {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID)
        const embed = new EmbedBuilder()
          .setColor(0xfa4616)
          .setTitle(`🍕 RSVP for ${m.title}`)
          .setDescription(
            [
              `**When:** ${ts(m.date)}`,
              `**RSVP by:** ${ts(m.rsvpDeadline)} (${ts(m.rsvpDeadline, 'R')})`,
              m.catererName ? `**Caterer:** ${m.catererName}` : '**Caterer:** TBA',
              m.menuNotes ? `**Menu:** ${m.menuNotes}` : null,
              '',
              `**${m.responded} / ${data.totalMembers}** responded so far — use \`/rsvp\` here or ${PUBLIC_APP_URL}`
            ]
              .filter(Boolean)
              .join('\n')
          )
        await channel.send({ embeds: [embed] })
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
    //    (only if the admins enabled DM reminders in the web app — off by default)
    if (data.dmReminders && hoursToDeadline <= Number(DM_REMINDER_HOURS) && !m.remindersSent.includes('dm')) {
      for (const discordId of m.nonResponderDiscordIds) {
        try {
          const dmUser = await client.users.fetch(discordId)
          await dmUser.send(
            `👋 Friendly reminder: you haven't RSVP'd for **${m.title}** on ${ts(m.date)}.\n` +
              `RSVP closes ${ts(m.rsvpDeadline, 'R')} — reply with \`/rsvp\` in the server or visit ${PUBLIC_APP_URL}`
          )
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
  if (!interaction.isChatInputCommand()) return

  if (interaction.commandName === 'rsvp') {
    const attending = interaction.options.getString('attending') === 'yes'
    const request = interaction.options.getString('request') || undefined
    try {
      const result = await api('/api/internal/rsvp', {
        method: 'POST',
        body: JSON.stringify({ discordId: interaction.user.id, attending, request })
      })
      const when = ts(result.meeting.date)
      let msg = attending
        ? `✅ You're in for **${result.meeting.title}** on ${when}!`
        : `❌ Noted — you won't be at **${result.meeting.title}** on ${when}.`
      if (result.requestSaved) msg += `\n📝 Request saved for ${result.meeting.catererName}.`
      else if (request && !result.requestSaved)
        msg += `\n(No caterer is set for that meeting yet, so your request wasn't saved.)`
      await interaction.reply({ content: msg, ephemeral: true })
    } catch (e) {
      let msg = 'Something went wrong, please try again later.'
      if (e.status === 404 && e.message.includes('not_linked')) {
        msg = `You haven't linked your Discord account yet. Visit ${PUBLIC_APP_URL}/profile and click **Connect Discord** (takes 10 seconds).`
      } else if (e.message.includes('no_open_meeting')) {
        msg = 'There is no upcoming meeting with an open RSVP right now.'
      } else if (e.message.includes('deadline_passed')) {
        msg = 'Sorry, the RSVP deadline for the next meeting has already passed.'
      }
      await interaction.reply({ content: msg, ephemeral: true })
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
