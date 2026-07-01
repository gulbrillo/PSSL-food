<script setup lang="ts">
const state = useDialogState()

function close(result: boolean) {
  state.value.open = false
  state.value.resolve?.(result)
  state.value.resolve = undefined
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="state.open" class="dialog-overlay" @click.self="close(false)">
        <div class="dialog-card" role="dialog" aria-modal="true" :aria-label="state.title">
          <h3>{{ state.title }}</h3>
          <p>{{ state.message }}</p>
          <div class="dialog-actions">
            <button v-if="state.cancelText" class="btn" @click="close(false)">
              {{ state.cancelText }}
            </button>
            <button class="btn primary" @click="close(true)">{{ state.confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
