<template>
  <div class="min-h-screen p-4 md:p-8">
    <!-- Header -->
    <header class="text-center mb-12">
      <h1 class="text-4xl md:text-5xl font-bold text-casino-gold mb-2">
        � 游戏大厅
      </h1>
      <p class="text-gray-400">选择你想玩的游戏</p>
    </header>
    
    <!-- Game list -->
    <div class="max-w-4xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 斗地主 -->
        <NuxtLink 
          to="/doudizhu" 
          class="card-container p-6 hover:border-casino-gold transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
        >
          <div class="text-6xl mb-4 group-hover:scale-110 transition-transform">🃏</div>
          <h2 class="text-2xl font-bold text-casino-gold mb-2">斗地主</h2>
          <p class="text-gray-400 text-sm">经典三人扑克游戏，地主对战两位农民</p>
          <div class="mt-4 text-xs text-gray-500">
            <span class="inline-block bg-casino-dark px-2 py-1 rounded mr-2">3人</span>
            <span class="inline-block bg-casino-dark px-2 py-1 rounded">54张牌</span>
          </div>
        </NuxtLink>
        
        <!-- 谁是卧底 -->
        <NuxtLink 
          to="/undercover" 
          class="card-container p-6 hover:border-purple-500 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
        >
          <div class="text-6xl mb-4 group-hover:scale-110 transition-transform">🕵️</div>
          <h2 class="text-2xl font-bold text-purple-400 mb-2">谁是卧底</h2>
          <p class="text-gray-400 text-sm">经典语言推理游戏，找出隐藏的卧底</p>
          <div class="mt-4 text-xs text-gray-500">
            <span class="inline-block bg-casino-dark px-2 py-1 rounded mr-2">3-8人</span>
            <span class="inline-block bg-casino-dark px-2 py-1 rounded">词语对决</span>
          </div>
        </NuxtLink>
        
        <div class="card-container p-6 opacity-50 cursor-not-allowed">
          <div class="text-6xl mb-4">♠️</div>
          <h2 class="text-2xl font-bold text-gray-500 mb-2">德州扑克</h2>
          <p class="text-gray-500 text-sm">敬请期待...</p>
          <div class="mt-4 text-xs text-gray-600">
            <span class="inline-block bg-casino-dark px-2 py-1 rounded">即将上线</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <footer class="text-center mt-16 text-gray-500 text-sm">
      <p>© {{ year }} Game Server - 在线棋牌游戏平台</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()

const year = ref(new Date().getFullYear())

onMounted(() => {
  userStore.initialize()
})
</script>
