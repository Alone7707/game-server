<template>
  <div class="min-h-screen bg-slate-900 p-4 md:p-8">
    <!-- Header -->
    <header class="text-center mb-12">
      <h1 class="text-4xl md:text-5xl font-bold text-slate-200 mb-2">
        🎮 游戏大厅
      </h1>
      <p class="text-slate-400">选择你想玩的游戏</p>
    </header>
    
    <!-- Game list -->
    <div class="max-w-4xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 斗地主 -->
        <NuxtLink 
          to="/doudizhu" 
          class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 group"
        >
          <div class="text-5xl mb-4 group-hover:scale-110 transition-transform">🃏</div>
          <h2 class="text-xl font-bold text-amber-400 mb-2">斗地主</h2>
          <p class="text-slate-400 text-sm">经典三人扑克游戏，地主对战两位农民</p>
          <div class="mt-4 text-xs text-slate-500">
            <span class="inline-block bg-slate-700 px-2 py-1 rounded mr-2">3人</span>
            <span class="inline-block bg-slate-700 px-2 py-1 rounded">54张牌</span>
          </div>
        </NuxtLink>
        
        <!-- 谁是卧底 -->
        <NuxtLink 
          to="/undercover" 
          class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 group"
        >
          <div class="text-5xl mb-4 group-hover:scale-110 transition-transform">🕵️</div>
          <h2 class="text-xl font-bold text-blue-400 mb-2">谁是卧底</h2>
          <p class="text-slate-400 text-sm">经典语言推理游戏，找出隐藏的卧底</p>
          <div class="mt-4 text-xs text-slate-500">
            <span class="inline-block bg-slate-700 px-2 py-1 rounded mr-2">3-8人</span>
            <span class="inline-block bg-slate-700 px-2 py-1 rounded">词语对决</span>
          </div>
        </NuxtLink>
        
        <!-- 7鬼523 -->
        <NuxtLink 
          to="/qigui523" 
          class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 group"
        >
          <div class="text-5xl mb-4 group-hover:scale-110 transition-transform">🎴</div>
          <h2 class="text-xl font-bold text-emerald-400 mb-2">7鬼523</h2>
          <p class="text-slate-400 text-sm">经典扑克玩法，7最大、鬼次之、523紧随</p>
          <div class="mt-4 text-xs text-slate-500">
            <span class="inline-block bg-slate-700 px-2 py-1 rounded mr-2">2-6人</span>
            <span class="inline-block bg-slate-700 px-2 py-1 rounded">可配置规则</span>
          </div>
        </NuxtLink>
        
        <!-- 德州扑克 (即将上线) -->
        <div class="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 opacity-50 cursor-not-allowed">
          <div class="text-5xl mb-4">♠️</div>
          <h2 class="text-xl font-bold text-slate-500 mb-2">德州扑克</h2>
          <p class="text-slate-600 text-sm">敬请期待...</p>
          <div class="mt-4 text-xs text-slate-600">
            <span class="inline-block bg-slate-700/50 px-2 py-1 rounded">即将上线</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <footer class="text-center mt-16 text-slate-600 text-sm">
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
