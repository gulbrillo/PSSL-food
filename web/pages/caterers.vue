<script setup lang="ts">
const { data: caterers, refresh } = await useFetch('/api/caterers')
const { data: me } = await useFetch('/api/me')

const usualDrafts = reactive<Record<string, string>>({})
const savedNote = ref('')

watchEffect(() => {
  for (const c of caterers.value || []) {
    if (!(c.id in usualDrafts)) usualDrafts[c.id] = c.myUsual || ''
  }
})

async function vote(c: any) {
  await $fetch(`/api/caterers/${c.id}/vote`, { method: 'POST' })
  await refresh()
}

async function saveUsual(c: any) {
  await $fetch(`/api/caterers/${c.id}/preference`, {
    method: 'PUT',
    body: { text: usualDrafts[c.id] }
  })
  savedNote.value = c.id
  setTimeout(() => (savedNote.value = ''), 2000)
  await refresh()
}
</script>

<template>
  <div>
    <h2 style="margin: 4px 0 4px">Caterers</h2>
    <p class="muted">
      Vote ❤️ for your favorites — it helps whoever orders pick places people actually like. You can
      also save a "usual" request per caterer; it prefills your special request whenever that
      caterer is booked.
    </p>

    <p v-if="!caterers?.length" class="card muted">
      No caterers yet<template v-if="me?.isAdmin"> — add some on the <NuxtLink to="/admin">admin page</NuxtLink></template>.
    </p>

    <div v-for="c in caterers" :key="c.id" class="card">
      <div class="row">
        <div class="grow">
          <h3 style="margin: 0">
            {{ c.name }}
            <span v-if="c.cuisine" class="muted small" style="font-weight: 400">· {{ c.cuisine }}</span>
          </h3>
          <a v-if="c.url" :href="c.url" target="_blank" rel="noopener" class="small">menu / website ↗</a>
          <p v-if="c.notes" class="muted small" style="margin: 4px 0 0">{{ c.notes }}</p>
        </div>
        <button class="btn" :class="{ 'yes on': c.myVote }" @click="vote(c)">
          {{ c.myVote ? '❤️' : '🤍' }} {{ c.voteCount }}
        </button>
      </div>
      <div class="row mt">
        <input
          v-model="usualDrafts[c.id]"
          type="text"
          class="grow"
          maxlength="300"
          :placeholder="`My usual at ${c.name} (e.g. margarita pizza)`"
        />
        <button class="btn sm" @click="saveUsual(c)">Save</button>
        <span v-if="savedNote === c.id" class="ok-text">Saved ✓</span>
      </div>
    </div>
  </div>
</template>
