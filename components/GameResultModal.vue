<template>
  <Modal :show="show" title="游戏结束" :closable="false">
    <div class="text-center py-4">
      <!-- Winner announcement -->
      <div class="text-4xl mb-4">
        {{ isWinner ? '🎉' : '😢' }}
      </div>
      
      <h2 class="text-2xl font-bold mb-2" :class="isWinner ? 'text-casino-gold' : 'text-gray-400'">
        {{ isWinner ? '恭喜获胜！' : '很遗憾，您输了' }}
      </h2>
      
      <p class="text-gray-300 mb-6">
        {{ winnerName }} {{ isLandlordWin ? '(地主)' : '(农民)' }} 获胜
      </p>
      
      <!-- Scores -->
      <div class="bg-casino-dark rounded-lg p-4 mb-6">
        <h3 class="text-casino-gold font-bold mb-3">本局得分</h3>
        <div class="space-y-2">
          <div 
            v-for="(score, playerId) in scores" 
            :key="playerId"
            class="flex justify-between items-center"
          >
            <span>{{ getPlayerName(playerId as string) }}</span>
            <span 
              class="font-bold"
              :class="score > 0 ? 'text-green-400' : 'text-red-400'"
            >
              {{ score > 0 ? '+' : '' }}{{ score }}
            </span>
          </div>
        </div>
      </div>
      
      <button class="btn-primary w-full" @click="$emit('continue')">
        继续游戏
      </button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import type { Player } from '~/types'

const props = defineProps<{
  show: boolean
  winnerName: string
  isLandlordWin: boolean
  scores: Record<string, number>
  players: Player[]
  myId: string
}>()

defineEmits<{
  (e: 'continue'): void
}>()

const isWinner = computed(() => {
  const myScore = props.scores[props.myId]
  return myScore > 0
})

function getPlayerName(playerId: string): string {
  const player = props.players.find(p => p.id === playerId)
  return player?.name || '未知玩家'
}
</script>
