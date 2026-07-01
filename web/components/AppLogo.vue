<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 32 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="LunchPad logo">
    <circle cx="32" cy="32" r="31" fill="#0a1856" />
    <circle cx="14" cy="18" r="1.6" fill="#ffffff" opacity="0.8" />
    <circle cx="50" cy="13" r="1.2" fill="#ffffff" opacity="0.6" />
    <circle cx="53" cy="40" r="1.5" fill="#ffffff" opacity="0.55" />
    <circle cx="11" cy="42" r="1.2" fill="#ffffff" opacity="0.6" />
    <circle cx="44" cy="24" r="0.9" fill="#ffffff" opacity="0.5" />
    <path d="M25 51 Q32 63 39 51 Q35.5 55 32 54 Q28.5 55 25 51 Z" fill="#ffb020" />
    <path d="M28.5 52 Q32 59 35.5 52 Q32 54 28.5 52 Z" fill="#fa4616" />
    <path d="M32 7 L44.5 45.5 Q32 51.5 19.5 45.5 Z" fill="#f7c873" />
    <path d="M32 11.5 L42 43.5 Q32 48.5 22 43.5 Z" fill="#fa4616" opacity="0.92" />
    <path d="M19.5 45.5 Q32 51.5 44.5 45.5 L43 50 Q32 55.2 21 50 Z" fill="#e08a2e" />
    <circle cx="32" cy="23" r="3.4" fill="#ffe1b3" />
    <circle cx="32" cy="23" r="2.1" fill="#ffd08a" />
    <circle cx="27.5" cy="36" r="2.7" fill="#ffe1b3" />
    <circle cx="36.5" cy="36" r="2.7" fill="#ffe1b3" />
  </svg>
</template>
