<template>
  <div class="h-screen flex flex-col bg-slate-900 overflow-hidden relative">
    <!-- 背景装饰 (降低透明度，使其不明显) -->
    <div class="absolute inset-0 opacity-5 pointer-events-none">
      <div class="absolute top-0 left-0 w-64 h-64 bg-slate-700 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div class="absolute bottom-0 right-0 w-96 h-96 bg-slate-700 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
    </div>

    <!-- 顶部栏 -->
    <div class="relative z-10 h-12 flex items-center justify-between px-4 bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
      <div class="flex items-center gap-3">
        <button @click="handleLeave" class="w-7 h-7 flex items-center justify-center bg-slate-700/50 rounded-full text-slate-300 hover:text-white hover:bg-slate-600 transition">
          <span class="text-lg">←</span>
        </button>
        <div>
          <h1 class="text-slate-200 font-bold text-sm">{{ room?.name || '加载中...' }}</h1>
          <p class="text-slate-500 text-[10px]">ID: {{ room?.id }}</p>
        </div>
      </div>

      <!-- 顶部中间：状态提示 -->
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800/80 px-3 py-0.5 rounded-full border border-slate-700">
        <span class="text-slate-300 text-xs font-medium">{{ phaseText }}</span>
        <span v-if="room?.currentRound > 0" class="text-slate-500 text-[10px] ml-2">R{{ room.currentRound }}</span>
      </div>

      <!-- 右侧：倒计时 -->
      <div v-if="countdown > 0" class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-slate-700/50 flex items-center justify-center">
          <span class="text-slate-200 font-mono text-xs">{{ countdown }}</span>
        </div>
      </div>
    </div>

    <!-- 游戏区域 -->
    <div class="flex-1 relative z-10 flex p-2 md:p-4 overflow-hidden">
      <!-- 左侧座位 (1-4) -->
      <div class="w-24 sm:w-32 flex flex-col justify-between py-2 h-full">
        <PlayerSeat
          v-for="pos in [1, 2, 3, 4]"
          :key="pos"
          :index="pos"
          :player="getPlayerByPosition(pos)"
          :isMe="getPlayerByPosition(pos)?.id === userStore.id"
          :isHost="getPlayerByPosition(pos)?.id === room?.hostId"
          :isCurrentDescriber="room?.currentDescriber === getPlayerByPosition(pos)?.id"
          :showDescription="room?.phase === 'voting' || room?.phase === 'result' || room?.phase === 'ended'"
          :bubblePosition="'right'"
          :phase="room?.phase"
          :isSelected="selectedVoteTarget === getPlayerByPosition(pos)?.id"
          :isMyVoteTarget="myVoteTargetId === getPlayerByPosition(pos)?.id"
          @click="handleSeatClick(pos)"
        />
      </div>

      <!-- 中间区域 -->
      <div class="flex-1 flex flex-col justify-center items-center relative px-2">
        
        <!-- 我的词语卡片 (游戏开始后显示) -->
        <div v-if="myPrivateData?.word && room?.phase !== 'waiting'" class="absolute top-4 z-20">
          <div 
            class="bg-slate-700 border border-slate-600 rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
            @click="showWord = !showWord"
          >
            <div class="px-4 py-1.5 min-w-[100px] text-center">
              <p class="text-slate-400 text-[10px] mb-0.5">词语</p>
              <p class="text-slate-200 font-bold text-sm">{{ showWord ? myPrivateData.word : '***' }}</p>
            </div>
          </div>
        </div>

        <!-- 游戏主操作区 -->
        <div class="w-full max-w-md space-y-4">
          
          <!-- 等待阶段按钮 -->
          <div v-if="room?.phase === 'waiting'" class="flex flex-col gap-3 w-full max-w-[200px] mx-auto">
            <button
              v-if="!isReady"
              @click="handleReady"
              class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm shadow-sm transition"
            >
              准备
            </button>
            <button
              v-else-if="!isHost"
              @click="handleCancelReady"
              class="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium text-sm transition"
            >
              取消
            </button>
            <button
              v-if="isHost"
              @click="handleStartGame"
              :disabled="!canStart"
              class="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm shadow-sm transition"
            >
              {{ canStart ? '开始' : `等待 (${readyCount}/${room?.players?.length || 0})` }}
            </button>
          </div>

          <!-- 描述输入框 -->
          <div v-else-if="room?.phase === 'describing' && !hasSubmittedDescription && isAlive" class="bg-slate-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-700">
             <textarea
              v-model="myDescription"
              :placeholder="`描述你的词语（${minDescLength}-${maxDescLength}字）`"
              class="w-full h-20 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-300 p-3 text-xs resize-none focus:outline-none focus:border-slate-500 mb-3"
              :maxlength="maxDescLength"
            ></textarea>
            <button
              @click="submitDescription"
              :disabled="!canSubmitDescription"
              class="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-xs transition"
            >
              提交
            </button>
          </div>

          <!-- 投票确认 -->
          <div v-else-if="room?.phase === 'voting' && !hasVoted && isAlive" class="text-center">
             <div v-if="selectedVoteTarget" class="bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
              <p class="text-slate-300 text-sm mb-3">投票给 <span class="text-white font-bold">{{ getPlayerName(selectedVoteTarget) }}</span> ?</p>
              <div class="flex gap-2">
                <button
                  @click="selectedVoteTarget = null"
                  class="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition"
                >
                  取消
                </button>
                <button
                  @click="submitVote"
                  class="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs transition"
                >
                  确认
                </button>
              </div>
             </div>
             <div v-else class="text-slate-400 text-xs bg-slate-800/50 px-3 py-1.5 rounded-full inline-block">
               点击头像投票
             </div>
          </div>

          <!-- 结果/结束操作 -->
          <div v-else-if="room?.phase === 'result' || room?.phase === 'ended'" class="flex flex-col gap-2 w-full max-w-[200px] mx-auto">
            <button
              v-if="isHost && room?.phase === 'result'"
              @click="handleNextRound"
              class="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm shadow-sm transition"
            >
              下一轮
            </button>
            <button
              v-if="isHost && room?.phase === 'ended'"
              @click="handleResetGame"
              class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm shadow-sm transition"
            >
              再来一局
            </button>
          </div>
        </div>

      </div>

      <!-- 右侧座位 (5-8) -->
      <div class="w-24 sm:w-32 flex flex-col justify-between py-2 h-full">
        <PlayerSeat
          v-for="pos in [5, 6, 7, 8]"
          :key="pos"
          :index="pos"
          :player="getPlayerByPosition(pos)"
          :isMe="getPlayerByPosition(pos)?.id === userStore.id"
          :isHost="getPlayerByPosition(pos)?.id === room?.hostId"
          :isCurrentDescriber="room?.currentDescriber === getPlayerByPosition(pos)?.id"
          :showDescription="room?.phase === 'voting' || room?.phase === 'result' || room?.phase === 'ended'"
          :bubblePosition="'left'"
          :phase="room?.phase"
          :isSelected="selectedVoteTarget === getPlayerByPosition(pos)?.id"
          :isMyVoteTarget="myVoteTargetId === getPlayerByPosition(pos)?.id"
          @click="handleSeatClick(pos)"
        />
      </div>
    </div>

    <!-- 底部信息栏 -->
    <div class="relative z-10 h-[100px] bg-slate-800/50 backdrop-blur-sm border-t border-slate-700/50 p-3">
      <div class="max-w-2xl mx-auto space-y-1.5 h-full overflow-y-auto custom-scrollbar">
        <!-- 系统消息 -->
        <div class="flex items-start gap-2 text-slate-400 text-xs">
          <span>></span>
          <span>{{ systemMessage }}</span>
        </div>
        
        <!-- 淘汰信息 -->
        <div v-if="lastEliminatedInfo" class="flex items-start gap-2 text-rose-400 text-xs">
          <span>!</span>
          <span>{{ lastEliminatedInfo }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io, Socket } from 'socket.io-client'
import { useUserStore } from '~/stores/user'
import PlayerSeat from '~/components/undercover/PlayerSeat.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const roomId = computed(() => route.params.id as string)

// 状态
const room = ref<any>(null)
const myPrivateData = ref<{ word: string; role: string } | null>(null)
const showWord = ref(false)
const myDescription = ref('')
const hasSubmittedDescription = ref(false)
const selectedVoteTarget = ref<string | null>(null)
const hasVoted = ref(false)
const myVoteTargetId = ref<string | null>(null)
const votedCount = ref(0)
const countdown = ref(0)
const countdownPercent = ref(100)
const lastVoteResult = ref<any>(null)
const systemMessage = ref('等待玩家加入...')
const lastEliminatedInfo = ref('')

const minDescLength = 10
const maxDescLength = 30

let socket: Socket | null = null
let countdownTimer: NodeJS.Timeout | null = null

// 计算属性
const isHost = computed(() => room.value?.hostId === userStore.id)
const isReady = computed(() => {
  const me = room.value?.players?.find((p: any) => p.id === userStore.id)
  return me?.isReady || false
})
const readyCount = computed(() => room.value?.players?.filter((p: any) => p.isReady).length || 0)
const canStart = computed(() => {
  const players = room.value?.players || []
  return players.length >= 3 && players.every((p: any) => p.isReady)
})
const alivePlayers = computed(() => room.value?.players?.filter((p: any) => p.isAlive) || [])
const isAlive = computed(() => {
  const me = room.value?.players?.find((p: any) => p.id === userStore.id)
  return me?.isAlive ?? true
})

const phaseText = computed(() => {
  const phase = room.value?.phase
  switch (phase) {
    case 'waiting': return '等待开始'
    case 'describing': return '描述阶段'
    case 'voting': return '投票阶段'
    case 'result': return '结果公布'
    case 'ended': return '游戏结束'
    default: return '加载中'
  }
})

const canSubmitDescription = computed(() => {
  return myDescription.value.length >= minDescLength && myDescription.value.length <= maxDescLength
})

// 获取座位玩家
function getPlayerByPosition(position: number) {
  return room.value?.players?.find((p: any) => p.position === position) || null
}

function getPlayerName(id: string) {
  return room.value?.players?.find((p: any) => p.id === id)?.name || '玩家'
}

// 点击座位
function handleSeatClick(position: number) {
  // 只有投票阶段且未投票时点击有效
  if (room.value?.phase !== 'voting' || hasVoted.value || !isAlive.value) return
  
  const target = getPlayerByPosition(position)
  if (!target || !target.isAlive || target.id === userStore.id) return
  
  selectedVoteTarget.value = target.id
}

// Socket 初始化
onMounted(() => {
  userStore.initialize()
  
  // 检查用户是否已设置昵称，没有则跳转到大厅设置
  if (!userStore.name) {
    router.push('/undercover')
    return
  }
  
  initSocket()
})

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
  if (socket) socket.disconnect()
})

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

    // 直接加入房间（如果已在房间则服务端会处理）
    socket?.emit('undercover:room:join', {
      roomId: roomId.value,
      userId: userStore.id,
      userName: userStore.name,
    })
  })

  // 房间事件
  socket.on('undercover:room:joined', handleRoomJoined)
  socket.on('undercover:room:rejoined', handleRoomJoined)
  socket.on('undercover:room:updated', handleRoomUpdated)
  socket.on('undercover:room:error', handleError)
  socket.on('undercover:room:left', () => router.push('/undercover'))
  socket.on('undercover:player:left', handlePlayerLeft)
  socket.on('undercover:player:ready', handlePlayerReady)

  // 游戏事件
  socket.on('undercover:game:started', handleGameStarted)
  socket.on('undercover:game:word_assigned', handleWordAssigned)
  socket.on('undercover:phase:describe', handleDescribePhase)
  socket.on('undercover:player:described', handlePlayerDescribed)
  socket.on('undercover:phase:vote', handleVotePhase)
  socket.on('undercover:vote:progress', handleVoteProgress)
  socket.on('undercover:vote:result', handleVoteResult)
  socket.on('undercover:phase:result', handleResultPhase)
  socket.on('undercover:game:ended', handleGameEnded)
  socket.on('undercover:game:reset', handleGameReset)
  socket.on('undercover:game:vote_submitted', () => {
    // 投票成功确认
    if (selectedVoteTarget.value) {
      myVoteTargetId.value = selectedVoteTarget.value
      selectedVoteTarget.value = null
      hasVoted.value = true
    }
  })
}

function handleRoomJoined(data: any) {
  room.value = data.room
  if (data.privateData) {
    myPrivateData.value = data.privateData
  }
  systemMessage.value = `欢迎 ${userStore.name} 加入房间`
}

function handleRoomUpdated(data: any) {
  if (data.id === roomId.value) {
    room.value = data
  }
}

function handleError(data: any) {
  alert(data.message)
  // 遇到无法进入房间的错误，跳转回大厅
  router.push('/undercover')
}

function handlePlayerLeft(data: any) {
  room.value = data.room
  const leftPlayer = room.value.players.find((p: any) => p.id === data.playerId)
  systemMessage.value = `${leftPlayer?.name || '玩家'}离开了房间`
}

function handlePlayerReady(data: any) {
  const player = room.value?.players?.find((p: any) => p.id === data.playerId)
  if (player) {
    player.isReady = data.isReady
  }
}

function handleGameStarted(data: any) {
  room.value = data.room
  hasSubmittedDescription.value = false
  hasVoted.value = false
  selectedVoteTarget.value = null
  lastVoteResult.value = null
  lastEliminatedInfo.value = ''
  systemMessage.value = '游戏开始！请查看你的词语'
  showWord.value = true
  
  // 3秒后自动隐藏词语
  setTimeout(() => {
    showWord.value = false
  }, 3000)
}

function handleWordAssigned(data: any) {
  myPrivateData.value = data
}

function handleDescribePhase(data: any) {
  room.value = data.room
  hasSubmittedDescription.value = false
  myDescription.value = ''
  systemMessage.value = '描述阶段开始！请描述你的词语'
  startCountdown(data.endTime)
}

function handlePlayerDescribed(data: any) {
  const player = room.value?.players?.find((p: any) => p.id === data.playerId)
  if (player) {
    player.status = 'voted'
  }
}

function handleVotePhase(data: any) {
  room.value = data.room
  hasVoted.value = false
  selectedVoteTarget.value = null
  myVoteTargetId.value = null
  votedCount.value = 0
  systemMessage.value = '投票阶段！点击玩家头像进行投票'
  startCountdown(data.endTime)

  // 更新玩家描述
  if (data.descriptions) {
    for (const [id, desc] of Object.entries(data.descriptions)) {
      const player = room.value.players.find((p: any) => p.id === id)
      if (player) player.description = desc
    }
  }
}

function handleVoteProgress(data: any) {
  votedCount.value = data.votedCount
}

function handleVoteResult(data: any) {
  room.value = data.room
  lastVoteResult.value = data
  stopCountdown()

  if (data.eliminated) {
    lastEliminatedInfo.value = `${data.eliminated.name}被淘汰，身份是${data.eliminated.role === 'undercover' ? '卧底' : '平民'}`
  } else if (data.isTie) {
    lastEliminatedInfo.value = '平票，无人淘汰'
  }
}

function handleResultPhase(data: any) {
  room.value = data.room
  systemMessage.value = '等待房主开始下一轮...'
}

function handleGameEnded(data: any) {
  room.value = data.room
  stopCountdown()

  // 更新所有玩家信息
  if (data.players) {
    for (const p of data.players) {
      const player = room.value.players.find((rp: any) => rp.id === p.id)
      if (player) {
        player.role = p.role
        player.word = p.word
      }
    }
  }

  const winnerText = data.winner === 'civilian' ? '平民获胜！' : (data.winner === 'undercover' ? '卧底获胜！' : '平局！')
  systemMessage.value = `游戏结束！${winnerText}`
}

function handleGameReset(data: any) {
  room.value = data.room
  myPrivateData.value = null
  showWord.value = false
  hasSubmittedDescription.value = false
  hasVoted.value = false
  selectedVoteTarget.value = null
  lastVoteResult.value = null
  lastEliminatedInfo.value = ''
  systemMessage.value = '游戏已重置，等待玩家准备'
  stopCountdown()
}

// 倒计时
function startCountdown(endTime: number) {
  stopCountdown()
  
  const totalDuration = endTime - Date.now()
  
  countdownTimer = setInterval(() => {
    const remaining = Math.max(0, endTime - Date.now())
    countdown.value = Math.ceil(remaining / 1000)
    countdownPercent.value = (remaining / totalDuration) * 100
    
    if (remaining <= 0) {
      stopCountdown()
    }
  }, 100)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
  countdownPercent.value = 100
}

// 操作处理
function handleLeave() {
  socket?.emit('undercover:room:leave', {
    roomId: roomId.value,
    userId: userStore.id,
  })
  router.push('/undercover')
}

function handleReady() {
  socket?.emit('undercover:player:ready', {
    roomId: roomId.value,
    userId: userStore.id,
    isReady: true,
  })
}

function handleCancelReady() {
  socket?.emit('undercover:player:ready', {
    roomId: roomId.value,
    userId: userStore.id,
    isReady: false,
  })
}

function handleStartGame() {
  socket?.emit('undercover:game:start', {
    roomId: roomId.value,
    userId: userStore.id,
  })
}

function submitDescription() {
  if (!canSubmitDescription.value) return

  socket?.emit('undercover:game:describe', {
    roomId: roomId.value,
    userId: userStore.id,
    description: myDescription.value.trim(),
  })
  hasSubmittedDescription.value = true
}

function submitVote() {
  if (!selectedVoteTarget.value) return

  socket?.emit('undercover:game:vote', {
    roomId: roomId.value,
    userId: userStore.id,
    targetId: selectedVoteTarget.value,
  })
  // hasVoted 改在 vote_submitted 回调中设置
}

function handleNextRound() {
  socket?.emit('undercover:game:next_round', {
    roomId: roomId.value,
    userId: userStore.id,
  })
}

function handleResetGame() {
  socket?.emit('undercover:game:reset', {
    roomId: roomId.value,
    userId: userStore.id,
  })
}
</script>

<style scoped>
.animate-spin-slow {
  animation: spin 20s linear infinite;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

@keyframes spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
