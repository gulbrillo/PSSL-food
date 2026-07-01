<script setup lang="ts">
const { user } = useUserSession()
if (!(user.value as any)?.isAdmin) await navigateTo('/')

const tab = ref<'meetings' | 'schedule' | 'caterers' | 'members' | 'restrictions' | 'settings'>('meetings')
const dialog = useDialog()

const { data: meetings, refresh: refreshMeetings } = await useFetch('/api/meetings', {
  query: { scope: 'all' }
})
const { data: caterers, refresh: refreshCaterers } = await useFetch('/api/caterers', {
  query: { all: 1 }
})
const { data: members } = useFetch('/api/admin/members')
const { data: restrictions, refresh: refreshRestrictions } = useFetch('/api/restrictions')
const { data: settings, refresh: refreshSettings } = useFetch('/api/admin/settings')

async function saveSettings(patch: Record<string, boolean>) {
  await $fetch('/api/admin/settings', { method: 'PUT', body: patch })
  await refreshSettings()
}

/* ---------- schedule a series (default: Thursdays 1pm, RSVP by Tuesday 5pm) ---------- */

function nextThursdayStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const series = reactive({
  firstDate: nextThursdayStr(),
  time: '13:00',
  weeks: 4,
  deadlineDaysBefore: 2,
  deadlineTime: '17:00',
  title: 'PSSL Group Meeting'
})

const seriesPreview = computed(() => {
  const out: { date: Date; deadline: Date }[] = []
  if (!series.firstDate || !series.time) return out
  for (let i = 0; i < Math.min(Math.max(series.weeks, 1), 26); i++) {
    const date = new Date(`${series.firstDate}T${series.time}`)
    date.setDate(date.getDate() + 7 * i)
    const deadline = new Date(date)
    deadline.setDate(deadline.getDate() - series.deadlineDaysBefore)
    const [h, min] = series.deadlineTime.split(':').map(Number)
    deadline.setHours(h || 17, min || 0, 0, 0)
    out.push({ date, deadline })
  }
  return out
})

const creating = ref(false)
async function createSeries() {
  creating.value = true
  try {
    await $fetch('/api/meetings', {
      method: 'POST',
      body: {
        meetings: seriesPreview.value.map((m) => ({
          date: m.date.toISOString(),
          rsvpDeadline: m.deadline.toISOString(),
          title: series.title
        }))
      }
    })
    await refreshMeetings()
    tab.value = 'meetings'
  } finally {
    creating.value = false
  }
}

/* ---------- manage existing meetings ---------- */

const upcoming = computed(() =>
  (meetings.value || []).filter((m: any) => new Date(m.date) > new Date(Date.now() - 24 * 3600_000))
)

const expanded = ref('')

function toggleDetails(m: any) {
  expanded.value = expanded.value === m.id ? '' : m.id
}

async function patchMeeting(id: string, data: any) {
  await $fetch(`/api/meetings/${id}`, { method: 'PATCH', body: data })
  await refreshMeetings()
}

async function removeMeeting(m: any) {
  const ok = await dialog.confirm(
    `Permanently delete "${m.title}" on ${fmtDate(m.date)}? All RSVPs and requests for it will be lost — this cannot be undone.\n\nIf the meeting just isn't happening, "Cancel meeting" is the gentler option: it keeps the record and can be restored later.`,
    { title: 'Delete this meeting?', confirmText: 'Delete permanently', cancelText: 'Keep it' }
  )
  if (!ok) return
  await $fetch(`/api/meetings/${m.id}`, { method: 'DELETE' })
  await refreshMeetings()
}

const sendingReminder = ref('')
async function sendReminder(m: any) {
  sendingReminder.value = m.id
  try {
    await $fetch(`/api/meetings/${m.id}/remind`, { method: 'POST' })
    dialog.notify(
      `An RSVP reminder for "${m.title}" was just posted in the Discord channel.`,
      'Reminder sent 📣'
    )
  } catch (e: any) {
    dialog.notify(e.data?.statusMessage || 'Could not post to Discord — please try again.', 'Something went wrong')
  } finally {
    sendingReminder.value = ''
  }
}

function onReschedule(m: any, ev: Event) {
  const v = (ev.target as HTMLInputElement).value
  if (v) patchMeeting(m.id, { date: new Date(v).toISOString() })
}
function onDeadline(m: any, ev: Event) {
  const v = (ev.target as HTMLInputElement).value
  if (v) patchMeeting(m.id, { rsvpDeadline: new Date(v).toISOString() })
}

/* ---------- caterer management ---------- */

const newCaterer = reactive({ name: '', cuisine: '', url: '', notes: '' })
async function addCaterer() {
  if (!newCaterer.name.trim()) return
  await $fetch('/api/caterers', { method: 'POST', body: { ...newCaterer } })
  Object.assign(newCaterer, { name: '', cuisine: '', url: '', notes: '' })
  await refreshCaterers()
}
async function patchCaterer(id: string, data: Record<string, any>) {
  try {
    await $fetch(`/api/caterers/${id}`, { method: 'PATCH', body: data })
  } catch (e: any) {
    dialog.notify(e.data?.statusMessage || 'Could not save — please try again.', 'Something went wrong')
  }
  await refreshCaterers()
}

/* ---------- dietary restriction editor ---------- */

const newRestriction = reactive({ name: '', description: '' })
const restrictionSaved = ref('')

async function addRestriction() {
  if (!newRestriction.name.trim()) return
  await $fetch('/api/restrictions', { method: 'POST', body: { ...newRestriction } })
  Object.assign(newRestriction, { name: '', description: '' })
  await refreshRestrictions()
}

async function saveRestriction(r: any) {
  try {
    await $fetch(`/api/restrictions/${r.id}`, {
      method: 'PATCH',
      body: { name: r.name, description: r.description || '' }
    })
    restrictionSaved.value = r.id
    setTimeout(() => (restrictionSaved.value = ''), 2000)
  } catch (e: any) {
    dialog.notify(e.data?.statusMessage || 'Could not save — please try again.', 'Something went wrong')
    await refreshRestrictions()
  }
}
</script>

<template>
  <div>
    <h2 class="page-title">Admin</h2>

    <div class="tabs">
      <button class="tab-btn" :class="{ active: tab === 'meetings' }" @click="tab = 'meetings'">
        📅 Upcoming meetings
      </button>
      <button class="tab-btn" :class="{ active: tab === 'schedule' }" @click="tab = 'schedule'">
        ➕ Schedule meetings
      </button>
      <button class="tab-btn" :class="{ active: tab === 'caterers' }" @click="tab = 'caterers'">
        🍴 Caterers
      </button>
      <button class="tab-btn" :class="{ active: tab === 'members' }" @click="tab = 'members'">
        👥 Members
      </button>
      <button class="tab-btn" :class="{ active: tab === 'restrictions' }" @click="tab = 'restrictions'">
        🥗 Dietary restrictions
      </button>
      <button class="tab-btn" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">
        ⚙️ Settings
      </button>
    </div>

    <!-- ============================================= upcoming meetings -->
    <div v-if="tab === 'meetings'">
      <div v-if="upcoming.length" class="row" style="margin-bottom: 14px">
        <button class="btn primary sm" @click="tab = 'schedule'">➕ Schedule new meetings</button>
      </div>
      <p v-if="!upcoming.length" class="card muted">
        Nothing scheduled.
        <button class="btn sm primary" @click="tab = 'schedule'">➕ Schedule meetings</button>
      </p>

      <div v-for="m in upcoming" :key="m.id" class="card" :class="{ cancelled: m.status === 'cancelled' }">
        <div class="row">
          <strong class="grow">{{ m.title }} — {{ fmtDateTime(m.date) }}</strong>
          <span v-if="m.status === 'cancelled'" class="badge-cancelled">Cancelled</span>
          <span class="pill">{{ m.attendingCount + m.guestCount }} attending</span>
        </div>

        <div class="row mt">
          <label class="field grow">Meeting name
            <input
              type="text"
              maxlength="80"
              :value="m.title"
              @change="patchMeeting(m.id, { title: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <label class="field">Date &amp; time
            <input type="datetime-local" :value="toLocalInput(m.date)" @change="onReschedule(m, $event)" />
          </label>
          <label class="field">RSVP deadline
            <input type="datetime-local" :value="toLocalInput(m.rsvpDeadline)" @change="onDeadline(m, $event)" />
          </label>
          <label class="field">Caterer
            <select
              :value="m.caterer?.id || ''"
              @change="patchMeeting(m.id, { catererId: ($event.target as HTMLSelectElement).value || null })"
            >
              <option value="">— none yet —</option>
              <option v-for="c in caterers" :key="c.id" :value="c.id">
                {{ c.name }}{{ c.active ? '' : ' (inactive)' }}
              </option>
            </select>
          </label>
          <label class="field grow">Menu notes (shown to everyone)
            <input
              type="text"
              :value="m.menuNotes || ''"
              placeholder="e.g. ordering 6 large pizzas"
              @change="patchMeeting(m.id, { menuNotes: ($event.target as HTMLInputElement).value })"
            />
          </label>
        </div>

        <div class="row mt">
          <button class="btn sm" @click="toggleDetails(m)">
            {{ expanded === m.id ? 'Hide responses' : 'View responses' }}
          </button>
          <button
            v-if="m.status === 'scheduled'"
            class="btn sm"
            :disabled="sendingReminder === m.id"
            title="Posts an RSVP reminder for this meeting to the lab's Discord channel right now — independent of the automatic reminders."
            @click="sendReminder(m)"
          >
            📣 {{ sendingReminder === m.id ? 'Sending…' : 'Discord reminder' }}
          </button>
          <button
            v-if="m.status === 'scheduled'"
            class="btn sm danger"
            title="Marks the meeting as cancelled: it stays in the list (greyed out) so everyone sees it's off, RSVPs are kept, and it can be restored any time."
            @click="patchMeeting(m.id, { status: 'cancelled' })"
          >
            Cancel meeting
          </button>
          <button
            v-else
            class="btn sm"
            title="Puts the meeting back on the schedule — RSVPs are still there."
            @click="patchMeeting(m.id, { status: 'scheduled' })"
          >
            Restore meeting
          </button>
          <button
            class="btn sm danger"
            title="Permanently removes the meeting and all its RSVPs, as if it never existed. Cannot be undone — for meetings created by mistake."
            @click="removeMeeting(m)"
          >
            Delete
          </button>
        </div>

        <div v-if="expanded === m.id" class="mt">
          <hr class="divider" />
          <MeetingResponses :meeting-id="m.id" @changed="refreshMeetings" />
        </div>
      </div>
    </div>

    <!-- ============================================= schedule new -->
    <div v-else-if="tab === 'schedule'" class="card">
      <h3>📅 Schedule weekly meetings</h3>
      <div class="row">
        <label class="field grow">Meeting name
          <input v-model="series.title" type="text" maxlength="80" placeholder="PSSL Group Meeting" />
        </label>
      </div>
      <div class="row mt">
        <label class="field">First meeting
          <input v-model="series.firstDate" type="date" />
        </label>
        <label class="field">Time
          <input v-model="series.time" type="time" />
        </label>
        <label class="field">Weeks
          <input v-model.number="series.weeks" type="number" min="1" max="26" style="width: 70px" />
        </label>
        <label class="field">RSVP deadline
          <select v-model.number="series.deadlineDaysBefore">
            <option :value="1">1 day before</option>
            <option :value="2">2 days before</option>
            <option :value="3">3 days before</option>
          </select>
        </label>
        <label class="field">at
          <input v-model="series.deadlineTime" type="time" />
        </label>
      </div>
      <p class="muted small mt" v-if="seriesPreview.length">
        Will create {{ seriesPreview.length }} meetings:
        {{ seriesPreview.map((m) => fmtDate(m.date)).join(' · ') }}
        <br />RSVP deadlines: {{ series.deadlineDaysBefore }} day(s) before at
        {{ series.deadlineTime }}. You can adjust or cancel individual meetings afterwards.
      </p>
      <button class="btn primary mt" :disabled="creating || !seriesPreview.length" @click="createSeries">
        Create {{ seriesPreview.length }} meetings
      </button>
    </div>

    <!-- ============================================= caterers -->
    <div v-else-if="tab === 'caterers'" class="card">
      <h3>🍴 Add &amp; edit caterers</h3>
      <div class="row">
        <input v-model="newCaterer.name" type="text" placeholder="Name *" />
        <input v-model="newCaterer.cuisine" type="text" placeholder="Cuisine (e.g. Pizza)" />
        <input v-model="newCaterer.url" type="url" placeholder="Menu URL" class="grow" />
        <button class="btn primary sm" :disabled="!newCaterer.name.trim()" @click="addCaterer">Add</button>
      </div>
      <div v-for="c in caterers" :key="c.id">
        <hr class="divider" />
        <div class="row">
          <label class="field">Name
            <input
              type="text"
              maxlength="80"
              :value="c.name"
              @change="patchCaterer(c.id, { name: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <label class="field">Cuisine
            <input
              type="text"
              maxlength="60"
              :value="c.cuisine || ''"
              @change="patchCaterer(c.id, { cuisine: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <label class="field grow">Menu URL
            <input
              type="url"
              :value="c.url || ''"
              @change="patchCaterer(c.id, { url: ($event.target as HTMLInputElement).value })"
            />
          </label>
        </div>
        <div class="row mt">
          <label class="field grow">Notes
            <input
              type="text"
              maxlength="200"
              :value="c.notes || ''"
              @change="patchCaterer(c.id, { notes: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <span class="pill">❤️ {{ c.voteCount }}</span>
          <span class="pill" :class="c.active ? 'ok' : 'bad'">{{ c.active ? 'active' : 'inactive' }}</span>
          <button class="btn sm" @click="patchCaterer(c.id, { active: !c.active })">
            {{ c.active ? 'Deactivate' : 'Activate' }}
          </button>
        </div>
      </div>
      <p class="muted small mt">
        Changes save automatically when you leave a field. Deactivated caterers disappear from
        the voting page but stay assignable to meetings.
      </p>
    </div>

    <!-- ============================================= members -->
    <div v-else-if="tab === 'members'" class="card">
      <h3>👥 Members &amp; their dietary restrictions</h3>
      <p class="muted small">Everyone who has signed in at least once. Restrictions are self-selected on their profiles.</p>
      <div class="table-scroll">
        <table class="plain">
          <tr>
            <th>Name</th><th>Email</th><th>Discord</th><th>Restrictions</th>
          </tr>
          <tr v-for="u in members || []" :key="u.id">
            <td>
              {{ u.name }}
              <span v-if="u.isAdmin" class="pill" style="margin-left: 4px">admin</span>
            </td>
            <td class="muted">{{ u.email }}</td>
            <td>
              <span v-if="u.discordLinked" class="pill ok" :title="u.discordUsername || ''">linked</span>
              <span v-else class="muted small">—</span>
            </td>
            <td>
              <span v-for="r in u.restrictions" :key="r" class="pill warn" style="margin: 0 4px 2px 0">{{ r }}</span>
              <span v-if="!u.restrictions.length" class="muted small">none set</span>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ============================================= settings -->
    <div v-else-if="tab === 'settings'" class="card">
      <h3>⚙️ Settings</h3>
      <h3 class="mt" style="font-size: 14px">Discord bot</h3>
      <label style="display: flex; gap: 10px; align-items: flex-start; cursor: pointer">
        <input
          type="checkbox"
          style="margin-top: 4px"
          :checked="settings?.dmReminders"
          @change="saveSettings({ dmReminders: ($event.target as HTMLInputElement).checked })"
        />
        <span>
          Send personal <strong>DM reminders</strong> to members who haven't RSVP'd
          <span class="muted small">
            (sent shortly before the deadline — default 24 h — to members with linked Discord
            accounts; the channel reminder is always posted regardless of this setting)
          </span>
        </span>
      </label>
      <p class="muted small mt">Changes take effect on the bot's next check (within ~10 minutes).</p>
    </div>

    <!-- ============================================= dietary restrictions -->
    <div v-else>
      <div class="card">
        <h3>🥗 Dietary restriction reference</h3>
        <p class="muted small">
          What each restriction means — what's off the menu and the common traps to watch for when
          ordering. Members see the description as a tooltip when picking their restrictions.
          Names and descriptions are editable (including member-added custom ones).
        </p>
      </div>

      <div v-for="r in restrictions || []" :key="r.id" class="card">
        <div class="row top">
          <label class="field" style="min-width: 180px">Name
            <input v-model="r.name" type="text" maxlength="60" />
          </label>
          <label class="field grow">Not allowed &amp; common traps
            <textarea
              v-model="r.description"
              rows="2"
              maxlength="500"
              placeholder="What food is excluded? Which ingredients sneak in unexpectedly?"
            />
          </label>
        </div>
        <div class="row mt">
          <button class="btn sm" @click="saveRestriction(r)">Save</button>
          <span v-if="restrictionSaved === r.id" class="ok-text">Saved ✓</span>
        </div>
      </div>

      <div class="card">
        <h3>Add a restriction</h3>
        <div class="row top">
          <label class="field" style="min-width: 180px">Name
            <input v-model="newRestriction.name" type="text" maxlength="60" placeholder="e.g. Low-sodium" />
          </label>
          <label class="field grow">Not allowed &amp; common traps
            <textarea v-model="newRestriction.description" rows="2" maxlength="500" />
          </label>
        </div>
        <button class="btn primary sm mt" :disabled="!newRestriction.name.trim()" @click="addRestriction">Add</button>
      </div>
    </div>
  </div>
</template>
