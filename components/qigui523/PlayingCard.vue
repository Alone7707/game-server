<template>
  <div 
    class="relative rounded-lg shadow-md transition-all select-none"
    :class="[
      sizeClass,
      selected ? 'ring-2 ring-emerald-400 shadow-emerald-500/30' : '',
      isJoker ? 'bg-gradient-to-br from-purple-900 to-purple-700' : 'bg-white'
    ]"
  >
    <!-- 牌面内容 -->
    <div class="absolute inset-0 flex flex-col items-center justify-center p-1">
      <!-- 花色和点数 -->
      <div 
        :class="[rankTextSize, suitColor, 'font-bold']"
      >
        {{ displayRank }}
      </div>
      <div 
        :class="[suitTextSize, suitColor]"
      >
        {{ suitSymbol }}
      </div>
    </div>

    <!-- 角标 -->
    <div :class="['absolute top-0.5 left-1 font-bold', cornerTextSize, suitColor]">
      {{ displayRank }}
    </div>
    <div :class="['absolute bottom-0.5 right-1 font-bold rotate-180', cornerTextSize, suitColor]">
      {{ displayRank }}
    </div>

    <!-- 特殊牌标记 (7, 鬼, 5, 2, 3) -->
    <div 
      v-if="isSpecialCard" 
      :class="['absolute -top-1 -right-1 rounded-full flex items-center justify-center font-bold', badgeSize, specialCardBadge]"
    >
      {{ specialRank }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Card {
  id: string
  suit: string
  rank: string
  value: number
}

const props = defineProps<{
  card: Card
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
}>()

// 尺寸相关的样式
const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-10 h-14'
    case 'lg': return 'w-16 h-24'
    default: return 'w-14 h-20'
  }
})

const rankTextSize = computed(() => {
  switch (props.size) {
    case 'sm': return 'text-[10px]'
    case 'lg': return 'text-sm'
    default: return 'text-xs'
  }
})

const suitTextSize = computed(() => {
  switch (props.size) {
    case 'sm': return 'text-lg'
    case 'lg': return 'text-3xl'
    default: return 'text-2xl'
  }
})

const cornerTextSize = computed(() => {
  switch (props.size) {
    case 'sm': return 'text-[8px]'
    case 'lg': return 'text-xs'
    default: return 'text-[10px]'
  }
})

const badgeSize = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-3 h-3 text-[6px]'
    case 'lg': return 'w-5 h-5 text-[10px]'
    default: return 'w-4 h-4 text-[8px]'
  }
})

const isJoker = computed(() => props.card.suit === 'joker')

const suitSymbol = computed(() => {
  const symbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
    joker: props.card.rank === 'joker_big' ? '🃏' : '🎴',
  }
  return symbols[props.card.suit] || ''
})

const suitColor = computed(() => {
  if (props.card.suit === 'hearts' || props.card.suit === 'diamonds') {
    return 'text-red-500'
  }
  if (props.card.suit === 'joker') {
    return props.card.rank === 'joker_big' ? 'text-red-400' : 'text-gray-300'
  }
  return 'text-slate-800'
})

const displayRank = computed(() => {
  if (props.card.rank === 'joker_big') return '大'
  if (props.card.rank === 'joker_small') return '小'
  return props.card.rank
})

// 特殊牌：7, 大小王, 5, 2, 3
const isSpecialCard = computed(() => {
  const specialRanks = ['7', '5', '2', '3', 'joker_big', 'joker_small']
  return specialRanks.includes(props.card.rank)
})

const specialRank = computed(() => {
  if (props.card.rank === '7') return '1'
  if (props.card.rank === 'joker_big' || props.card.rank === 'joker_small') return '2'
  if (props.card.rank === '5') return '3'
  if (props.card.rank === '2') return '4'
  if (props.card.rank === '3') return '5'
  return ''
})

const specialCardBadge = computed(() => {
  if (props.card.rank === '7') return 'bg-amber-500 text-white'
  if (props.card.rank === 'joker_big' || props.card.rank === 'joker_small') return 'bg-purple-500 text-white'
  if (props.card.rank === '5') return 'bg-emerald-500 text-white'
  if (props.card.rank === '2') return 'bg-blue-500 text-white'
  if (props.card.rank === '3') return 'bg-rose-500 text-white'
  return ''
})
</script>
