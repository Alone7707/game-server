<template>
  <div class="min-h-screen p-4 md:p-8">
    <!-- Header -->
    <header class="text-center mb-8">
      <NuxtLink to="/" class="text-gray-400 hover:text-casino-gold text-sm mb-2 inline-block">← 返回游戏大厅</NuxtLink>
      <h1 class="text-4xl md:text-5xl font-bold text-casino-gold mb-2">
        🃏 斗地主
      </h1>
      <p class="text-gray-400">经典三人扑克游戏</p>
    </header>
    
    <!-- Name input if not set -->
    <div v-if="!userStore.name" class="max-w-md mx-auto mb-8">
      <div class="card-container p-6">
        <h2 class="text-xl font-bold text-casino-gold mb-4">欢迎来到斗地主</h2>
        <form @submit.prevent="setPlayerName">
          <label class="block text-sm text-gray-300 mb-2">请输入您的昵称</label>
          <div class="flex gap-3">
            <input
              v-model="playerName"
              type="text"
              class="input-field flex-1"
              placeholder="您的昵称"
              maxlength="12"
              required
            />
            <button type="submit" class="btn-primary">
              进入大厅
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Main content -->
    <div v-else class="max-w-5xl mx-auto">
      <!-- User info bar -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{{ userStore.avatar }}</span>
          <span class="text-lg font-medium text-casino-gold">{{ userStore.name }}</span>
          <span 
            class="text-sm px-2 py-1 rounded"
            :class="userStore.isConnected ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'"
          >
            {{ userStore.isConnected ? '已连接' : '未连接' }}
          </span>
        </div>
        
        <div class="flex gap-3">
          <button class="btn-primary" @click="showCreateModal = true">
            ➕ 创建房间
          </button>
          <button class="btn-success" @click="handleQuickJoin">
            ⚡ 快速加入
          </button>
        </div>
      </div>
      
      <!-- Error message -->
      <div 
        v-if="roomStore.error" 
        class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4 flex items-center justify-between"
      >
        <span>{{ roomStore.error }}</span>
        <button class="text-red-400 hover:text-red-200" @click="roomStore.clearError()">✕</button>
      </div>
      
      <!-- Room list -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xl font-bold text-casino-gold">房间列表</h2>
          <button 
            class="text-sm text-casino-gold hover:text-yellow-400 flex items-center gap-1"
            @click="refreshRooms"
          >
            🔄 刷新
          </button>
        </div>
        <RoomList :rooms="roomStore.rooms" @join="handleJoinRoom" />
      </div>
      
      <!-- Game rules -->
      <div class="card-container p-6 mt-8">
        <h3 class="text-lg font-bold text-casino-gold mb-3">🎮 游戏规则</h3>
        <div class="text-gray-300 text-sm space-y-2">
          <p><strong>基本规则：</strong>三人游戏，一副牌54张。每人17张牌，3张底牌归地主。</p>
          <p><strong>叫地主：</strong>玩家可以选择叫1分、2分、3分或不叫。叫分最高者成为地主。</p>
          <p><strong>出牌规则：</strong>地主先出牌，按顺序轮流出牌。后出的牌必须大过前面的牌。</p>
          <p><strong>胜负判定：</strong>地主先出完所有牌则地主胜，农民任一人先出完则农民胜。</p>
        </div>
      </div>
    </div>
    
    <!-- Modals -->
    <CreateRoomModal
      :show="showCreateModal"
      :player-name="userStore.name"
      @close="showCreateModal = false"
      @create="handleCreateRoom"
    />
    
    <PasswordModal
      :show="showPasswordModal"
      :error="passwordError"
      @close="closePasswordModal"
      @submit="handlePasswordSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import type { Room } from '~/types'
import { useUserStore } from '~/stores/user'
import { useRoomStore } from '~/stores/room'
import { useSocket } from '~/composables/useSocket'

const userStore = useUserStore()
const roomStore = useRoomStore()
const socket = useSocket()
const router = useRouter()

const playerName = ref('')
const showCreateModal = ref(false)
const showPasswordModal = ref(false)
const passwordError = ref('')
const pendingRoom = ref<Room | null>(null)

// Initialize user and socket on mount
onMounted(() => {
  userStore.initialize()
  
  if (userStore.name) {
    socket.connect()
  }
})

// Set player name
function setPlayerName() {
  if (playerName.value.trim()) {
    userStore.setName(playerName.value.trim())
    socket.connect()
  }
}

// Refresh room list
function refreshRooms() {
  socket.requestRoomList()
}

// Create room
function handleCreateRoom(data: { name: string; baseScore: number; password?: string }) {
  socket.createRoom(data.name, data.baseScore, data.password)
  showCreateModal.value = false
}

// Join room
function handleJoinRoom(room: Room) {
  if (room.hasPassword) {
    pendingRoom.value = room
    showPasswordModal.value = true
    passwordError.value = ''
  } else {
    socket.joinRoom(room.id)
  }
}

// Password submit
function handlePasswordSubmit(password: string) {
  if (pendingRoom.value) {
    socket.joinRoom(pendingRoom.value.id, password)
  }
}

// Close password modal
function closePasswordModal() {
  showPasswordModal.value = false
  pendingRoom.value = null
  passwordError.value = ''
}

// Quick join
function handleQuickJoin() {
  socket.quickJoin()
}

// Watch for room join success
watch(() => userStore.roomId, (newRoomId) => {
  if (newRoomId) {
    showPasswordModal.value = false
    router.push(`/doudizhu/room/${newRoomId}`)
  }
})

// Watch for errors
watch(() => roomStore.error, (error) => {
  if (error && showPasswordModal.value) {
    passwordError.value = error
    roomStore.clearError()
  }
})
</script>
