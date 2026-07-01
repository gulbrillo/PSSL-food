<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const error = computed(() => {
  if (route.query.error === 'sso') return 'Login with the PSSL site failed. Please try again.'
  if (route.query.error === 'state') return 'Your login session expired. Please try again.'
  return null
})
</script>

<template>
  <div class="login-wrap">
    <div class="login-card">
      <div style="font-size: 44px">🍕</div>
      <h1>PSSL Food</h1>
      <p class="muted">
        Lab meeting RSVPs &amp; food preferences for the Precision Space Systems Lab.
      </p>
      <p v-if="error" class="error-text">{{ error }}</p>
      <a class="btn primary" style="width: 100%; justify-content: center; padding: 12px" href="/auth/wp">
        Sign in with your PSSL account
      </a>
      <p class="muted small mt">
        You'll be sent to pssl.mae.ufl.edu to log in (UF single sign-on) and returned here.
      </p>
    </div>
  </div>
</template>
