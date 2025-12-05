<template>
  <Modal :show="show" title="输入房间密码" @close="$emit('close')">
    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label class="block text-sm text-gray-300 mb-2">
          此房间需要密码才能加入
        </label>
        <input
          v-model="password"
          type="password"
          class="input-field"
          placeholder="请输入密码"
          autofocus
        />
        <p v-if="error" class="text-red-400 text-sm mt-2">{{ error }}</p>
      </div>
      
      <div class="flex gap-3">
        <button type="button" class="btn-secondary flex-1" @click="$emit('close')">
          取消
        </button>
        <button type="submit" class="btn-primary flex-1">
          加入房间
        </button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean
  error?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', password: string): void
}>()

const password = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    password.value = ''
  }
})

function handleSubmit() {
  emit('submit', password.value)
}
</script>
