<template>
  <div class="flex flex-col items-center w-48">
    <!-- 玩家信息和手牌 -->
    <div class="flex flex-col items-center">
      <!-- 玩家名称 -->
      <div 
        class="flex items-center gap-1 px-3 py-0.5 rounded-full text-sm"
        :class="isCurrentTurn ? 'bg-casino-gold text-casino-dark animate-pulse-gold' : 'bg-casino-brown'"
      >
        <span>{{ name }}</span>
        <span v-if="isLandlord" class="text-yellow-400">👑</span>
        <span class="text-xs opacity-75">({{ cardCount }}张)</span>
      </div>
      
      <!-- 手牌背面 -->
      <div class="flex justify-center mt-1">
        <div 
          v-for="i in Math.min(cardCount, 8)" 
          :key="i"
          class="w-6 h-9 bg-gradient-to-br from-casino-red to-casino-red-dark rounded shadow-sm border border-casino-gold-dark/50"
          :style="{ marginLeft: i > 1 ? '-12px' : '0' }"
        />
      </div>
    </div>
    
    <!-- 出牌区域 - 已移动到主界面中央 -->
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~/types'

defineProps<{
  name: string
  avatar?: string
  cardCount: number
  isLandlord?: boolean
  isCurrentTurn?: boolean
}>()
</script>
