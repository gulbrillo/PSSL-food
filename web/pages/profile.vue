<script setup lang="ts">
const route = useRoute()
const { data: me, refresh: refreshMe } = await useFetch('/api/me')
const { data: restrictions, refresh: refreshRestrictions } = await useFetch('/api/restrictions')

const customName = ref('')
const saving = ref(false)

const notice = computed(() => {
  if (route.query.linked) return { ok: true, text: 'Discord account linked! The bot can now remind you personally.' }
  if (route.query.error === 'discord_taken')
    return { ok: false, text: 'That Discord account is already linked to someone else.' }
  if (route.query.error === 'discord') return { ok: false, text: 'Linking Discord failed. Please try again.' }
  return null
})

function isSelected(id: string) {
  return me.value?.restrictionIds.includes(id)
}

async function toggle(id: string) {
  if (!me.value) return
  const ids = new Set(me.value.restrictionIds)
  ids.has(id) ? ids.delete(id) : ids.add(id)
  saving.value = true
  try {
    await $fetch('/api/me/restrictions', { method: 'PUT', body: { restrictionIds: [...ids] } })
    await refreshMe()
  } finally {
    saving.value = false
  }
}

async function addCustom() {
  const name = customName.value.trim()
  if (!name) return
  const created: any = await $fetch('/api/restrictions', { method: 'POST', body: { name } })
  customName.value = ''
  await refreshRestrictions()
  if (!isSelected(created.id)) await toggle(created.id)
}

async function unlinkDiscord() {
  await $fetch('/api/me/discord', { method: 'DELETE' })
  await refreshMe()
}
</script>

<template>
  <div v-if="me">
    <h2 style="margin: 4px 0 12px">Your profile</h2>

    <p v-if="notice" :class="notice.ok ? 'ok-text' : 'error-text'">{{ notice.text }}</p>

    <div class="card">
      <h3>🥗 Food preferences &amp; restrictions</h3>
      <p class="muted small">
        Select everything that applies. When you RSVP "I'm in" for a meeting, these are counted
        automatically so the food order fits everyone — you never have to repeat them.
      </p>
      <div class="row">
        <span
          v-for="r in restrictions"
          :key="r.id"
          class="chip"
          :class="{ active: isSelected(r.id) }"
          @click="toggle(r.id)"
        >
          {{ r.name }}
        </span>
      </div>
      <div class="row mt">
        <input
          v-model="customName"
          type="text"
          placeholder="Something missing? Add your own…"
          maxlength="60"
          @keyup.enter="addCustom"
        />
        <button class="btn sm" :disabled="!customName.trim()" @click="addCustom">Add</button>
      </div>
    </div>

    <div class="card">
      <h3>💬 Discord</h3>
      <template v-if="me.discordId">
        <p>
          Linked to <strong>{{ me.discordUsername }}</strong> <span class="pill ok">connected</span>
        </p>
        <p class="muted small">
          The reminder bot can DM you if you haven't RSVP'd, and you can use
          <code>/rsvp</code> right in Discord.
        </p>
        <button class="btn sm danger" @click="unlinkDiscord">Unlink</button>
      </template>
      <template v-else>
        <p class="muted">
          Link your Discord account so the lab bot can remind you personally before the RSVP
          deadline — and so you can RSVP with <code>/rsvp</code> without opening this site.
        </p>
        <a class="btn primary" href="/auth/discord">Connect Discord</a>
      </template>
    </div>

    <div class="card">
      <h3>👤 Account</h3>
      <p class="muted small">
        Signed in as {{ me.name }} ({{ me.email }}) via the PSSL WordPress site.
        <span v-if="me.isAdmin" class="pill">admin</span>
      </p>
    </div>
  </div>
</template>
