<template>
  <div class="min-h-screen bg-slate-900 p-4 md:p-8">
    <!-- Header -->
    <header class="text-center mb-8">
      <NuxtLink to="/" class="text-slate-400 hover:text-white text-sm mb-2 inline-block transition-colors">← 返回游戏大厅</NuxtLink>
      <h1 class="text-4xl md:text-5xl font-bold text-amber-400 mb-2">
        🃏 斗地主
      </h1>
      <p class="text-slate-400">经典三人扑克游戏</p>
    </header>
    
    <!-- Name input if not set -->
    <div v-if="!userStore.name" class="max-w-md mx-auto mb-8">
      <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-lg backdrop-blur-sm">
        <h2 class="text-xl font-bold text-amber-400 mb-4">欢迎来到斗地主</h2>
        <form @submit.prevent="setPlayerName">
          <label class="block text-sm text-slate-300 mb-2">请输入您的昵称</label>
          <div class="flex gap-3">
            <input
              v-model="playerName"
              type="text"
              class="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="您的昵称"
              maxlength="12"
              required
            />
            <button type="submit" class="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              进入大厅
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Main content -->
    <div v-else class="max-w-5xl mx-auto">
      <!-- User info bar -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
        <div class="flex items-center gap-3">
          <span class="text-2xl grayscale opacity-80">{{ userStore.avatar }}</span>
          <span class="text-lg font-medium text-slate-200">{{ userStore.name }}</span>
          <span 
            class="text-xs px-2 py-1 rounded border"
            :class="userStore.isConnected ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-rose-900/30 text-rose-400 border-rose-800'"
          >
            {{ userStore.isConnected ? '已连接' : '未连接' }}
          </span>
        </div>
        
        <div class="flex gap-3">
          <button class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-blue-900/20" @click="showCreateModal = true">
            ➕ 创建房间
          </button>
          <button class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-emerald-900/20" @click="handleQuickJoin">
            ⚡ 快速加入
          </button>
        </div>
      </div>
      
      <!-- Error message -->
      <div 
        v-if="roomStore.error" 
        class="bg-rose-900/30 border border-rose-500/50 text-rose-300 px-4 py-3 rounded-lg mb-4 flex items-center justify-between"
      >
        <span>{{ roomStore.error }}</span>
        <button class="text-rose-400 hover:text-rose-200" @click="roomStore.clearError()">✕</button>
      </div>
      
      <!-- Room list -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-slate-200 flex items-center gap-2">
            <span>🏠</span> 房间列表
          </h2>
          <button 
            class="text-sm text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            @click="refreshRooms"
          >
            🔄 刷新
          </button>
        </div>
        <div class="bg-slate-800/30 rounded-2xl p-1 min-h-[200px]">
          <RoomList :rooms="roomStore.rooms" @join="handleJoinRoom" />
        </div>
      </div>
      
      <!-- Game rules -->
      <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-lg backdrop-blur-sm">
        <h3 class="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
          <span>🎮</span> 游戏规则
        </h3>
        <div class="text-slate-400 text-sm space-y-2">
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
