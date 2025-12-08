<template>
  <div class="min-h-screen bg-slate-900 p-4 md:p-8">
    <!-- 顶部导航 -->
    <header class="text-center mb-8">
      <NuxtLink to="/" class="text-slate-400 hover:text-white text-sm mb-2 inline-block transition-colors">← 返回游戏大厅</NuxtLink>
      <h1 class="text-4xl md:text-5xl font-bold text-emerald-400 mb-2 flex items-center justify-center gap-3">
        <span class="text-4xl">🃏</span>
        7鬼523
      </h1>
      <p class="text-slate-400">经典扑克牌玩法，7最大、鬼次之、523紧随</p>
    </header>

    <div class="max-w-6xl mx-auto">
      <!-- 用户信息 -->
      <div v-if="!userStore.name" class="max-w-md mx-auto mb-8">
        <div class="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl shadow-lg backdrop-blur-sm">
          <h2 class="text-xl font-bold text-emerald-400 mb-4">设置昵称</h2>
          <div class="flex gap-3">
            <input
              v-model="nickname"
              type="text"
              placeholder="请输入昵称"
              class="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              @keyup.enter="setNickname"
            />
            <button
              @click="setNickname"
              class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              确认
            </button>
          </div>
        </div>
      </div>

      <!-- 主要内容 -->
      <div v-else class="grid lg:grid-cols-3 gap-8">
        <!-- 左侧：操作区 -->
        <div class="lg:col-span-1 space-y-6">
          <!-- 用户卡片 -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <div class="flex items-center gap-4 mb-4">
              <div class="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-3xl border border-slate-600">
                🃏
              </div>
              <div>
                <p class="text-slate-200 font-semibold text-lg">{{ userStore.name }}</p>
                <p class="text-slate-500 text-xs">ID: {{ userStore.id?.slice(0, 8) }}</p>
              </div>
            </div>
          </div>

          <!-- 快速开始 -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 space-y-4 border border-slate-700/50">
            <button
              @click="quickJoin"
              class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-lg transition shadow-lg shadow-emerald-900/20"
            >
              🎮 快速加入
            </button>
            <button
              @click="showCreateModal = true"
              class="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition border border-slate-600"
            >
              ➕ 创建房间
            </button>
          </div>

          <!-- 游戏规则 -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <h3 class="text-emerald-400 font-semibold mb-4 flex items-center gap-2">
              <span>📖</span> 游戏规则
            </h3>
            <ul class="text-slate-400 text-sm space-y-2">
              <li>• 牌的大小：7 > 大小王 > 5 > 2 > 3 > A > K > ... > 4</li>
              <li>• 每人发5张牌，轮流出牌</li>
              <li>• 后出的牌必须比前面的大</li>
              <li>• 出不了或不想出可以选择Pass</li>
              <li>• 所有人Pass则本轮结束，最后出牌者赢得本轮</li>
              <li>• 补牌至手牌上限，赢家先出</li>
              <li>• 捡分最多的玩家获胜</li>
            </ul>
          </div>
        </div>

        <!-- 右侧：房间列表 -->
        <div class="lg:col-span-2">
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 min-h-[500px]">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-bold text-slate-200 flex items-center gap-2">
                <span>🏠</span> 房间列表
              </h2>
              <button
                @click="refreshRooms"
                class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition text-sm"
              >
                🔄 刷新
              </button>
            </div>

            <div v-if="rooms.length === 0" class="text-center py-20 text-slate-600">
              <p class="text-4xl mb-4 opacity-50">🔍</p>
              <p>暂无房间，快来创建一个吧！</p>
            </div>

            <div v-else class="grid gap-4">
              <div
                v-for="room in rooms"
                :key="room.id"
                class="bg-slate-700/30 hover:bg-slate-700/50 rounded-xl p-4 transition cursor-pointer border border-slate-700/50 hover:border-slate-600"
                @click="joinRoom(room)"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-slate-200 font-semibold flex items-center gap-2">
                      {{ room.name }}
                      <span v-if="room.hasPassword" class="text-amber-500 text-xs border border-amber-500/30 px-1 rounded">🔒</span>
                    </h3>
                    <p class="text-slate-500 text-xs mt-1">
                      房主: {{ room.hostName }} · {{ getRulesText(room.rules) }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-slate-300 font-mono">
                      <span class="text-emerald-400">{{ room.playerCount }}</span>
                      <span class="text-slate-600">/{{ room.maxPlayers }}</span>
                    </p>
                    <p class="text-[10px] mt-1" :class="room.phase === 'waiting' ? 'text-emerald-500' : 'text-amber-500'">
                      {{ room.phase === 'waiting' ? '等待中' : '游戏中' }}
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
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl">
        <h2 class="text-xl font-bold text-slate-200 mb-6">创建房间</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">房间名称</label>
            <input
              v-model="createForm.name"
              type="text"
              placeholder="输入房间名称"
              class="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          
          <div>
            <label class="block text-slate-400 text-sm mb-2">房间密码（可选）</label>
            <input
              v-model="createForm.password"
              type="password"
              placeholder="不设置则公开"
              class="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <!-- 游戏规则设置 -->
          <div class="border-t border-slate-700 pt-4 mt-4">
            <h3 class="text-slate-300 font-semibold mb-4">游戏规则</h3>
            
            <!-- 玩家人数 -->
            <div class="mb-4">
              <label class="block text-slate-400 text-sm mb-2">玩家人数（2-5人）</label>
              <div class="flex gap-2">
                <button
                  v-for="n in [2, 3, 4, 5]"
                  :key="n"
                  @click="createForm.rules.playerCount = n"
                  class="px-4 py-2 rounded-lg transition"
                  :class="createForm.rules.playerCount === n ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
                >
                  {{ n }}人
                </button>
              </div>
            </div>

            <!-- 手牌数量 -->
            <div>
              <label class="block text-slate-400 text-sm mb-2">每人手牌数</label>
              <div class="flex gap-2">
                <button
                  v-for="n in [5, 7, 10]"
                  :key="n"
                  @click="createForm.rules.handSize = n"
                  class="px-4 py-2 rounded-lg transition"
                  :class="createForm.rules.handSize === n ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'"
                >
                  {{ n }}张
                </button>
              </div>
            </div>
            
            <!-- 规则说明 -->
            <div class="mt-4 p-3 bg-slate-700/30 rounded-lg text-xs text-slate-400">
              <p>• 牌的大小：7 > 大小王 > 5 > 2 > 3 > A > K > ... > 4</p>
              <p>• 首轮由最小牌持有者先出，必须出包含最小牌的牌型</p>
              <p>• 炸弹（3张或4张相同）可压任何非炸弹牌型</p>
              <p>• 得分牌：5=5分，10和K=10分</p>
            </div>
          </div>
        </div>

        <div class="flex gap-4 mt-8">
          <button
            @click="showCreateModal = false"
            class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition"
          >
            取消
          </button>
          <button
            @click="createRoom"
            class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition shadow-lg shadow-emerald-900/20"
          >
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- 密码输入弹窗 -->
    <div v-if="showPasswordModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
        <h2 class="text-xl font-bold text-slate-200 mb-6">输入房间密码</h2>
        
        <input
          v-model="joinPassword"
          type="password"
          placeholder="请输入密码"
          class="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          @keyup.enter="confirmJoinRoom"
        />

        <div class="flex gap-4 mt-8">
          <button
            @click="showPasswordModal = false; selectedRoom = null"
            class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition"
          >
            取消
          </button>
          <button
            @click="confirmJoinRoom"
            class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition shadow-lg shadow-emerald-900/20"
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

interface RoomRules {
  playerCount: number
  handSize: number
}

interface RoomInfo {
  id: string
  name: string
  hostName: string
  hasPassword: boolean
  playerCount: number
  maxPlayers: number
  phase: string
  rules: RoomRules
}

const router = useRouter()
const userStore = useUserStore()

const nickname = ref('')
const rooms = ref<RoomInfo[]>([])
const showCreateModal = ref(false)
const showPasswordModal = ref(false)
const selectedRoom = ref<RoomInfo | null>(null)
const joinPassword = ref('')

const createForm = ref({
  name: '',
  password: '',
  rules: {
    playerCount: 4,
    handSize: 5,
  },
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

  socket.on('qigui523:room:list', (data: RoomInfo[]) => {
    rooms.value = data
  })

  socket.on('qigui523:room:joined', (data: { room: any }) => {
    router.push(`/qigui523/room/${data.room.id}`)
  })

  socket.on('qigui523:room:error', (data: { message: string }) => {
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
  socket?.emit('qigui523:room:list')
}

function createRoom() {
  if (!createForm.value.name.trim()) {
    createForm.value.name = `${userStore.name}的房间`
  }

  socket?.emit('qigui523:room:create', {
    hostId: userStore.id,
    hostName: userStore.name,
    name: createForm.value.name,
    password: createForm.value.password || undefined,
    rules: createForm.value.rules,
  })

  showCreateModal.value = false
}

function joinRoom(room: RoomInfo) {
  if (room.hasPassword) {
    selectedRoom.value = room
    showPasswordModal.value = true
  } else {
    socket?.emit('qigui523:room:join', {
      roomId: room.id,
      userId: userStore.id,
      userName: userStore.name,
    })
  }
}

function confirmJoinRoom() {
  if (selectedRoom.value) {
    socket?.emit('qigui523:room:join', {
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
  socket?.emit('qigui523:room:quick_join', {
    userId: userStore.id,
    userName: userStore.name,
  })
}

function getRulesText(rules: RoomRules): string {
  return `${rules.playerCount}人 · ${rules.handSize}张`
}
</script>
