<script setup lang="ts">
const { user } = useUserSession()
if (!(user.value as any)?.isAdmin) await navigateTo('/')

const { data: meetings, refresh: refreshMeetings } = await useFetch('/api/meetings', {
  query: { scope: 'all' }
})
const { data: caterers, refresh: refreshCaterers } = await useFetch('/api/caterers', {
  query: { all: 1 }
})

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
  title: 'Lab Meeting'
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
  if (!confirm(`Delete the meeting on ${fmtDate(m.date)}? RSVPs for it will be lost.`)) return
  await $fetch(`/api/meetings/${m.id}`, { method: 'DELETE' })
  await refreshMeetings()
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
async function toggleCatererActive(c: any) {
  await $fetch(`/api/caterers/${c.id}`, { method: 'PATCH', body: { active: !c.active } })
  await refreshCaterers()
}
</script>

<template>
  <div>
    <h2 style="margin: 4px 0 12px">Admin</h2>

    <div class="card">
      <h3>📅 Schedule weekly meetings</h3>
      <div class="row">
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
        {{ series.deadlineTime }}. You can adjust or cancel individual meetings below.
      </p>
      <button class="btn primary mt" :disabled="creating || !seriesPreview.length" @click="createSeries">
        Create {{ seriesPreview.length }} meetings
      </button>
    </div>

    <h3 style="margin: 20px 0 8px">Upcoming meetings</h3>
    <p v-if="!upcoming.length" class="card muted">Nothing scheduled.</p>

    <div v-for="m in upcoming" :key="m.id" class="card" :class="{ cancelled: m.status === 'cancelled' }">
      <div class="row">
        <strong class="grow">{{ fmtDateTime(m.date) }}</strong>
        <span v-if="m.status === 'cancelled'" class="badge-cancelled">Cancelled</span>
        <span class="pill">{{ m.attendingCount + m.guestCount }} attending</span>
      </div>

      <div class="row mt">
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
          class="btn sm danger"
          @click="patchMeeting(m.id, { status: 'cancelled' })"
        >
          Cancel meeting
        </button>
        <button v-else class="btn sm" @click="patchMeeting(m.id, { status: 'scheduled' })">
          Restore meeting
        </button>
        <button class="btn sm danger" @click="removeMeeting(m)">Delete</button>
      </div>

      <div v-if="expanded === m.id" class="mt">
        <hr class="divider" />
        <MeetingResponses :meeting-id="m.id" @changed="refreshMeetings" />
      </div>
    </div>

    <h3 style="margin: 20px 0 8px">Caterers</h3>
    <div class="card">
      <div class="row">
        <input v-model="newCaterer.name" type="text" placeholder="Name *" />
        <input v-model="newCaterer.cuisine" type="text" placeholder="Cuisine (e.g. Pizza)" />
        <input v-model="newCaterer.url" type="url" placeholder="Menu URL" class="grow" />
        <button class="btn primary sm" :disabled="!newCaterer.name.trim()" @click="addCaterer">Add</button>
      </div>
      <table class="plain mt">
        <tr v-for="c in caterers" :key="c.id">
          <td><strong>{{ c.name }}</strong> <span class="muted small">{{ c.cuisine }}</span></td>
          <td>❤️ {{ c.voteCount }}</td>
          <td><span class="pill" :class="c.active ? 'ok' : 'bad'">{{ c.active ? 'active' : 'inactive' }}</span></td>
          <td><button class="btn sm" @click="toggleCatererActive(c)">{{ c.active ? 'Deactivate' : 'Activate' }}</button></td>
        </tr>
      </table>
    </div>
  </div>
</template>
