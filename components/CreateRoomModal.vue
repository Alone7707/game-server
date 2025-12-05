<template>
  <Modal :show="show" title="创建房间" @close="$emit('close')">
    <form @submit.prevent="handleSubmit">
      <div class="space-y-4">
        <!-- Room name -->
        <div>
          <label class="block text-sm text-gray-300 mb-1">房间名称</label>
          <input
            v-model="roomName"
            type="text"
            class="input-field"
            placeholder="输入房间名称"
            maxlength="20"
          />
        </div>
        
        <!-- Base score -->
        <div>
          <label class="block text-sm text-gray-300 mb-1">底分</label>
          <div class="flex gap-2">
            <button
              v-for="score in [1, 2, 5, 10]"
              :key="score"
              type="button"
              class="flex-1 py-2 rounded-lg transition-all"
              :class="baseScore === score 
                ? 'bg-casino-gold text-casino-dark font-bold' 
                : 'bg-casino-dark text-gray-300 hover:bg-casino-green'"
              @click="baseScore = score"
            >
              {{ score }} 分
            </button>
          </div>
        </div>
        
        <!-- Password -->
        <div>
          <label class="flex items-center gap-2 text-sm text-gray-300 mb-1">
            <input
              v-model="usePassword"
              type="checkbox"
              class="w-4 h-4 rounded bg-casino-dark border-casino-gold-dark"
            />
            设置房间密码
          </label>
          <input
            v-if="usePassword"
            v-model="password"
            type="password"
            class="input-field mt-2"
            placeholder="输入房间密码"
            maxlength="20"
          />
        </div>
      </div>
      
      <div class="flex gap-3 mt-6">
        <button type="button" class="btn-secondary flex-1" @click="$emit('close')">
          取消
        </button>
        <button type="submit" class="btn-primary flex-1">
          创建房间
        </button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean
  playerName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create', data: { name: string; baseScore: number; password?: string }): void
}>()

const roomName = ref('')
const baseScore = ref(1)
const usePassword = ref(false)
const password = ref('')

watch(() => props.show, (newVal) => {
  if (newVal) {
    roomName.value = `${props.playerName}的房间`
    baseScore.value = 1
    usePassword.value = false
    password.value = ''
  }
})

function handleSubmit() {
  emit('create', {
    name: roomName.value || `${props.playerName}的房间`,
    baseScore: baseScore.value,
    password: usePassword.value ? password.value : undefined,
  })
}
</script>
