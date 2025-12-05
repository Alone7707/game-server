<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="handleClose">
        <div class="modal-content animate-fade-in">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-casino-gold">{{ title }}</h3>
            <button 
              v-if="closable"
              class="text-gray-400 hover:text-white transition-colors"
              @click="handleClose"
            >
              ✕
            </button>
          </div>
          
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean
  title: string
  closable?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function handleClose() {
  if (props.closable !== false) {
    emit('close')
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
}
</style>
