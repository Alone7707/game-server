<template>
  <div class="min-h-screen flex flex-col">
    <!-- Top bar -->
    <header class="bg-casino-brown border-b border-casino-gold-dark px-4 py-3">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button class="text-casino-gold hover:text-yellow-400" @click="handleLeaveRoom">
            ← 离开房间
          </button>
          <span class="text-gray-400">|</span>
          <span class="text-casino-gold font-mono">房间: {{ roomId }}</span>
        </div>
        
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-400">底分: <span class="text-casino-gold font-bold">{{ currentRoom?.baseScore || 1 }}</span></span>
          <span class="text-sm text-gray-400">倍数: <span class="text-casino-gold font-bold">{{ gameStore.multiplier }}x</span></span>
        </div>
      </div>
    </header>
    
    <!-- Game area -->
    <main class="flex-1 bg-felt-gradient p-4">
      <div class="max-w-6xl mx-auto h-full">
        <!-- Waiting state -->
        <div v-if="gameStore.phase === 'waiting'" class="h-full flex flex-col items-center justify-center">
          <div class="card-container p-8 text-center max-w-lg">
            <h2 class="text-2xl font-bold text-casino-gold mb-6">等待玩家加入</h2>
            
            <!-- Player slots -->
            <div class="grid grid-cols-3 gap-4 mb-8">
              <div 
                v-for="i in 3" 
                :key="i"
                class="bg-casino-dark rounded-lg p-4"
              >
                <template v-if="players[i - 1]">
                  <div class="text-3xl mb-2">🎮</div>
                  <div class="text-casino-gold font-medium">{{ players[i - 1].name }}</div>
                  <div 
                    class="text-sm mt-1"
                    :class="players[i - 1].isReady ? 'text-green-400' : 'text-gray-500'"
                  >
                    {{ players[i - 1].isReady ? '已准备' : '未准备' }}
                  </div>
                  <div v-if="players[i - 1].id === currentRoom?.hostId" class="text-yellow-400 text-xs mt-1">
                    👑 房主
                  </div>
                </template>
                <template v-else>
                  <div class="text-3xl mb-2 opacity-30">👤</div>
                  <div class="text-gray-500">等待加入</div>
                </template>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex flex-col gap-3">
              <button
                v-if="!isReady && !isHost"
                class="btn-success w-full"
                @click="handleReady"
              >
                ✓ 准备
              </button>
              <button
                v-if="isReady && !isHost"
                class="btn-secondary w-full"
                @click="handleCancelReady"
              >
                取消准备
              </button>
              <button
                v-if="isHost"
                class="btn-primary w-full"
                :disabled="!canStart"
                @click="handleStartGame"
              >
                {{ canStart ? '开始游戏' : `等待玩家准备 (${readyCount}/3)` }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Game playing state - 使用固定布局 -->
        <div v-else class="relative h-full w-full overflow-hidden" style="min-height: calc(100vh - 120px);">
          
          <!-- 左上角玩家 -->
          <div v-if="opponents[0]" class="absolute top-4 left-4 z-10">
            <OpponentCards
              :name="opponents[0].name"
              :card-count="getOpponentCardCount(opponents[0].id)"
              :is-landlord="gameStore.landlordId === opponents[0].id"
              :is-current-turn="gameStore.currentTurn === opponents[0].id"
            />
          </div>

          <!-- 右上角玩家 -->
          <div v-if="opponents[1]" class="absolute top-4 right-4 z-10">
            <OpponentCards
              :name="opponents[1].name"
              :card-count="getOpponentCardCount(opponents[1].id)"
              :is-landlord="gameStore.landlordId === opponents[1].id"
              :is-current-turn="gameStore.currentTurn === opponents[1].id"
            />
          </div>
          
          <!-- 中央区域 -->
          <div class="absolute inset-0 pointer-events-none">
            <!-- 地主牌 - 固定在顶部中间 -->
            <div v-if="gameStore.landlordCards.length > 0" class="absolute top-16 left-1/2 transform -translate-x-1/2 pointer-events-auto z-20">
              <div class="text-center text-xs text-gray-400 mb-1">地主牌</div>
              <div class="flex justify-center gap-1 p-2 bg-black/40 rounded-lg border border-casino-gold/30 backdrop-blur-sm">
                <div 
                  v-for="card in gameStore.landlordCards" 
                  :key="card.id"
                  class="transform scale-75 origin-top"
                >
                  <PlayingCard :card="card" :is-read-only="true" />
                </div>
              </div>
            </div>
            
            <!-- 叫分状态 -->
            <div v-if="gameStore.phase === 'bidding'" class="absolute inset-0 flex items-center justify-center pointer-events-auto z-30">
              <div class="text-center bg-black/60 p-6 rounded-xl backdrop-blur-sm border border-casino-gold/50 shadow-2xl">
                <div class="text-3xl text-casino-gold mb-6 font-bold drop-shadow-md">
                  {{ gameStore.isMyTurn ? '请叫分' : `等待 ${getCurrentBidderName()} 叫分...` }}
                </div>
                
                <div v-if="gameStore.isMyTurn" class="flex gap-4 justify-center">
                  <button 
                    class="btn-secondary px-8 py-2 shadow-lg hover:-translate-y-0.5 transition-transform"
                    @click="handlePassBid"
                  >
                    不叫
                  </button>
                  <button 
                    v-for="score in availableBids"
                    :key="score"
                    class="btn-primary px-8 py-2 shadow-lg hover:-translate-y-0.5 transition-transform"
                    @click="handleBid(score)"
                  >
                    {{ score }} 分
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 出牌展示区域 -->
            <div v-if="gameStore.phase === 'playing'" class="absolute inset-0 pointer-events-auto">
              <!-- 左侧玩家出牌 (上家) -->
              <div v-if="getOpponentLastPlayed(opponents[0]?.id)" class="absolute top-1/3 left-32 transform -translate-y-1/2">
                <div class="flex items-center gap-4">
                  <div class="flex">
                    <div 
                      v-for="(card, index) in getSortedPlayedCards(getOpponentLastPlayed(opponents[0]?.id)!)" 
                      :key="card.id"
                      :style="{ marginLeft: index > 0 ? '-30px' : '0', zIndex: index }"
                      class="transform scale-90"
                    >
                      <PlayingCard :card="card" :is-read-only="true" />
                    </div>
                  </div>
                  <div v-if="getOpponentPassed(opponents[0]?.id)" class="text-gray-400 font-bold bg-black/50 px-3 py-1 rounded">
                    不出
                  </div>
                </div>
              </div>
              <div v-else-if="getOpponentPassed(opponents[0]?.id)" class="absolute top-1/3 left-32 transform -translate-y-1/2 text-gray-400 font-bold text-xl bg-black/50 px-4 py-2 rounded">
                不出
              </div>

              <!-- 右侧玩家出牌 (下家) -->
              <div v-if="getOpponentLastPlayed(opponents[1]?.id)" class="absolute top-1/3 right-32 transform -translate-y-1/2">
                <div class="flex items-center gap-4 flex-row-reverse">
                  <div class="flex">
                    <div 
                      v-for="(card, index) in getSortedPlayedCards(getOpponentLastPlayed(opponents[1]?.id)!)" 
                      :key="card.id"
                      :style="{ marginLeft: index > 0 ? '-30px' : '0', zIndex: index }"
                      class="transform scale-90"
                    >
                      <PlayingCard :card="card" :is-read-only="true" />
                    </div>
                  </div>
                  <div v-if="getOpponentPassed(opponents[1]?.id)" class="text-gray-400 font-bold bg-black/50 px-3 py-1 rounded">
                    不出
                  </div>
                </div>
              </div>
              <div v-else-if="getOpponentPassed(opponents[1]?.id)" class="absolute top-1/3 right-32 transform -translate-y-1/2 text-gray-400 font-bold text-xl bg-black/50 px-4 py-2 rounded">
                不出
              </div>

              <!-- 我的出牌 -->
              <div v-if="gameStore.lastPlayedCards.length > 0 && gameStore.lastPlayerId === userStore.id" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-12">
                <div class="flex justify-center">
                  <div 
                    v-for="(card, index) in getSortedPlayedCards(gameStore.lastPlayedCards)" 
                    :key="card.id"
                    :style="{ marginLeft: index > 0 ? '-30px' : '0', zIndex: index }"
                    class="transform hover:scale-105 transition-transform"
                  >
                    <PlayingCard :card="card" :is-read-only="true" />
                  </div>
                </div>
              </div>
              
              <!-- 轮次提示 -->
              <div class="absolute top-[58%] left-1/2 transform -translate-x-1/2 mt-4 text-center z-30">
                <div v-if="gameStore.isMyTurn" class="text-2xl text-green-400 font-bold animate-pulse drop-shadow-md bg-black/30 px-6 py-2 rounded-full border border-green-500/30 backdrop-blur-sm">
                  轮到你了
                </div>
                <div v-else class="text-xl text-casino-gold drop-shadow-md bg-black/30 px-6 py-2 rounded-full border border-casino-gold/30 backdrop-blur-sm">
                  等待 {{ getCurrentPlayerName() }} 出牌...
                </div>
              </div>
            </div>
          </div>
          
          <!-- 底部操作区域 -->
          <div class="absolute bottom-0 left-0 right-0 pb-4 pt-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20">
            <!-- 操作按钮栏 -->
            <div v-if="gameStore.phase === 'playing' && gameStore.isMyTurn" class="flex justify-center gap-4 mb-4">
              <button 
                v-if="gameStore.canPass"
                class="btn-secondary px-8 py-2 shadow-lg hover:-translate-y-1 transition-transform"
                @click="handlePass"
              >
                不出
              </button>
              <button
                class="btn-primary px-8 py-2 shadow-lg hover:-translate-y-1 transition-transform disabled:opacity-50 disabled:hover:translate-y-0"
                :disabled="!canPlay"
                @click="handlePlay"
              >
                出牌
              </button>
              <button
                class="bg-gray-600 text-white px-6 py-2 rounded shadow-lg hover:bg-gray-500 hover:-translate-y-1 transition-transform"
                @click="gameStore.clearSelection()"
              >
                重选
              </button>
            </div>

            <!-- 玩家信息栏 -->
            <div class="flex items-center justify-center gap-4 mb-2 text-shadow">
              <div class="flex items-center gap-2 bg-black/30 px-4 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                <span class="text-2xl">{{ userStore.avatar }}</span>
                <span class="text-casino-gold font-bold text-lg">{{ userStore.name }}</span>
                <span v-if="gameStore.landlordId === userStore.id" class="text-yellow-400 font-bold px-2 py-0.5 bg-yellow-900/50 rounded">👑 地主</span>
                <span v-else-if="gameStore.landlordId" class="text-gray-400 px-2 py-0.5 bg-gray-800/50 rounded">农民</span>
              </div>
              
              <!-- 牌型提示 -->
              <div v-if="gameStore.selectedCards.length > 0" class="px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm">
                <span v-if="gameStore.isValidSelection" class="text-green-400 font-bold">
                  {{ getPatternName(gameStore.selectedPattern?.pattern) }}
                </span>
                <span v-else class="text-red-400 font-bold">
                  无效牌型
                </span>
              </div>
            </div>
            
            <!-- 手牌区域 -->
            <div class="px-4">
              <CardHand
                :cards="gameStore.sortedCards"
                :selected-cards="gameStore.selectedCards"
                :disabled="!gameStore.isMyTurn || gameStore.phase !== 'playing'"
                :animate="gameStore.phase === 'dealing'"
                @select="handleCardSelect"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
    
    <!-- Game result modal -->
    <GameResultModal
      :show="gameStore.phase === 'finished'"
      :winner-name="gameStore.winner || ''"
      :is-landlord-win="gameStore.winner === getLandlordName()"
      :scores="gameStore.scores"
      :players="players"
      :my-id="userStore.id"
      @continue="handleContinue"
    />
  </div>
</template>

<script setup lang="ts">
import type { Card, Player, CardPattern } from '~/types'
import { useUserStore } from '~/stores/user'
import { useRoomStore } from '~/stores/room'
import { useGameStore } from '~/stores/game'
import { useSocket } from '~/composables/useSocket'
import { analyzePattern, canBeat, sortCards } from '~/utils/cards'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const socket = useSocket()

const roomId = computed(() => route.params.id as string)

// Computed properties
const currentRoom = computed(() => roomStore.currentRoom)
const players = computed(() => currentRoom.value?.players || [])
const myPlayer = computed(() => players.value.find(p => p.id === userStore.id))
const opponents = computed(() => players.value.filter(p => p.id !== userStore.id))
const isHost = computed(() => currentRoom.value?.hostId === userStore.id)
const isReady = computed(() => myPlayer.value?.isReady || false)
// 房主默认视为已准备，只计算其他玩家的准备数
const readyCount = computed(() => {
  return players.value.filter(p => p.isReady || p.id === currentRoom.value?.hostId).length
})
// 开始条件：3个玩家，且除房主外都准备好
const canStart = computed(() => {
  if (players.value.length !== 3) return false
  // 检查非房主玩家是否都准备好了
  const nonHostPlayers = players.value.filter(p => p.id !== currentRoom.value?.hostId)
  return nonHostPlayers.every(p => p.isReady)
})

const availableBids = computed(() => {
  const current = gameStore.currentBid || 0
  return [1, 2, 3].filter(b => b > current)
})

const canPlay = computed(() => {
  if (!gameStore.isValidSelection) return false
  
  // If no last played cards or I played last, I can play any valid combination
  if (gameStore.lastPlayedCards.length === 0 || gameStore.lastPlayerId === userStore.id) {
    return true
  }
  
  // Must beat last played cards
  return canBeat(gameStore.selectedCards, gameStore.lastPlayedCards)
})

// 监听房间错误，如果房间不存在则返回斗地主大厅
watch(() => roomStore.error, (error) => {
  if (error && (error.includes('不存在') || error.includes('不在此房间'))) {
    roomStore.clearError()
    router.push('/doudizhu')
  }
})

// Initialize on mount
onMounted(() => {
  if (!userStore.name) {
    router.push('/doudizhu')
    return
  }
  
  socket.connect()
  
  // 刷新页面后尝试重新加入房间
  if (!roomStore.currentRoom || roomStore.currentRoom.id !== roomId.value) {
    // 检查是否之前在这个房间中（刷新页面的情况）
    if (userStore.roomId === roomId.value) {
      // 使用 rejoin 恢复游戏状态
      socket.rejoinRoom(roomId.value)
    } else {
      // 首次加入房间
      socket.joinRoom(roomId.value)
    }
  }
})

// Leave room handler
function handleLeaveRoom() {
  socket.leaveRoom(roomId.value)
  router.push('/doudizhu')
}

// Ready handlers
function handleReady() {
  socket.setReady(roomId.value, true)
}

function handleCancelReady() {
  socket.setReady(roomId.value, false)
}

// Start game
function handleStartGame() {
  socket.startGame(roomId.value)
}

// Bidding handlers
function handleBid(amount: number) {
  socket.bid(roomId.value, amount)
}

function handlePassBid() {
  socket.passBid(roomId.value)
}

// Card selection
function handleCardSelect(card: Card) {
  gameStore.toggleCardSelection(card)
}

// Play cards
function handlePlay() {
  if (canPlay.value) {
    socket.playCards(roomId.value, gameStore.selectedCards)
    gameStore.removeCards(gameStore.selectedCards)
  }
}

// Pass
function handlePass() {
  socket.passPlay(roomId.value)
}

// Continue after game ends
function handleContinue() {
  gameStore.reset()
  // The server should reset the room state
}

// Helper functions
function getCurrentBidderName(): string {
  const bidder = players.value.find(p => p.id === gameStore.biddingPlayerId)
  return bidder?.name || '其他玩家'
}

function getCurrentPlayerName(): string {
  const player = players.value.find(p => p.id === gameStore.currentTurn)
  return player?.name || '其他玩家'
}

function getLandlordName(): string {
  const landlord = players.value.find(p => p.id === gameStore.landlordId)
  return landlord?.name || ''
}

function getOpponentCardCount(playerId: string): number {
  // 使用 gameStore 中跟踪的对手牌数
  return gameStore.opponentCardCounts[playerId] ?? 17
}

function getOpponentLastPlayed(playerId: string): Card[] | undefined {
  if (gameStore.lastPlayerId === playerId) {
    return gameStore.lastPlayedCards
  }
  return undefined
}

function getOpponentPassed(playerId: string): boolean {
  const history = gameStore.playHistory
  if (history.length === 0) return false
  const lastEntry = history[history.length - 1]
  return lastEntry.playerId === playerId && lastEntry.passed
}

function getSortedPlayedCards(cards: Card[]): Card[] {
  return sortCards(cards).reverse()
}

function getPatternName(pattern: CardPattern | undefined | null): string {
  if (!pattern) return ''
  const names: Record<CardPattern, string> = {
    'single': '单张',
    'pair': '对子',
    'triple': '三张',
    'triple_single': '三带一',
    'triple_pair': '三带二',
    'straight': '顺子',
    'straight_pairs': '连对',
    'plane': '飞机',
    'plane_single': '飞机带单',
    'plane_pair': '飞机带对',
    'four_two': '四带二',
    'bomb': '炸弹💣',
    'rocket': '王炸🚀',
    'invalid': '无效',
  }
  return names[pattern] || pattern
}

// Watch for room leave
watch(() => userStore.roomId, (newRoomId) => {
  if (!newRoomId) {
    router.push('/doudizhu')
  }
})
</script>
