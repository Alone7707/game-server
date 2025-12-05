<template>
  <div 
    class="relative w-20 h-24 sm:w-24 sm:h-28 bg-slate-800/50 border border-slate-700/50 rounded-xl flex flex-col items-center justify-center transition-all duration-300 flex-shrink-0"
    :class="[
      isCurrentDescriber ? 'ring-1 ring-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : '',
      hasVoted ? 'ring-1 ring-emerald-500/50' : '',
      isSelected ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] scale-105' : '',
      isMyVoteTarget ? 'ring-2 ring-rose-500/70 bg-rose-900/20' : ''
    ]"
  >
    <!-- 座位号 -->
    <div class="absolute -top-2 -left-2 w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-300 border border-slate-600 z-10 shadow-sm">
      {{ index }}
    </div>

    <!-- 选中/已投标记 -->
    <div v-if="isSelected || isMyVoteTarget" class="absolute -top-3 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md z-20 whitespace-nowrap border border-rose-400">
      {{ isSelected ? '当前选择' : '你的投票' }}
    </div>

    <!-- 房主标识 -->
    <div v-if="isHost" class="absolute -top-2 -right-2 bg-amber-900/80 text-[10px] px-1.5 py-0.5 rounded-full text-amber-200 border border-amber-700/50 z-10">
      房主
    </div>

    <!-- 玩家内容 -->
    <template v-if="player">
      <!-- 头像 -->
      <div 
        class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl mb-1 border-2 relative overflow-hidden transition-colors"
        :class="[
          !player.isAlive ? 'border-slate-600 bg-slate-800 grayscale opacity-50' : 
          hasVoted ? 'border-emerald-500/70 bg-slate-700' : 'border-slate-600 bg-slate-700'
        ]"
      >
        <span v-if="!player.isAlive" class="text-lg absolute inset-0 flex items-center justify-center bg-black/60 text-rose-500 font-bold">✕</span>
        <span v-else-if="player.role === 'undercover' && showRole">🕵️</span>
        <span v-else>{{ player.name?.charAt(0) || '?' }}</span>
        
        <!-- 已投票遮罩 (仅在投票阶段显示) -->
        <div v-if="hasVoted && phase === 'voting'" class="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
          <span class="text-white font-bold text-xs drop-shadow-md">已投</span>
        </div>
      </div>

      <!-- 名字 -->
      <div class="w-full text-center px-1">
        <p class="text-slate-300 text-[10px] sm:text-xs font-medium truncate">{{ player.name }}</p>
        <!-- 状态/身份标签 -->
        <p v-if="showRole" class="text-[9px] text-slate-500 scale-90">
          {{ player.role === 'undercover' ? '卧底' : '平民' }}
        </p>
        <p v-else-if="player.isReady && phase === 'waiting'" class="text-[9px] text-emerald-500 scale-90">
          已准备
        </p>
        <p v-else-if="player.status === 'describing'" class="text-[9px] text-amber-500 scale-90 animate-pulse">
          发言中
        </p>
        <p v-else-if="player.status === 'voted'" class="text-[9px] text-emerald-500 scale-90">
          已完成
        </p>
      </div>
    </template>

    <!-- 空座位 -->
    <div 
      v-else
      class="flex flex-col items-center justify-center text-slate-600"
    >
      <div class="w-10 h-10 rounded-full border border-dashed border-slate-700 flex items-center justify-center mb-1 bg-slate-800/30">
        <span class="text-lg">+</span>
      </div>
      <span class="text-[10px]">空位</span>
    </div>

    <!-- 描述气泡 (悬浮在卡片旁) -->
    <div 
      v-if="bubbleContent"
      class="absolute top-0 z-20 min-w-[100px] max-w-[140px] p-2 bg-slate-200 text-slate-900 text-xs rounded-lg shadow-lg break-words text-center pointer-events-none"
      :class="[
        bubblePosition === 'left' ? 'right-full mr-2' : 'left-full ml-2'
      ]"
    >
      <!-- 箭头 -->
      <div 
        class="absolute top-3 w-0 h-0 border-[5px]"
        :class="[
          bubblePosition === 'left' 
            ? '-right-[10px] border-l-slate-200 border-t-transparent border-b-transparent border-r-transparent' 
            : '-left-[10px] border-r-slate-200 border-t-transparent border-b-transparent border-l-transparent'
        ]"
      ></div>
      
      <span v-if="isTyping" class="text-slate-500">
        ...
      </span>
      <span v-else-if="hasConfirmed && !showDescription" class="text-emerald-600 font-bold">
        ✓
      </span>
      <span v-else>{{ bubbleContent }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Player {
  id: string
  name: string
  role: string
  status: string
  isReady: boolean
  isAlive: boolean
  description: string
  position: number
  hasVoted?: boolean
}

const props = defineProps<{
  index: number // 1-8
  player: Player | null
  isMe: boolean
  isHost: boolean
  isCurrentDescriber: boolean
  showDescription: boolean
  bubblePosition: 'left' | 'right'
  phase?: string
  isSelected?: boolean
  isMyVoteTarget?: boolean
}>()

// 是否显示角色
const showRole = computed(() => {
  return props.phase === 'ended' || (props.player && !props.player.isAlive)
})

const hasVoted = computed(() => {
  return props.player?.status === 'voted'
})

// 是否正在输入
const isTyping = computed(() => {
  return props.phase === 'describing' && 
         props.player?.isAlive && 
         props.player?.status !== 'voted' &&
         !props.showDescription
})

// 是否已确认
const hasConfirmed = computed(() => {
  return props.player?.status === 'voted'
})

// 气泡内容
const bubbleContent = computed(() => {
  if (!props.player || !props.player.isAlive) return ''
  
  if (props.phase === 'describing') {
    if (isTyping.value) return '...'
    if (hasConfirmed.value) return '✓'
  }
  
  if (props.showDescription && props.player.description) {
    return props.player.description
  }
  
  return ''
})
</script>
