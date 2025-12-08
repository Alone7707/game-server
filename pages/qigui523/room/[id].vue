<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <!-- 顶部栏 -->
    <header class="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button @click="handleLeave" class="text-slate-300 hover:text-white transition">
            ← 离开房间
          </button>
          <span class="text-slate-600">|</span>
          <span class="text-slate-400 font-mono text-sm">{{ room?.name || '加载中...' }}</span>
        </div>
        
        <div class="flex items-center gap-4 text-sm">
          <span class="text-slate-400">
            牌堆: <span class="text-emerald-400 font-bold">{{ room?.deck?.count || 0 }}</span>
          </span>
        </div>
      </div>
    </header>

    <!-- 游戏区域 -->
    <main class="flex-1 p-4 relative overflow-hidden">
      <div class="max-w-6xl mx-auto h-full">
        
        <!-- 等待状态 -->
        <div v-if="room?.phase === 'waiting'" class="h-full flex items-center justify-center">
          <div class="bg-slate-800/50 border border-slate-700 p-8 rounded-2xl text-center max-w-2xl w-full">
            <h2 class="text-2xl font-bold text-slate-200 mb-6">等待玩家加入</h2>
            
            <!-- 规则展示 -->
            <div class="bg-slate-700/30 rounded-xl p-4 mb-6 text-left">
              <h3 class="text-emerald-400 font-semibold mb-2">游戏规则</h3>
              <div class="grid grid-cols-2 gap-2 text-sm text-slate-400 mb-3">
                <div>玩家人数: <span class="text-slate-200">{{ room?.rules?.playerCount }}人</span></div>
                <div>手牌数量: <span class="text-slate-200">{{ room?.rules?.handSize }}张</span></div>
              </div>
              <div class="text-xs text-slate-500 space-y-1">
                <p>• 牌的大小：7 > 大小王 > 5 > 2 > 3 > A > K > ... > 4</p>
                <p>• 首轮由最小牌持有者先出，必须出包含最小牌</p>
                <p>• 炸弹（3张或4张相同）可压任何非炸弹</p>
                <p>• 得分牌：5=5分，10和K=10分</p>
              </div>
            </div>

            <!-- 玩家列表 -->
            <div class="grid grid-cols-3 gap-4 mb-8">
              <div 
                v-for="i in (room?.rules?.playerCount || 4)" 
                :key="i"
                class="bg-slate-700/50 rounded-xl p-4 border border-slate-600"
              >
                <template v-if="room?.players?.[i - 1]">
                  <div class="text-2xl mb-2">🃏</div>
                  <div class="text-slate-200 font-medium truncate flex items-center justify-center gap-2">
                    {{ room.players[i - 1].name }}
                    <span v-if="!room.players[i - 1].isOnline" class="px-1.5 py-0.5 rounded bg-slate-600 text-[10px] text-slate-300">离线</span>
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
                  <div class="text-2xl mb-2 opacity-20">👤</div>
                  <div class="text-slate-600 text-sm">空位</div>
                </template>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                v-if="!isReady && !isHost"
                @click="handleReady"
                class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition"
              >
                准备
              </button>
              <button
                v-if="isReady && !isHost"
                @click="handleCancelReady"
                class="w-full py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-bold transition"
              >
                取消准备
              </button>
              <button
                v-if="isHost"
                @click="handleStart"
                :disabled="!canStart"
                class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition"
              >
                {{ canStart ? '开始游戏' : `等待玩家 (${readyCount}/${room?.rules?.playerCount})` }}
              </button>
            </div>
          </div>
        </div>

        <!-- 游戏进行中 -->
        <div v-else-if="room?.phase === 'playing'" class="h-full flex flex-col">
          <!-- 其他玩家区域 -->
          <div class="flex justify-center gap-8 mb-8">
            <div 
              v-for="player in otherPlayers" 
              :key="player.id"
              class="bg-slate-800/50 rounded-xl p-4 border min-w-[160px] text-center transition-all"
              :class="room.currentTurn === player.id ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-700'"
            >
              <div class="text-lg mb-1 flex items-center justify-center gap-2">
                {{ player.name }}
                <span v-if="!player.isOnline" class="px-1.5 py-0.5 rounded bg-slate-600 text-[10px] text-slate-300">离线</span>
              </div>
              <div class="text-slate-400 text-sm mb-2">
                手牌: <span class="text-emerald-400 font-bold">{{ player.handCount }}</span>
              </div>
              <div class="text-slate-400 text-xs">
                得分: <span class="text-amber-400">{{ player.score }}分</span>
              </div>
              <div v-if="room.currentTurn === player.id" class="text-emerald-400 text-xs mt-2 animate-pulse">
                正在出牌...
              </div>
            </div>
          </div>

          <!-- 中央出牌区域 -->
          <div class="flex-1 flex items-center justify-center">
            <div class="bg-slate-800/30 rounded-2xl p-8 min-w-[400px] min-h-[200px] border border-slate-700/50 flex flex-col items-center justify-center">
              <div v-if="room.lastPlay && !room.lastPlay.passed" class="flex gap-1">
                <div 
                  v-for="(card, index) in room.lastPlay.cards" 
                  :key="card.id"
                  class="transform hover:scale-105 transition-transform"
                  :style="{ marginLeft: index > 0 ? '-20px' : '0', zIndex: index }"
                >
                  <Qigui523PlayingCard :card="card" />
                </div>
              </div>
              <div v-else-if="room.lastPlay?.passed" class="text-slate-500 text-xl">
                {{ getPlayerName(room.lastPlay.playerId) }} 选择 Pass
              </div>
              <div v-else class="text-slate-600 text-lg">
                等待出牌...
              </div>
            </div>
          </div>

          <!-- 底部操作区域 -->
          <div class="absolute bottom-0 left-0 right-0 flex flex-col items-center z-30 pointer-events-none">
            
            <!-- 1. 我的信息卡片 -->
            <div class="pointer-events-auto mb-2 transition-all duration-300" 
                 :class="isMyTurn ? 'scale-105' : ''"
            >
               <div class="bg-slate-800/90 backdrop-blur-sm rounded-xl p-3 border min-w-[140px] text-center shadow-xl"
                  :class="isMyTurn ? 'border-emerald-500 shadow-emerald-500/20' : 'border-slate-700'"
               >
                  <div class="text-base font-bold text-slate-200 flex items-center justify-center gap-2">
                    {{ myPlayer?.name }}
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">我</span>
                  </div>
                  <div class="text-slate-400 text-xs mt-1">
                    得分: <span class="text-amber-400 font-bold font-mono text-sm">{{ myScore }}</span>
                  </div>
               </div>
            </div>

            <!-- 2. 操作按钮和提示 -->
            <div class="w-full flex flex-col items-center justify-center mb-2 pointer-events-auto min-h-[50px] transition-all duration-300">
              <template v-if="isMyTurn">
                <!-- 提示 (当没有选择牌时显示) -->
                <div class="mb-2">
                  <span class="text-emerald-400 font-bold animate-pulse bg-slate-900/80 px-4 py-1 rounded-full border border-emerald-500/30 backdrop-blur-sm text-sm">
                    轮到你出牌了！
                  </span>
                </div>

                <!-- 按钮组 -->
                <div class="flex justify-center gap-4">
                  <button
                    v-if="canPass"
                    @click="handlePass"
                    class="px-8 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition shadow-lg shadow-black/30"
                  >
                    Pass
                  </button>
                  <button
                    @click="handlePlay"
                    :disabled="selectedCards.length === 0"
                    class="px-8 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-bold transition shadow-lg shadow-emerald-900/30"
                  >
                    出牌
                  </button>
                  <button
                    @click="clearSelection"
                    class="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition shadow-lg shadow-black/30"
                  >
                    重选
                  </button>
                </div>
              </template>
            </div>

            <!-- 3. 手牌区域 -->
            <div class="w-full bg-slate-800/95 border-t border-slate-700 p-4 pb-6 rounded-t-3xl shadow-2xl pointer-events-auto">
              <div class="flex justify-center gap-1 flex-wrap min-h-[120px]">
                <div 
                  v-for="card in myHand" 
                  :key="card.id"
                  @click="toggleCard(card)"
                  class="transform cursor-pointer transition-all hover:scale-105"
                  :class="selectedCards.includes(card.id) ? '-translate-y-6' : ''"
                >
                  <Qigui523PlayingCard :card="card" :selected="selectedCards.includes(card.id)" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 游戏结束 -->
        <div v-else-if="room?.phase === 'finished'" class="h-full flex items-center justify-center">
          <div class="bg-slate-800/50 border border-slate-700 p-8 rounded-2xl text-center max-w-md w-full">
            <h2 class="text-3xl font-bold text-emerald-400 mb-6">🎉 游戏结束</h2>
            
            <div v-if="winner" class="mb-6">
              <p class="text-slate-300 text-lg">
                <span class="text-amber-400 font-bold">{{ winner.name }}</span> 获胜！
              </p>
            </div>

            <!-- 分数榜 -->
            <div class="bg-slate-700/30 rounded-xl p-4 mb-6">
              <div 
                v-for="(player, index) in sortedPlayers" 
                :key="player.id"
                class="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0"
              >
                <div class="flex items-center gap-2">
                  <span class="text-slate-500">{{ index + 1 }}.</span>
                  <span :class="player.id === winner?.id ? 'text-amber-400 font-bold' : 'text-slate-300'">
                    {{ player.name }}
                  </span>
                </div>
                <span class="text-emerald-400 font-mono">{{ player.score }}分</span>
              </div>
            </div>

            <button
              v-if="isHost"
              @click="handleRestart"
              class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition"
            >
              再来一局
            </button>
            <p v-else class="text-slate-500 text-sm">等待房主开始新游戏...</p>
          </div>
        </div>

      </div>
    </main>

    <!-- 全局 Toast 提示 -->
    <div class="fixed top-4 right-4 z-50 transition-all duration-300 transform"
         :class="toast.show ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'">
      <div class="px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2"
           :class="{
             'bg-slate-800/90 border-emerald-500/50 text-emerald-400': toast.type === 'success',
             'bg-slate-800/90 border-amber-500/50 text-amber-400': toast.type === 'warning',
             'bg-slate-800/90 border-red-500/50 text-red-400': toast.type === 'error',
             'bg-slate-800/90 border-blue-500/50 text-blue-400': toast.type === 'info'
           }">
        <span class="text-lg">
          {{ toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : toast.type === 'error' ? '❌' : 'ℹ️' }}
        </span>
        <span class="font-medium">{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io, Socket } from 'socket.io-client'
import { useUserStore } from '~/stores/user'

interface Card {
  id: string
  suit: string
  rank: string
  value: number
}

interface Player {
  id: string
  name: string
  handCount: number
  hand?: Card[]
  isReady: boolean
  isOnline: boolean
  score: number
  position: number
}

interface Room {
  id: string
  name: string
  hostId: string
  players: Player[]
  phase: string
  rules: {
    playerCount: number
    handSize: number
  }
  deck: { count: number }
  currentTurn: string | null
  roundStarter: string | null
  firstRound: boolean
  finishOrder: string[]
  lastPlay: {
    playerId: string
    cards: Card[]
    pattern: string
    passed: boolean
  } | null
}

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const roomId = computed(() => route.params.id as string)
const room = ref<Room | null>(null)
const selectedCards = ref<string[]>([])
const winner = ref<Player | null>(null)

let socket: Socket | null = null

// 计算属性
const myPlayer = computed(() => room.value?.players?.find(p => p.id === userStore.id))
const myHand = computed(() => myPlayer.value?.hand || [])
const myScore = computed(() => myPlayer.value?.score || 0)
const isHost = computed(() => room.value?.hostId === userStore.id)
const isReady = computed(() => myPlayer.value?.isReady || false)
const isMyTurn = computed(() => room.value?.currentTurn === userStore.id)
const canPass = computed(() => room.value?.lastPlay !== null)

const otherPlayers = computed(() => 
  room.value?.players?.filter(p => p.id !== userStore.id) || []
)

const readyCount = computed(() => 
  room.value?.players?.filter(p => p.isReady).length || 0
)

const canStart = computed(() => {
  if (!room.value) return false
  return room.value.players.length === room.value.rules.playerCount &&
         room.value.players.every(p => p.isReady)
})

const sortedPlayers = computed(() => {
  if (!room.value) return []
  return [...room.value.players].sort((a, b) => b.score - a.score)
})

onMounted(() => {
  userStore.initialize()
  if (!userStore.name) {
    router.push('/qigui523')
    return
  }
  initSocket()
})

onUnmounted(() => {
  socket?.disconnect()
})

const toast = ref({
  show: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'warning' | 'error'
})

function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

function initSocket() {
  socket = io({
    path: '/socket.io/',
    transports: ['polling'],
  })

  socket.on('connect', () => {
    socket?.emit('user:register', {
      userId: userStore.id,
      userName: userStore.name,
    })
    
    // 加入或重连房间
    socket?.emit('qigui523:room:rejoin', {
      roomId: roomId.value,
      userId: userStore.id,
    })
  })

  socket.on('qigui523:room:joined', (data) => {
    room.value = data.room
  })

  socket.on('qigui523:room:updated', (data) => {
    room.value = data.room
  })

  socket.on('qigui523:room:player_joined', (data) => {
    room.value = data.room
    // 找出新加入的玩家
    const newPlayer = data.room.players[data.room.players.length - 1]
    if (newPlayer) {
      showToast(`${newPlayer.name} 加入了房间`, 'success')
    }
  })

  socket.on('qigui523:room:player_reconnected', (data) => {
    // 服务端现在发送完整的房间数据（包含手牌）
    if (data.room) {
      room.value = data.room
    }
    showToast(`${data.playerName} 重连成功`, 'success')
  })

  socket.on('qigui523:room:player_left', (data) => {
    // 找出离开的玩家（对比旧数据和新数据）
    if (room.value) {
      const leftPlayer = room.value.players.find(p => !data.room.players.find((np: Player) => np.id === p.id))
      if (leftPlayer) {
        showToast(`${leftPlayer.name} 离开了房间`, 'warning')
      }
    }
    room.value = data.room
  })

  socket.on('qigui523:room:player_offline', (data) => {
    if (room.value) {
      const player = room.value.players.find(p => p.id === data.playerId)
      if (player) {
        player.isOnline = false
        showToast(`${player.name} 离线了`, 'warning')
      }
    }
  })

  socket.on('qigui523:game:started', (data) => {
    room.value = data.room
    selectedCards.value = []
    winner.value = null
  })

  socket.on('qigui523:game:updated', (data) => {
    room.value = data.room
  })

  socket.on('qigui523:game:finished', (data) => {
    if (data.winnerId) {
      winner.value = room.value?.players?.find(p => p.id === data.winnerId) || null
    }
    if (room.value) {
      room.value.phase = 'finished'
    }
  })

  socket.on('qigui523:game:reset', (data) => {
    room.value = data.room
    selectedCards.value = []
    winner.value = null
  })

  socket.on('qigui523:room:disbanded', () => {
    alert('房间已解散')
    router.push('/qigui523')
  })

  socket.on('qigui523:room:error', (data) => {
    alert(data.message)
    router.push('/qigui523')
  })

  socket.on('qigui523:game:error', (data) => {
    alert(data.message)
  })
}

function handleLeave() {
  socket?.emit('qigui523:room:leave', { userId: userStore.id })
  router.push('/qigui523')
}

function handleReady() {
  socket?.emit('qigui523:game:ready', { userId: userStore.id, ready: true })
}

function handleCancelReady() {
  socket?.emit('qigui523:game:ready', { userId: userStore.id, ready: false })
}

function handleStart() {
  socket?.emit('qigui523:game:start', { roomId: roomId.value, userId: userStore.id })
}

function handleRestart() {
  socket?.emit('qigui523:game:restart', { roomId: roomId.value, userId: userStore.id })
}

function toggleCard(card: Card) {
  if (!isMyTurn.value) return
  
  const index = selectedCards.value.indexOf(card.id)
  if (index === -1) {
    selectedCards.value.push(card.id)
  } else {
    selectedCards.value.splice(index, 1)
  }
}

function clearSelection() {
  selectedCards.value = []
}

function handlePlay() {
  if (selectedCards.value.length === 0) return
  
  socket?.emit('qigui523:game:play', {
    roomId: roomId.value,
    userId: userStore.id,
    cardIds: selectedCards.value,
  })
  
  selectedCards.value = []
}

function handlePass() {
  socket?.emit('qigui523:game:pass', {
    roomId: roomId.value,
    userId: userStore.id,
  })
}

function getPlayerName(playerId: string): string {
  return room.value?.players?.find(p => p.id === playerId)?.name || '未知玩家'
}
</script>
