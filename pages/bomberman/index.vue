<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900/20 to-slate-900 p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <!-- 顶部标题 -->
      <div class="text-center mb-8">
        <h1 class="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-2">
          💣 炸弹人
        </h1>
        <p class="text-slate-400">经典泡泡堂玩法</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 左侧：操作区 -->
        <div class="space-y-4">
          <!-- 当前玩家 -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">👤</span>
              <span class="text-white font-medium">{{ userName }}</span>
            </div>
            <button
              @click="showNameModal = true"
              class="text-sm text-slate-400 hover:text-orange-400 transition"
            >
              修改
            </button>
          </div>

          <!-- 快速加入和创建房间 -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <button
              @click="quickJoin"
              class="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold transition mb-3"
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
            <h3 class="text-orange-400 font-semibold mb-4 flex items-center gap-2">
              <span>📖</span> 游戏规则
            </h3>
            <ul class="text-slate-400 text-sm space-y-2">
              <li>• 炸弹爆炸会产生十字形火焰</li>
              <li>• 炸弹可以引燃其他炸弹（连锁爆炸）</li>
              <li>• 炸开砖块可能获得道具</li>
              <li>• 最后存活的玩家获胜</li>
            </ul>
          </div>

          <!-- 道具说明 -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <h3 class="text-orange-400 font-semibold mb-4 flex items-center gap-2">
              <span>🎁</span> 道具说明
            </h3>
            <div class="text-slate-400 text-xs space-y-1">
              <div>💣 泡泡+1 | 💧 范围+1 | 👟 速度+1</div>
              <div>🦶 踢泡泡 | 🛡️ 盾牌 | 📌 针</div>
              <div>💥 最大泡泡 | 🌊 最大范围</div>
            </div>
          </div>

          <!-- 操作说明 -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <h3 class="text-orange-400 font-semibold mb-4 flex items-center gap-2">
              <span>🎮</span> 操作说明
            </h3>
            <div class="text-slate-400 text-sm space-y-2">
              <div class="flex items-center gap-3">
                <kbd class="px-2 py-1 bg-slate-700 rounded text-xs">↑↓←→</kbd>
                <span>或</span>
                <kbd class="px-2 py-1 bg-slate-700 rounded text-xs">WASD</kbd>
                <span>移动</span>
              </div>
              <div class="flex items-center gap-3">
                <kbd class="px-2 py-1 bg-slate-700 rounded text-xs">空格</kbd>
                <span>放置炸弹</span>
              </div>
              <div class="flex items-center gap-3">
                <kbd class="px-2 py-1 bg-slate-700 rounded text-xs">E</kbd>
                <span>射针（需道具）</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：房间列表 -->
        <div class="lg:col-span-2">
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🏠</span> 房间列表
              </h2>
              <button
                @click="refreshRooms"
                class="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition"
              >
                🔄 刷新
              </button>
            </div>

            <div v-if="rooms.length === 0" class="text-center py-12 text-slate-500">
              暂无房间，快来创建一个吧！
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="room in rooms"
                :key="room.id"
                class="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl border border-slate-600/50 hover:border-orange-500/50 transition cursor-pointer"
                @click="joinRoom(room)"
              >
                <div>
                  <div class="font-medium text-white flex items-center gap-2">
                    {{ room.name }}
                    <span v-if="room.hasPassword" class="text-amber-400">🔒</span>
                  </div>
                  <div class="text-sm text-slate-400">房主: {{ room.hostName }}</div>
                </div>
                <div class="text-right">
                  <div class="text-orange-400 font-medium">
                    {{ room.playerCount }}/{{ room.maxPlayers }}
                  </div>
                  <div class="text-xs text-slate-500">玩家</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建房间弹窗 -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showCreateModal = false"
    >
      <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
        <h3 class="text-xl font-bold text-white mb-6">创建房间</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">房间名称</label>
            <input
              v-model="createForm.roomName"
              type="text"
              placeholder="输入房间名称"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">房间密码（可选）</label>
            <input
              v-model="createForm.password"
              type="password"
              placeholder="不填则公开"
              class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">玩家人数</label>
            <div class="flex gap-2">
              <button
                v-for="n in [2, 3, 4, 5, 6]"
                :key="n"
                @click="setPlayerCount(n)"
                :class="[
                  'flex-1 py-2 rounded-lg transition text-sm',
                  createForm.rules.playerCount === n
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                ]"
              >
                {{ n }}人
              </button>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">地图大小</label>
            <div class="flex gap-2">
              <button
                v-for="size in ['small', 'medium', 'large']"
                :key="size"
                @click="setMapSize(size as 'small' | 'medium' | 'large')"
                :disabled="!canSelectMapSize(size as 'small' | 'medium' | 'large')"
                :class="[
                  'flex-1 py-2 rounded-lg transition',
                  createForm.rules.mapSize === size
                    ? 'bg-orange-500 text-white'
                    : !canSelectMapSize(size as 'small' | 'medium' | 'large')
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                ]"
              >
                {{ size === 'small' ? '小' : size === 'medium' ? '中' : '大' }}
              </button>
            </div>
            <p v-if="createForm.rules.playerCount > 4" class="text-xs text-slate-500 mt-1">
              5-6人需要中/大地图
            </p>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            @click="showCreateModal = false"
            class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            取消
          </button>
          <button
            @click="createRoom"
            class="flex-1 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-semibold transition"
          >
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- 加入房间密码弹窗 -->
    <div
      v-if="showPasswordModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showPasswordModal = false"
    >
      <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
        <h3 class="text-xl font-bold text-white mb-4">输入房间密码</h3>
        <input
          v-model="joinPassword"
          type="password"
          placeholder="请输入密码"
          class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-orange-500 mb-4"
          @keyup.enter="confirmJoin"
        />
        <div class="flex gap-3">
          <button
            @click="showPasswordModal = false"
            class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            取消
          </button>
          <button
            @click="confirmJoin"
            class="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
          >
            加入
          </button>
        </div>
      </div>
    </div>

    <!-- 名称设置弹窗 -->
    <div
      v-if="showNameModal"
      class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
        <h3 class="text-xl font-bold text-white mb-2 text-center">👤 欢迎来到炸弹人</h3>
        <p class="text-slate-400 text-sm mb-6 text-center">请先设置你的游戏名称</p>

        <input
          v-model="tempName"
          type="text"
          placeholder="输入你的名字"
          maxlength="12"
          class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-lg focus:outline-none focus:border-orange-500 mb-4"
          @keyup.enter="confirmName"
        />

        <button
          @click="confirmName"
          class="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold transition"
        >
          确认进入
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { io, Socket } from 'socket.io-client'

interface RoomInfo {
  id: string
  name: string
  hostName: string
  playerCount: number
  maxPlayers: number
  hasPassword: boolean
}

interface RoomRules {
  playerCount: number
  mapSize: 'small' | 'medium' | 'large'
}

const router = useRouter()
const socket = ref<Socket | null>(null)
const rooms = ref<RoomInfo[]>([])
const showCreateModal = ref(false)
const showPasswordModal = ref(false)
const joinPassword = ref('')
const selectedRoom = ref<RoomInfo | null>(null)

const userId = ref('')
const userName = ref('')

const createForm = ref({
  roomName: '',
  password: '',
  rules: {
    playerCount: 4,
    mapSize: 'medium' as 'small' | 'medium' | 'large',
  },
})

const showNameModal = ref(false)
const tempName = ref('')

onMounted(() => {
  // 获取或生成用户ID
  userId.value = localStorage.getItem('bomberman_userId') || `user_${Math.random().toString(36).substring(2, 8)}`
  localStorage.setItem('bomberman_userId', userId.value)
  
  // 检查是否已设置名称
  const savedName = localStorage.getItem('bomberman_userName')
  if (savedName) {
    userName.value = savedName
    initSocket()
  } else {
    showNameModal.value = true
  }
})

function confirmName() {
  if (!tempName.value.trim()) {
    alert('请输入名称')
    return
  }
  userName.value = tempName.value.trim()
  localStorage.setItem('bomberman_userName', userName.value)
  showNameModal.value = false
  tempName.value = ''
  
  // 如果 socket 未初始化，则初始化
  if (!socket.value) {
    initSocket()
  }
}

onUnmounted(() => {
  socket.value?.disconnect()
})

function initSocket() {
  socket.value = io()

  socket.value.on('connect', () => {
    socket.value?.emit('bomberman:room:list')
  })

  socket.value.on('bomberman:room:list', (data: RoomInfo[]) => {
    rooms.value = data
  })

  socket.value.on('bomberman:room:created', (data: { room: any }) => {
    router.push(`/bomberman/room/${data.room.id}`)
  })

  socket.value.on('bomberman:room:joined', (data: { room: any }) => {
    router.push(`/bomberman/room/${data.room.id}`)
  })

  socket.value.on('bomberman:room:error', (data: { message: string }) => {
    alert(data.message)
  })
}

function refreshRooms() {
  socket.value?.emit('bomberman:room:list')
}

function createRoom() {
  socket.value?.emit('bomberman:room:create', {
    userId: userId.value,
    userName: userName.value,
    roomName: createForm.value.roomName || `${userName.value}的房间`,
    rules: createForm.value.rules,
    password: createForm.value.password || undefined,
  })
}

function joinRoom(room: RoomInfo) {
  if (room.hasPassword) {
    selectedRoom.value = room
    showPasswordModal.value = true
  } else {
    socket.value?.emit('bomberman:room:join', {
      roomId: room.id,
      userId: userId.value,
      userName: userName.value,
    })
  }
}

function confirmJoin() {
  if (!selectedRoom.value) return
  socket.value?.emit('bomberman:room:join', {
    roomId: selectedRoom.value.id,
    userId: userId.value,
    userName: userName.value,
    password: joinPassword.value,
  })
  showPasswordModal.value = false
  joinPassword.value = ''
  selectedRoom.value = null
}

function quickJoin() {
  // 尝试加入第一个未满且无密码的房间
  const availableRoom = rooms.value.find(r => !r.hasPassword && r.playerCount < r.maxPlayers)
  if (availableRoom) {
    socket.value?.emit('bomberman:room:join', {
      roomId: availableRoom.id,
      userId: userId.value,
      userName: userName.value,
    })
  } else {
    // 没有可加入的房间，创建新房间
    socket.value?.emit('bomberman:room:create', {
      userId: userId.value,
      userName: userName.value,
      roomName: `${userName.value}的房间`,
      rules: { playerCount: 4, mapSize: 'medium' },
    })
  }
}

// 地图大小限制：小地图最多4人
function canSelectMapSize(size: 'small' | 'medium' | 'large'): boolean {
  const playerCount = createForm.value.rules.playerCount
  if (size === 'small' && playerCount > 4) return false
  return true
}

function setPlayerCount(n: number) {
  createForm.value.rules.playerCount = n
  // 如果当前地图大小不支持该人数，自动调整
  if (!canSelectMapSize(createForm.value.rules.mapSize)) {
    createForm.value.rules.mapSize = 'medium'
  }
}

function setMapSize(size: 'small' | 'medium' | 'large') {
  if (canSelectMapSize(size)) {
    createForm.value.rules.mapSize = size
  }
}
</script>
