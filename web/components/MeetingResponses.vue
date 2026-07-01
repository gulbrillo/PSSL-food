<script setup lang="ts">
const props = defineProps<{ meetingId: string }>()
const emit = defineEmits<{ changed: [] }>()

const { data: summary, refresh } = useFetch(`/api/meetings/${props.meetingId}/summary`)
const { data: restrictions } = useFetch('/api/restrictions')

const guest = reactive({ name: '', restrictions: [] as string[] })
const addingGuest = ref(false)

function toggleGuestRestriction(name: string) {
  const i = guest.restrictions.indexOf(name)
  i >= 0 ? guest.restrictions.splice(i, 1) : guest.restrictions.push(name)
}

async function addGuest() {
  if (!guest.name.trim()) return
  await $fetch(`/api/meetings/${props.meetingId}/guests`, {
    method: 'POST',
    body: { name: guest.name, restrictions: guest.restrictions }
  })
  guest.name = ''
  guest.restrictions = []
  addingGuest.value = false
  await refresh()
  emit('changed')
}

async function removeGuest(id: string) {
  await $fetch(`/api/meetings/${props.meetingId}/guests/${id}`, { method: 'DELETE' })
  await refresh()
  emit('changed')
}

const hasLate = computed(
  () =>
    summary.value &&
    (summary.value.attending.some((a: any) => a.late) ||
      summary.value.notAttending.some((a: any) => a.late) ||
      summary.value.requests.some((q: any) => q.late))
)
</script>

<template>
  <div v-if="summary">
    <div class="row top">
      <div class="grow">
        <h3>✅ Attending ({{ summary.totalAttending }})</h3>
        <table class="plain">
          <tr v-for="a in summary.attending" :key="a.name">
            <td>
              {{ a.name }}<span v-if="a.late" class="late-star" title="changed after the RSVP deadline">*</span>
            </td>
            <td>
              <span v-for="r in a.restrictions" :key="r" class="pill warn" style="margin: 0 4px 2px 0">{{ r }}</span>
            </td>
            <td></td>
          </tr>
          <tr v-for="g in summary.guests" :key="g.id">
            <td>{{ g.name }} <span class="pill">guest</span></td>
            <td>
              <span v-for="r in g.restrictions" :key="r" class="pill warn" style="margin: 0 4px 2px 0">{{ r }}</span>
              <span v-if="g.addedByName" class="muted small">added by {{ g.addedByName }}</span>
            </td>
            <td><button class="btn sm ghost danger" title="Remove guest" @click="removeGuest(g.id)">✕</button></td>
          </tr>
        </table>

        <div class="mt">
          <button v-if="!addingGuest" class="btn sm" @click="addingGuest = true">＋ Add a guest</button>
          <div v-else>
            <div class="row">
              <input v-model="guest.name" type="text" placeholder="Guest name" maxlength="80" class="grow" @keyup.enter="addGuest" />
            </div>
            <div class="row mt">
              <span
                v-for="r in restrictions"
                :key="r.id"
                class="chip mini"
                :class="{ active: guest.restrictions.includes(r.name) }"
                @click="toggleGuestRestriction(r.name)"
              >
                {{ r.name }}
              </span>
            </div>
            <div class="row mt">
              <button class="btn sm primary" :disabled="!guest.name.trim()" @click="addGuest">Add guest</button>
              <button class="btn sm ghost" @click="addingGuest = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <div class="grow">
        <h3>🍽️ Order summary</h3>
        <p v-if="!Object.keys(summary.restrictionCounts).length" class="muted small">
          No dietary restrictions among attendees.
        </p>
        <table v-else class="plain">
          <tr v-for="(n, name) in summary.restrictionCounts" :key="name">
            <td>{{ name }}</td>
            <td><strong>{{ n }}</strong></td>
          </tr>
        </table>

        <template v-if="summary.requests.length">
          <h3 class="mt">📝 Special requests</h3>
          <table class="plain">
            <tr v-for="q in summary.requests" :key="q.name">
              <td>
                {{ q.name }}<span v-if="q.late" class="late-star" title="added after the RSVP deadline">*</span>
              </td>
              <td>“{{ q.text }}”</td>
            </tr>
          </table>
        </template>

        <a class="btn sm mt" :href="`/api/meetings/${meetingId}/sheet`" target="_blank">
          🖨️ Sign-in sheet (PDF)
        </a>
      </div>
    </div>

    <p class="muted small mt">
      ❌ Not attending:
      <template v-if="summary.notAttending.length">
        <template v-for="(a, i) in summary.notAttending" :key="a.name"
          >{{ i ? ', ' : '' }}{{ a.name }}<span v-if="a.late" class="late-star" title="changed after the RSVP deadline">*</span></template
        >
      </template>
      <template v-else>—</template>
      <br />
      😶 No response yet: {{ summary.noResponse.join(', ') || '—' }}
    </p>
    <p v-if="hasLate" class="muted small"><span class="late-star">*</span> changed after the RSVP deadline</p>
  </div>
</template>
