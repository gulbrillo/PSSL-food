<script setup lang="ts">
const { data: meetings, refresh } = await useFetch('/api/meetings')
const { data: me } = await useFetch('/api/me')

const requestDrafts = reactive<Record<string, string>>({})
const saveAsUsual = reactive<Record<string, boolean>>({})
const savedNote = ref('')
const showResponses = ref('')

watchEffect(() => {
  for (const m of meetings.value || []) {
    if (!(m.id in requestDrafts)) requestDrafts[m.id] = m.suggestedRequest || ''
  }
})

const upcoming = computed(() =>
  (meetings.value || []).filter((m: any) => new Date(m.date) > new Date(Date.now() - 4 * 3600_000))
)

async function rsvp(m: any, attending: boolean) {
  if (
    m.deadlinePassed &&
    !confirm(
      'The RSVP deadline for this meeting has passed. Your change will still be saved, but it will be marked as late (*) in the attendance list. Continue?'
    )
  ) {
    return
  }
  try {
    await $fetch(`/api/meetings/${m.id}/rsvp`, { method: 'POST', body: { attending } })
    await refresh()
  } catch (e: any) {
    alert(e.data?.statusMessage || 'Could not save your RSVP')
  }
}

async function saveRequest(m: any) {
  try {
    await $fetch(`/api/meetings/${m.id}/request`, {
      method: 'PUT',
      body: { text: requestDrafts[m.id], saveAsUsual: !!saveAsUsual[m.id] }
    })
    savedNote.value = m.id
    setTimeout(() => (savedNote.value = ''), 2000)
    await refresh()
  } catch (e: any) {
    alert(e.data?.statusMessage || 'Could not save your request')
  }
}

function pills(m: any) {
  return Object.entries(m.restrictionCounts || {}).map(([name, n]) => `${n}× ${name}`)
}

function headCount(m: any) {
  return m.attendingCount + m.guestCount
}
</script>

<template>
  <div>
    <div v-if="me && me.restrictionIds.length === 0" class="card hint">
      <strong>👋 First time here?</strong>
      <span class="muted">
        Set your food preferences once in
        <NuxtLink to="/profile">your profile</NuxtLink> — after that, a single tap on "I'm in"
        counts you (and your dietary needs) for every meeting.
      </span>
    </div>

    <h2 v-if="upcoming.length" class="page-title">Upcoming lab meetings</h2>
    <p v-else class="card muted">No upcoming meetings scheduled yet. Check back soon!</p>

    <div
      v-for="(m, i) in upcoming"
      :key="m.id"
      class="card"
      :class="{ hero: i === 0 && m.status !== 'cancelled', cancelled: m.status === 'cancelled' }"
    >
      <div class="row">
        <div class="grow">
          <h2>{{ fmtDate(m.date) }} <span class="muted" style="font-weight: 400">· {{ fmtTime(m.date) }}</span></h2>
          <div class="muted">{{ m.title }}</div>
        </div>
        <span v-if="m.status === 'cancelled'" class="badge-cancelled">Cancelled</span>
        <span v-else-if="m.deadlinePassed" class="pill late">RSVP closed · late changes flagged *</span>
        <span v-else class="pill warn">RSVP {{ deadlineCountdown(m.rsvpDeadline) }}</span>
      </div>

      <div v-if="m.status !== 'cancelled'">
        <div class="row mt">
          <span v-if="m.caterer" class="pill">
            🍴 {{ m.caterer.name }}<template v-if="m.caterer.cuisine"> · {{ m.caterer.cuisine }}</template>
          </span>
          <span v-else class="muted small">Caterer to be announced</span>
          <span v-if="m.menuNotes" class="muted small">{{ m.menuNotes }}</span>
        </div>

        <div class="row mt rsvp-row">
          <button class="btn yes" :class="{ on: m.myRsvp === true }" @click="rsvp(m, true)">
            ✅ I'm in
          </button>
          <button class="btn no" :class="{ on: m.myRsvp === false }" @click="rsvp(m, false)">
            ❌ Can't make it
          </button>
        </div>
        <p v-if="m.myLate" class="late-text" style="margin: 6px 0 0">
          * your response changed after the deadline — it still counts, but it's flagged in the list
        </p>

        <div class="row mt">
          <button class="btn sm ghost" @click="showResponses = showResponses === m.id ? '' : m.id">
            👥 {{ headCount(m) }} attending{{ pills(m).length ? ' · ' + pills(m).join(', ') : '' }}
            {{ showResponses === m.id ? '▲' : '▼' }}
          </button>
        </div>

        <div v-if="showResponses === m.id" class="mt">
          <hr class="divider" />
          <MeetingResponses :meeting-id="m.id" @changed="refresh" />
        </div>

        <div v-if="m.caterer && m.myRsvp === true" class="mt">
          <label class="field">
            Special request for {{ m.caterer.name }} (optional — e.g. "please make sure there's a margarita pizza")
            <div class="row">
              <input v-model="requestDrafts[m.id]" type="text" class="grow" maxlength="300" />
              <button class="btn sm" @click="saveRequest(m)">Save</button>
            </div>
          </label>
          <label class="muted small" style="display: flex; gap: 6px; align-items: center; margin-top: 6px">
            <input v-model="saveAsUsual[m.id]" type="checkbox" />
            Remember as my usual for {{ m.caterer.name }}
          </label>
          <span v-if="savedNote === m.id" class="ok-text">Saved ✓</span>
          <span v-if="m.deadlinePassed" class="late-text"> — deadline passed, requests are marked late (*)</span>
        </div>
        <p v-else-if="m.myRequest" class="muted small mt">Your request: “{{ m.myRequest }}”</p>
      </div>
    </div>
  </div>
</template>
