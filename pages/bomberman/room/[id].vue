<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900/20 to-slate-900 p-4">
    <!-- 顶部信息栏 -->
    <div class="max-w-4xl mx-auto mb-4">
      <div class="flex items-center justify-between bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
        <div class="flex items-center gap-4">
          <button
            @click="leaveRoom"
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            ← 返回
          </button>
          <div>
            <h1 class="text-xl font-bold text-white">{{ room?.name }}</h1>
            <p class="text-sm text-slate-400">房间ID: {{ roomId }}</p>
          </div>
        </div>
        <div class="text-right">
          <div class="text-orange-400 font-medium">
            {{ room?.players?.length || 0 }}/{{ room?.rules?.playerCount || 4 }} 玩家
          </div>
        </div>
      </div>
    </div>

    <!-- 等待阶段 -->
    <div v-if="room?.phase === 'waiting'" class="max-w-4xl mx-auto">
      <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
        <h2 class="text-2xl font-bold text-white text-center mb-6">等待玩家加入</h2>

        <!-- 玩家列表 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div
            v-for="i in (room?.rules?.playerCount || 4)"
            :key="i"
            class="bg-slate-700/50 rounded-xl p-4 border border-slate-600 text-center"
          >
            <template v-if="room?.players?.[i - 1]">
              <div
                class="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl"
                :style="{ backgroundColor: room.players[i - 1].color }"
              >
                😎
              </div>
              <div class="text-slate-200 font-medium truncate">
                {{ room.players[i - 1].name }}
              </div>
              <div
                class="text-xs mt-1"
                :class="room.players[i - 1].isReady ? 'text-emerald-400' : 'text-slate-500'"
              >
                {{ room.players[i - 1].isReady ? '已准备' : '未准备' }}
              </div>
              <div v-if="room.players[i - 1].id === room.hostId" class="text-amber-500 text-[10px] mt-1">
                房主
              </div>
            </template>
            <template v-else>
              <div class="w-12 h-12 rounded-full mx-auto mb-2 bg-slate-600 flex items-center justify-center text-2xl opacity-30">
                👤
              </div>
              <div class="text-slate-500 text-sm">等待加入</div>
            </template>
          </div>
        </div>

        <!-- 游戏设置 -->
        <div class="bg-slate-700/30 rounded-xl p-4 mb-6">
          <h3 class="text-slate-400 text-sm mb-2">游戏设置</h3>
          <div class="flex flex-wrap gap-4 text-sm">
            <span class="text-slate-300">
              地图大小: <span class="text-orange-400">{{ mapSizeText }}</span>
            </span>
            <span class="text-slate-300">
              炸弹延时: <span class="text-orange-400">{{ room?.rules?.bombTimer || 3000 }}ms</span>
            </span>
            <span class="text-slate-300">
              初始炸弹: <span class="text-orange-400">{{ room?.rules?.initialBombs || 1 }}个</span>
            </span>
            <span class="text-slate-300">
              初始范围: <span class="text-orange-400">{{ room?.rules?.initialRange || 2 }}格</span>
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-center gap-4">
          <button
            v-if="!isHost"
            @click="toggleReady"
            :class="[
              'px-8 py-3 rounded-xl font-semibold transition',
              myPlayer?.isReady
                ? 'bg-slate-600 hover:bg-slate-500 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            ]"
          >
            {{ myPlayer?.isReady ? '取消准备' : '准备' }}
          </button>
          <button
            v-if="isHost"
            @click="startGame"
            :disabled="!canStart"
            :class="[
              'px-8 py-3 rounded-xl font-semibold transition',
              canStart
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            ]"
          >
            开始游戏
          </button>
        </div>
      </div>
    </div>

    <!-- 游戏阶段 -->
    <div v-else-if="room?.phase === 'playing'" class="max-w-4xl mx-auto">
      <!-- 玩家状态栏 -->
      <div class="flex justify-center gap-4 mb-4">
        <div
          v-for="player in room.players"
          :key="player.id"
          :class="[
            'px-4 py-2 rounded-lg flex items-center gap-2',
            player.isAlive ? 'bg-slate-800/80' : 'bg-slate-800/40 opacity-50'
          ]"
        >
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center text-sm"
            :style="{ backgroundColor: player.color }"
          >
            {{ player.isAlive ? '😎' : '💀' }}
          </div>
          <span :class="player.isAlive ? 'text-white' : 'text-slate-500'">{{ player.name }}</span>
          <div class="flex items-center gap-1 text-xs text-slate-400">
            <span>💣{{ player.bombCount }}/{{ player.maxBombs }}</span>
            <span>🔥{{ player.bombRange }}</span>
          </div>
        </div>
      </div>

      <!-- 游戏画布 -->
      <div class="flex justify-center">
        <div
          class="relative bg-slate-800 rounded-xl overflow-hidden border-4 border-slate-700"
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        >
          <!-- 地图格子 -->
          <div
            v-for="(row, y) in room.map?.cells"
            :key="y"
            class="flex"
          >
            <div
              v-for="(cell, x) in row"
              :key="x"
              :class="getCellClass(cell, x, y)"
              :style="{ width: cellSize + 'px', height: cellSize + 'px' }"
            >
              <!-- 道具 -->
              <span v-if="getPowerUpAt(x, y)" class="text-lg">
                {{ getPowerUpIcon(getPowerUpAt(x, y)?.type) }}
              </span>
            </div>
          </div>

          <!-- 炸弹 -->
          <div
            v-for="bomb in room.bombs"
            :key="bomb.id"
            class="absolute flex items-center justify-center text-2xl animate-pulse"
            :style="{
              left: bomb.position.x * cellSize + 'px',
              top: bomb.position.y * cellSize + 'px',
              width: cellSize + 'px',
              height: cellSize + 'px',
            }"
          >
            💣
          </div>

          <!-- 爆炸效果 -->
          <template v-for="explosion in room.explosions" :key="explosion.createdAt">
            <div
              v-for="(pos, idx) in explosion.positions"
              :key="idx"
              class="absolute bg-orange-500/80 flex items-center justify-center"
              :style="{
                left: pos.x * cellSize + 'px',
                top: pos.y * cellSize + 'px',
                width: cellSize + 'px',
                height: cellSize + 'px',
              }"
            >
              🔥
            </div>
          </template>

          <!-- 玩家 -->
          <div
            v-for="player in room.players.filter(p => p.isAlive)"
            :key="player.id"
            class="absolute flex items-center justify-center text-2xl transition-all duration-100"
            :style="{
              left: player.position.x * cellSize + 'px',
              top: player.position.y * cellSize + 'px',
              width: cellSize + 'px',
              height: cellSize + 'px',
            }"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center"
              :style="{ backgroundColor: player.color }"
              :class="{ 'ring-2 ring-white': player.id === myPlayer?.id }"
            >
              😎
            </div>
          </div>
        </div>
      </div>

      <!-- 操作提示 -->
      <div class="text-center mt-4 text-slate-400 text-sm">
        使用 <kbd class="px-2 py-1 bg-slate-700 rounded">↑↓←→</kbd> 或 <kbd class="px-2 py-1 bg-slate-700 rounded">WASD</kbd> 移动，
        <kbd class="px-2 py-1 bg-slate-700 rounded">空格</kbd> 放置炸弹
      </div>
    </div>

    <!-- 游戏结束 -->
    <div v-else-if="room?.phase === 'finished'" class="max-w-md mx-auto">
      <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 text-center">
        <div class="text-6xl mb-4">🏆</div>
        <h2 class="text-2xl font-bold text-white mb-2">游戏结束</h2>
        <p class="text-xl text-orange-400 mb-6">
          {{ winnerName }} 获胜！
        </p>

        <!-- 玩家排名 -->
        <div class="space-y-2 mb-6">
          <div
            v-for="(player, index) in sortedPlayers"
            :key="player.id"
            :class="[
              'flex items-center gap-3 p-3 rounded-lg',
              player.isAlive ? 'bg-orange-500/20' : 'bg-slate-700/50'
            ]"
          >
            <span class="text-xl">{{ index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '💀' }}</span>
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center"
              :style="{ backgroundColor: player.color }"
            >
              {{ player.isAlive ? '😎' : '💀' }}
            </div>
            <span class="text-white">{{ player.name }}</span>
          </div>
        </div>

        <button
          v-if="isHost"
          @click="restartGame"
          class="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold transition"
        >
          再来一局
        </button>
      </div>
    </div>

    <!-- Toast 提示 -->
    <div
      v-if="toast.show"
      class="fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg z-50 transition-all"
      :class="{
        'bg-emerald-500 text-white': toast.type === 'success',
        'bg-amber-500 text-white': toast.type === 'warning',
        'bg-red-500 text-white': toast.type === 'error',
      }"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io, Socket } from 'socket.io-client'

interface Position {
  x: number
  y: number
}

interface Player {
  id: string
  name: string
  isOnline: boolean
  isReady: boolean
  isAlive: boolean
  position: Position
  bombCount: number
  maxBombs: number
  bombRange: number
  speed: number
  color: string
}

interface Cell {
  type: 'empty' | 'wall' | 'brick' | 'bomb' | 'explosion' | 'powerup'
}

interface Bomb {
  id: string
  playerId: string
  position: Position
  range: number
}

interface Explosion {
  positions: Position[]
  createdAt: number
  expiresAt: number
}

interface PowerUp {
  id: string
  type: 'bomb_count' | 'bomb_range' | 'speed'
  position: Position
}

interface Room {
  id: string
  name: string
  hostId: string
  rules: {
    playerCount: number
    mapSize: 'small' | 'medium' | 'large'
    bombTimer: number
    initialBombs: number
    initialRange: number
  }
  players: Player[]
  phase: 'waiting' | 'playing' | 'finished'
  map: { width: number; height: number; cells: Cell[][] } | null
  bombs: Bomb[]
  explosions: Explosion[]
  powerUps: PowerUp[]
  winner: string | null
}

const route = useRoute()
const router = useRouter()
const roomId = route.params.id as string

const socket = ref<Socket | null>(null)
const room = ref<Room | null>(null)
const userId = ref('')
const userName = ref('')

const toast = ref({ show: false, message: '', type: 'success' as 'success' | 'warning' | 'error' })

const cellSize = 40

const myPlayer = computed(() => room.value?.players.find(p => p.id === userId.value))
const isHost = computed(() => room.value?.hostId === userId.value)
const canStart = computed(() => {
  if (!room.value) return false
  if (room.value.players.length < 2) return false
  return room.value.players.every(p => p.isReady || p.id === room.value?.hostId)
})

const mapSizeText = computed(() => {
  const size = room.value?.rules?.mapSize
  return size === 'small' ? '小' : size === 'large' ? '大' : '中'
})

const canvasWidth = computed(() => (room.value?.map?.width || 13) * cellSize)
const canvasHeight = computed(() => (room.value?.map?.height || 11) * cellSize)

const winnerName = computed(() => {
  if (!room.value?.winner) return '无人'
  return room.value.players.find(p => p.id === room.value?.winner)?.name || '未知'
})

const sortedPlayers = computed(() => {
  if (!room.value) return []
  return [...room.value.players].sort((a, b) => {
    if (a.isAlive && !b.isAlive) return -1
    if (!a.isAlive && b.isAlive) return 1
    return 0
  })
})

// 长按移动相关
const moveDirection = ref<string | null>(null)
const moveInterval = ref<ReturnType<typeof setInterval> | null>(null)
const moveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const MOVE_DELAY_MS = 60 // 按住后开始持续移动的延迟
const MOVE_INTERVAL_MS = 100 // 持续移动间隔

function startMoving(direction: string) {
  if (moveDirection.value === direction) return
  
  stopMoving()
  moveDirection.value = direction
  
  // 立即移动一次
  socket.value?.emit('bomberman:game:move', { userId: userId.value, direction })
  
  // 延迟后开始持续移动（避免轻点移动多格）
  moveTimeout.value = setTimeout(() => {
    moveInterval.value = setInterval(() => {
      if (room.value?.phase === 'playing' && myPlayer.value?.isAlive) {
        socket.value?.emit('bomberman:game:move', { userId: userId.value, direction })
      } else {
        stopMoving()
      }
    }, MOVE_INTERVAL_MS)
  }, MOVE_DELAY_MS)
}

function stopMoving() {
  if (moveTimeout.value) {
    clearTimeout(moveTimeout.value)
    moveTimeout.value = null
  }
  if (moveInterval.value) {
    clearInterval(moveInterval.value)
    moveInterval.value = null
  }
  moveDirection.value = null
}

onMounted(() => {
  userId.value = localStorage.getItem('bomberman_userId') || ''
  userName.value = localStorage.getItem('bomberman_userName') || ''

  if (!userId.value) {
    router.push('/bomberman')
    return
  }

  initSocket()
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  stopMoving()
  socket.value?.disconnect()
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

function initSocket() {
  socket.value = io()

  socket.value.on('connect', () => {
    socket.value?.emit('bomberman:room:rejoin', { roomId, userId: userId.value })
  })

  socket.value.on('bomberman:room:joined', (data: { room: Room }) => {
    room.value = data.room
  })

  socket.value.on('bomberman:room:updated', (data: { room: Room }) => {
    room.value = data.room
  })

  socket.value.on('bomberman:room:player_joined', (data: { room: Room }) => {
    room.value = data.room
    const newPlayer = data.room.players[data.room.players.length - 1]
    showToast(`${newPlayer?.name} 加入了房间`, 'success')
  })

  socket.value.on('bomberman:room:player_left', (data: { room: Room }) => {
    const leftPlayer = room.value?.players.find(p => !data.room.players.find(np => np.id === p.id))
    if (leftPlayer) {
      showToast(`${leftPlayer.name} 离开了房间`, 'warning')
    }
    room.value = data.room
  })

  socket.value.on('bomberman:room:player_offline', (data: { playerName: string; room: Room }) => {
    showToast(`${data.playerName} 离线了`, 'warning')
    room.value = data.room
  })

  socket.value.on('bomberman:room:player_reconnected', (data: { playerName: string }) => {
    showToast(`${data.playerName} 重连成功`, 'success')
  })

  socket.value.on('bomberman:room:disbanded', () => {
    showToast('房间已解散', 'warning')
    setTimeout(() => router.push('/bomberman'), 1500)
  })

  socket.value.on('bomberman:game:started', (data: { room: Room }) => {
    room.value = data.room
    showToast('游戏开始！', 'success')
  })

  socket.value.on('bomberman:game:updated', (data: { room: Room }) => {
    room.value = data.room
  })

  socket.value.on('bomberman:game:bomb_placed', (data: { room: Room }) => {
    room.value = data.room
  })

  socket.value.on('bomberman:game:explosion', (data: { room: Room }) => {
    room.value = data.room
  })

  socket.value.on('bomberman:game:finished', (data: { winnerName: string }) => {
    showToast(`${data.winnerName || '无人'} 获胜！`, 'success')
  })

  socket.value.on('bomberman:game:reset', (data: { room: Room }) => {
    room.value = data.room
  })

  socket.value.on('bomberman:room:error', (data: { message: string }) => {
    showToast(data.message, 'error')
    if (data.message === '房间不存在' || data.message === '你不在此房间中') {
      setTimeout(() => router.push('/bomberman'), 1500)
    }
  })
}

function getDirectionFromKey(key: string): string | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up'
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down'
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left'
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right'
    default:
      return null
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (room.value?.phase !== 'playing' || !myPlayer.value?.isAlive) return

  // 放炸弹
  if (e.key === ' ') {
    e.preventDefault()
    placeBomb()
    return
  }

  // 移动
  const direction = getDirectionFromKey(e.key)
  if (direction) {
    e.preventDefault()
    startMoving(direction)
  }
}

function handleKeyUp(e: KeyboardEvent) {
  const direction = getDirectionFromKey(e.key)
  if (direction && moveDirection.value === direction) {
    stopMoving()
  }
}

function getCellClass(cell: Cell, x: number, y: number): string {
  const base = 'flex items-center justify-center '
  switch (cell.type) {
    case 'wall':
      return base + 'bg-slate-600'
    case 'brick':
      return base + 'bg-amber-800'
    default:
      return base + 'bg-slate-700/50'
  }
}

function getPowerUpAt(x: number, y: number): PowerUp | undefined {
  return room.value?.powerUps.find(p => p.position.x === x && p.position.y === y)
}

function getPowerUpIcon(type?: string): string {
  switch (type) {
    case 'bomb_count': return '💣'
    case 'bomb_range': return '🔥'
    case 'speed': return '👟'
    default: return ''
  }
}

function toggleReady() {
  socket.value?.emit('bomberman:game:ready', {
    userId: userId.value,
    ready: !myPlayer.value?.isReady,
  })
}

function startGame() {
  socket.value?.emit('bomberman:game:start', {
    roomId,
    userId: userId.value,
  })
}

function placeBomb() {
  socket.value?.emit('bomberman:game:bomb', { userId: userId.value })
}

function restartGame() {
  socket.value?.emit('bomberman:game:restart', {
    roomId,
    userId: userId.value,
  })
}

function leaveRoom() {
  socket.value?.emit('bomberman:room:leave', { userId: userId.value })
  router.push('/bomberman')
}

function showToast(message: string, type: 'success' | 'warning' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 2000)
}
</script>
