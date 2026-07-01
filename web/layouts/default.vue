<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()
const menuOpen = ref(false)

// close the mobile menu on navigation
watch(() => route.fullPath, () => (menuOpen.value = false))

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  navigateTo('/login')
}
</script>

<template>
  <div>
    <header v-if="loggedIn" class="site-header">
      <div class="inner">
        <NuxtLink to="/" class="brand">
          <AppLogo :size="34" />
          <span>
            Lunch<span class="accent">Pad</span>
            <span class="sub">PSSL · Lab Meeting RSVP</span>
          </span>
        </NuxtLink>

        <button
          class="hamburger"
          :aria-expanded="menuOpen"
          aria-label="Toggle menu"
          @click="menuOpen = !menuOpen"
        >
          <span v-if="!menuOpen">☰</span>
          <span v-else>✕</span>
        </button>

        <div class="nav-area" :class="{ open: menuOpen }">
          <nav>
            <NuxtLink to="/">Meetings</NuxtLink>
            <NuxtLink to="/caterers">Caterers</NuxtLink>
            <NuxtLink to="/profile">Profile</NuxtLink>
            <NuxtLink v-if="(user as any)?.isAdmin" to="/admin">Admin</NuxtLink>
          </nav>
          <span class="spacer" />
          <span class="who">
            {{ (user as any)?.name }}
            <span v-if="(user as any)?.isAdmin" class="role">admin</span>
          </span>
          <button class="btn sm" @click="signOut">Sign out</button>
        </div>
      </div>
    </header>
    <main class="container">
      <slot />
    </main>
    <AppDialog />
  </div>
</template>
