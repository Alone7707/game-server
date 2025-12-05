<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
    <!-- 顶部导航 -->
    <nav class="bg-black/30 backdrop-blur-sm border-b border-white/10">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 text-white/80 hover:text-white transition">
          <span class="text-xl">←</span>
          <span>返回大厅</span>
        </NuxtLink>
        <h1 class="text-xl font-bold text-white flex items-center gap-2">
          <span class="text-2xl">🕵️</span>
          谁是卧底
        </h1>
        <div class="w-24"></div>
      </div>
    </nav>

    <div class="max-w-6xl mx-auto px-4 py-8">
      <!-- 用户信息 -->
      <div v-if="!userStore.name" class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
        <h2 class="text-lg font-semibold text-white mb-4">设置昵称</h2>
        <div class="flex gap-4">
          <input
            v-model="nickname"
            type="text"
            placeholder="请输入昵称"
            class="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
            @keyup.enter="setNickname"
          />
          <button
            @click="setNickname"
            class="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition"
          >
            确认
          </button>
        </div>
      </div>

      <!-- 主要内容 -->
      <div v-else class="grid lg:grid-cols-3 gap-8">
        <!-- 左侧：操作区 -->
        <div class="lg:col-span-1 space-y-6">
          <!-- 用户卡片 -->
          <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div class="flex items-center gap-4 mb-4">
              <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-2xl">
                🕵️
              </div>
              <div>
                <p class="text-white font-semibold text-lg">{{ userStore.name }}</p>
                <p class="text-white/60 text-sm">ID: {{ userStore.id?.slice(0, 8) }}</p>
              </div>
            </div>
          </div>

          <!-- 快速开始 -->
          <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-4">
            <button
              @click="quickJoin"
              class="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold text-lg transition transform hover:scale-[1.02]"
            >
              🎮 快速加入
            </button>
            <button
              @click="showCreateModal = true"
              class="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition border border-white/20"
            >
              ➕ 创建房间
            </button>
          </div>

          <!-- 游戏规则 -->
          <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
              <span>📖</span> 游戏规则
            </h3>
            <ul class="text-white/70 text-sm space-y-2">
              <li>• 3-8人参与，1名卧底 + 其他平民</li>
              <li>• 每人获得一个词语（卧底词与平民词相似但不同）</li>
              <li>• 轮流描述自己的词语，不能说出词语中的字</li>
              <li>• 投票淘汰你认为是卧底的人</li>
              <li>• 平民：找出所有卧底获胜</li>
              <li>• 卧底：存活到仅剩3人获胜</li>
            </ul>
          </div>
        </div>

        <!-- 右侧：房间列表 -->
        <div class="lg:col-span-2">
          <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🏠</span> 房间列表
              </h2>
              <button
                @click="refreshRooms"
                class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
              >
                🔄 刷新
              </button>
            </div>

            <div v-if="rooms.length === 0" class="text-center py-12 text-white/50">
              <p class="text-4xl mb-4">🔍</p>
              <p>暂无房间，快来创建一个吧！</p>
            </div>

            <div v-else class="grid gap-4">
              <div
                v-for="room in rooms"
                :key="room.id"
                class="bg-white/5 hover:bg-white/10 rounded-xl p-4 transition cursor-pointer border border-white/10"
                @click="joinRoom(room)"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-white font-semibold flex items-center gap-2">
                      {{ room.name }}
                      <span v-if="room.hasPassword" class="text-yellow-400">🔒</span>
                    </h3>
                    <p class="text-white/50 text-sm mt-1">
                      房主: {{ room.hostName }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-white">
                      <span class="text-green-400">{{ room.players?.length || 0 }}</span>
                      <span class="text-white/50">/{{ room.maxPlayers }}</span>
                    </p>
                    <p class="text-xs mt-1" :class="room.status === 'waiting' ? 'text-green-400' : 'text-yellow-400'">
                      {{ room.status === 'waiting' ? '等待中' : '游戏中' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建房间弹窗 -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold text-white mb-6">创建房间</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-white/70 text-sm mb-2">房间名称</label>
            <input
              v-model="createForm.name"
              type="text"
              placeholder="输入房间名称"
              class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
            />
          </div>
          
          <div>
            <label class="block text-white/70 text-sm mb-2">房间密码（可选）</label>
            <input
              v-model="createForm.password"
              type="password"
              placeholder="不设置则公开"
              class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>

        <div class="flex gap-4 mt-6">
          <button
            @click="showCreateModal = false"
            class="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
          >
            取消
          </button>
          <button
            @click="createRoom"
            class="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition"
          >
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- 密码输入弹窗 -->
    <div v-if="showPasswordModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold text-white mb-6">输入房间密码</h2>
        
        <input
          v-model="joinPassword"
          type="password"
          placeholder="请输入密码"
          class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
          @keyup.enter="confirmJoinRoom"
        />

        <div class="flex gap-4 mt-6">
          <button
            @click="showPasswordModal = false; selectedRoom = null"
            class="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
          >
            取消
          </button>
          <button
            @click="confirmJoinRoom"
            class="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition"
          >
            加入
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { io, Socket } from 'socket.io-client'
import { useUserStore } from '~/stores/user'

const router = useRouter()
const userStore = useUserStore()

const nickname = ref('')
const rooms = ref<any[]>([])
const showCreateModal = ref(false)
const showPasswordModal = ref(false)
const selectedRoom = ref<any>(null)
const joinPassword = ref('')

const createForm = ref({
  name: '',
  password: '',
})

let socket: Socket | null = null

onMounted(() => {
  userStore.initialize()
  initSocket()
})

onUnmounted(() => {
  if (socket) {
    socket.disconnect()
  }
})

function initSocket() {
  socket = io({
    path: '/socket.io/',
    transports: ['polling'],
  })

  socket.on('connect', () => {
    if (userStore.id && userStore.name) {
      socket?.emit('user:register', {
        userId: userStore.id,
        userName: userStore.name,
      })
      refreshRooms()
    }
  })

  socket.on('undercover:room:list', (data) => {
    rooms.value = data.filter((r: any) => r.status === 'waiting')
  })

  socket.on('undercover:room:created', () => {
    refreshRooms()
  })

  socket.on('undercover:room:updated', () => {
    refreshRooms()
  })

  socket.on('undercover:room:deleted', () => {
    refreshRooms()
  })

  socket.on('undercover:room:joined', (data) => {
    router.push(`/undercover/room/${data.room.id}`)
  })

  socket.on('undercover:room:error', (data) => {
    alert(data.message)
  })
}

function setNickname() {
  if (nickname.value.trim()) {
    userStore.setName(nickname.value.trim())
    if (socket?.connected) {
      socket.emit('user:register', {
        userId: userStore.id,
        userName: userStore.name,
      })
      refreshRooms()
    }
  }
}

function refreshRooms() {
  socket?.emit('undercover:room:list')
}

function createRoom() {
  if (!createForm.value.name.trim()) {
    createForm.value.name = `${userStore.name}的房间`
  }

  socket?.emit('undercover:room:create', {
    hostId: userStore.id,
    hostName: userStore.name,
    name: createForm.value.name,
    password: createForm.value.password || undefined,
  })

  showCreateModal.value = false
  createForm.value = { name: '', password: '' }
}

function joinRoom(room: any) {
  if (room.hasPassword) {
    selectedRoom.value = room
    showPasswordModal.value = true
  } else {
    socket?.emit('undercover:room:join', {
      roomId: room.id,
      userId: userStore.id,
      userName: userStore.name,
    })
  }
}

function confirmJoinRoom() {
  if (selectedRoom.value) {
    socket?.emit('undercover:room:join', {
      roomId: selectedRoom.value.id,
      userId: userStore.id,
      userName: userStore.name,
      password: joinPassword.value,
    })
  }
  showPasswordModal.value = false
  joinPassword.value = ''
  selectedRoom.value = null
}

function quickJoin() {
  socket?.emit('undercover:room:quick_join', {
    userId: userStore.id,
    userName: userStore.name,
  })
}
</script>
