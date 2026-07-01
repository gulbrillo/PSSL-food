export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // all overridable via NUXT_* env vars (set in docker-compose.yml)
    wpBaseUrl: 'https://pssl.mae.ufl.edu',
    wpClientId: '',
    wpClientSecret: '',
    discordClientId: '',
    discordClientSecret: '',
    botApiToken: '',
    adminEmails: '',
    public: {
      appUrl: 'http://localhost:3000'
    }
  },
  app: {
    head: {
      title: 'PSSL Food',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }]
    }
  }
})
