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

        <!-- 地图选择 -->
        <div class="bg-slate-700/30 rounded-xl p-4 mb-6">
          <h3 class="text-slate-400 text-sm mb-3">🗺️ 选择地图 <span v-if="!isHost" class="text-slate-500">(房主选择)</span></h3>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <button
              v-for="map in mapList"
              :key="map.id"
              @click="selectMap(map.id)"
              :disabled="!isHost"
              :class="[
                'p-3 rounded-lg border-2 transition text-center',
                room?.selectedMapId === map.id
                  ? 'border-orange-500 bg-orange-500/20'
                  : isHost
                    ? 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
                    : 'border-slate-600 bg-slate-800/50 cursor-not-allowed opacity-60'
              ]"
            >
              <div class="text-2xl mb-1">{{ map.icon }}</div>
              <div class="text-xs text-slate-300">{{ map.name }}</div>
              <div class="text-xs text-slate-500">{{ map.maxPlayers }}人</div>
            </button>
          </div>
        </div>

        <!-- 队伍选择（踢弹大战模式） -->
        <div v-if="isKickBattleMap" class="bg-slate-700/30 rounded-xl p-4 mb-6">
          <h3 class="text-slate-400 text-sm mb-3">⚔️ 选择队伍</h3>
          <div class="flex justify-center gap-6">
            <!-- A队 -->
            <div class="flex-1 max-w-xs">
              <button
                @click="selectTeam('A')"
                :class="[
                  'w-full p-4 rounded-xl border-2 transition mb-3',
                  myPlayer?.team === 'A'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-slate-600 hover:border-blue-400 bg-slate-800/50'
                ]"
              >
                <div class="text-blue-400 font-bold text-lg mb-1">A队</div>
                <div class="text-xs text-slate-400">{{ teamACount }}/3</div>
              </button>
              <div class="space-y-1">
                <div
                  v-for="player in waitingTeamAPlayers"
                  :key="player.id"
                  class="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-900/30"
                >
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                    :style="{ backgroundColor: player.color }"
                  >😎</div>
                  <span class="text-sm text-white">{{ player.name }}</span>
                </div>
              </div>
            </div>
            
            <div class="text-slate-500 font-bold self-center">VS</div>
            
            <!-- B队 -->
            <div class="flex-1 max-w-xs">
              <button
                @click="selectTeam('B')"
                :class="[
                  'w-full p-4 rounded-xl border-2 transition mb-3',
                  myPlayer?.team === 'B'
                    ? 'border-red-500 bg-red-500/20'
                    : 'border-slate-600 hover:border-red-400 bg-slate-800/50'
                ]"
              >
                <div class="text-red-400 font-bold text-lg mb-1">B队</div>
                <div class="text-xs text-slate-400">{{ teamBCount }}/3</div>
              </button>
              <div class="space-y-1">
                <div
                  v-for="player in waitingTeamBPlayers"
                  :key="player.id"
                  class="flex items-center gap-2 px-3 py-1.5 rounded bg-red-900/30"
                >
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                    :style="{ backgroundColor: player.color }"
                  >😎</div>
                  <span class="text-sm text-white">{{ player.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 游戏设置 -->
        <div class="bg-slate-700/30 rounded-xl p-4 mb-6">
          <h3 class="text-slate-400 text-sm mb-2">⚙️ 游戏设置</h3>
          <div class="flex flex-wrap gap-4 text-sm">
            <span class="text-slate-300">
              当前地图: <span class="text-orange-400">{{ currentMap?.icon }} {{ currentMap?.name || '经典' }}</span>
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

        <!-- 机器人管理（仅房主可见） -->
        <div v-if="isHost" class="bg-slate-700/30 rounded-xl p-4 mb-6">
          <h3 class="text-slate-400 text-sm mb-3">🤖 添加机器人</h3>
          <div class="flex flex-wrap justify-center gap-2">
            <button
              @click="addBot('easy')"
              :disabled="room?.players?.length >= (room?.rules?.playerCount || 4)"
              class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition text-sm"
            >
              + 简单机器人
            </button>
            <button
              @click="addBot('normal')"
              :disabled="room?.players?.length >= (room?.rules?.playerCount || 4)"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition text-sm"
            >
              + 普通机器人
            </button>
            <button
              @click="addBot('hard')"
              :disabled="room?.players?.length >= (room?.rules?.playerCount || 4)"
              class="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition text-sm"
            >
              + 困难机器人
            </button>
            <button
              v-if="hasBots"
              @click="removeBot()"
              class="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition text-sm"
            >
              - 移除机器人
            </button>
          </div>
          <div v-if="botCount > 0" class="text-center text-xs text-slate-500 mt-2">
            当前 {{ botCount }} 个机器人
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
      <div class="flex justify-center gap-6 mb-4 flex-wrap">
        <!-- 队伍模式：分组显示 -->
        <template v-if="hasTeams">
          <!-- A队 -->
          <div class="flex items-center gap-2">
            <div class="text-blue-400 font-bold text-sm px-2 py-1 bg-blue-500/20 rounded">A队</div>
            <div class="flex gap-2">
              <div
                v-for="player in teamAPlayers"
                :key="player.id"
                :class="[
                  'px-2 py-1.5 rounded-lg flex items-center gap-2 border-2 transition-all',
                  player.isDying
                    ? 'bg-yellow-900/50 border-yellow-500/50 animate-pulse'
                    : player.isAlive 
                      ? 'bg-blue-900/50 border-blue-500/50' 
                      : 'bg-slate-800/40 border-transparent opacity-50'
                ]"
              >
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-md"
                  :style="{ backgroundColor: player.color }"
                >
                  {{ player.isDying ? '😵' : player.isAlive ? '😎' : '💀' }}
                </div>
                <span :class="player.isAlive || player.isDying ? 'text-white text-sm' : 'text-slate-500 text-sm'">{{ player.name }}</span>
                <span v-if="player.isDying && player.dyingAt" class="text-yellow-400 text-xs font-bold">{{ getDyingCountdown(player.dyingAt) }}s</span>
              </div>
            </div>
          </div>
          
          <div class="text-slate-500 font-bold">VS</div>
          
          <!-- B队 -->
          <div class="flex items-center gap-2">
            <div class="text-red-400 font-bold text-sm px-2 py-1 bg-red-500/20 rounded">B队</div>
            <div class="flex gap-2">
              <div
                v-for="player in teamBPlayers"
                :key="player.id"
                :class="[
                  'px-2 py-1.5 rounded-lg flex items-center gap-2 border-2 transition-all',
                  player.isDying
                    ? 'bg-yellow-900/50 border-yellow-500/50 animate-pulse'
                    : player.isAlive 
                      ? 'bg-red-900/50 border-red-500/50' 
                      : 'bg-slate-800/40 border-transparent opacity-50'
                ]"
              >
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-md"
                  :style="{ backgroundColor: player.color }"
                >
                  {{ player.isDying ? '😵' : player.isAlive ? '😎' : '💀' }}
                </div>
                <span :class="player.isAlive || player.isDying ? 'text-white text-sm' : 'text-slate-500 text-sm'">{{ player.name }}</span>
                <span v-if="player.isDying && player.dyingAt" class="text-yellow-400 text-xs font-bold">{{ getDyingCountdown(player.dyingAt) }}s</span>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 个人模式 -->
        <template v-else>
          <div
            v-for="player in room.players"
            :key="player.id"
            :class="[
              'px-3 py-2 rounded-xl flex items-center gap-2 border-2 transition-all',
              player.isAlive 
                ? 'bg-slate-800/80 border-slate-600' 
                : 'bg-slate-800/40 border-transparent opacity-50'
            ]"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-md"
              :style="{ backgroundColor: player.color }"
            >
              {{ player.isAlive ? '😎' : '💀' }}
            </div>
            <span :class="player.isAlive ? 'text-white font-medium' : 'text-slate-500'">{{ player.name }}</span>
            <div class="flex items-center gap-1 text-xs">
              <span class="bg-slate-700 px-1.5 py-0.5 rounded text-orange-400">💣{{ player.bombCount }}/{{ player.maxBombs }}</span>
              <span class="bg-slate-700 px-1.5 py-0.5 rounded text-red-400">🔥{{ player.bombRange }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 游戏画布 -->
      <div class="flex justify-center">
        <div
          class="relative rounded-lg overflow-hidden shadow-lg border-2 border-slate-700"
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
              <!-- 地刺 -->
              <span v-if="cell.type === 'spike'" class="text-lg">📍</span>
              <!-- 道具 -->
              <span v-else-if="getPowerUpAt(x, y)" class="text-xl filter drop-shadow-md animate-bounce">
                {{ getPowerUpIcon(getPowerUpAt(x, y)?.type) }}
              </span>
            </div>
          </div>

          <!-- 炸弹 -->
          <div
            v-for="bomb in room.bombs"
            :key="bomb.id"
            class="absolute flex items-center justify-center transition-all duration-300 ease-out z-20"
            :style="{
              left: bomb.position.x * cellSize + 'px',
              top: bomb.position.y * cellSize + 'px',
              width: cellSize + 'px',
              height: cellSize + 'px',
            }"
          >
            <div class="relative">
              <span class="text-2xl animate-pulse filter drop-shadow">💣</span>
              <div class="absolute -top-0.5 right-0 w-2 h-2 bg-amber-700 rounded-full animate-ping opacity-70"></div>
            </div>
          </div>

          <!-- 爆炸效果 -->
          <template v-for="explosion in room.explosions" :key="explosion.createdAt">
            <div
              v-for="(pos, idx) in explosion.positions"
              :key="idx"
              class="absolute flex items-center justify-center z-30"
              :style="{
                left: pos.x * cellSize + 'px',
                top: pos.y * cellSize + 'px',
                width: cellSize + 'px',
                height: cellSize + 'px',
              }"
            >
              <div class="w-full h-full bg-gradient-to-br from-amber-700/80 to-red-900/80 animate-pulse flex items-center justify-center rounded">
                <span class="text-xl opacity-80">💥</span>
              </div>
            </div>
          </template>

          <!-- 玩家 -->
          <div
            v-for="player in room.players.filter(p => p.isAlive || p.isDying)"
            :key="player.id"
            :class="[
              'absolute flex items-center justify-center transition-all duration-100 pointer-events-none z-40',
              player.isDying ? 'animate-pulse' : ''
            ]"
            :style="{
              left: player.position.x * cellSize + 'px',
              top: player.position.y * cellSize + 'px',
              width: cellSize + 'px',
              height: cellSize + 'px',
              opacity: player.isDying ? 0.6 : 1,
            }"
          >
            <div class="relative flex items-center justify-center">
              <span 
                :class="['text-2xl filter drop-shadow-lg', player.isDying ? 'grayscale' : '']"
                :style="{ filter: `drop-shadow(0 2px 0 ${player.color})` }"
              >{{ player.isDying ? '😵' : '😎' }}</span>
              <!-- 自己的标识箭头 -->
              <div v-if="player.id === myPlayer?.id" class="absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400 text-xs animate-bounce">▼</div>
              <!-- 盾牌效果 -->
              <div v-if="player.hasShield" class="absolute inset-0 border-2 border-cyan-400 rounded-full animate-pulse"></div>
              <!-- 濒死倒计时 -->
              <div 
                v-if="player.isDying && player.dyingAt" 
                class="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-bold animate-pulse"
              >
                {{ getDyingCountdown(player.dyingAt) }}s
              </div>
              <!-- 救援提示 -->
              <div 
                v-if="player.isDying && player.team === myPlayer?.team && player.id !== myPlayer?.id" 
                class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
              >
                去救TA!
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作提示 -->
      <div class="text-center mt-4 text-slate-400 text-sm space-y-1">
        <div>
          <kbd class="px-2 py-1 bg-slate-700 rounded">↑↓←→</kbd> 或 <kbd class="px-2 py-1 bg-slate-700 rounded">WASD</kbd> 移动，
          <kbd class="px-2 py-1 bg-slate-700 rounded">空格</kbd> 放置炸弹
        </div>
        <div>
          <kbd class="px-2 py-1 bg-slate-700 rounded">E</kbd> 射针（需道具）
        </div>
      </div>
      
      <!-- 我的能力显示 -->
      <div v-if="myPlayer" class="mt-4 flex justify-center gap-4 text-sm">
        <div class="flex items-center gap-1" :class="myPlayer.canKick ? 'text-green-400' : 'text-slate-600'">
          🦶 {{ myPlayer.canKick ? '可踢泡泡' : '踢泡泡' }}
        </div>
        <div class="flex items-center gap-1" :class="myPlayer.hasShield ? 'text-yellow-400' : 'text-slate-600'">
          🛡️ {{ myPlayer.hasShield ? '有盾' : '无盾' }}
        </div>
        <div class="flex items-center gap-1" :class="myPlayer.needleCount > 0 ? 'text-red-400' : 'text-slate-600'">
          📌 x{{ myPlayer.needleCount || 0 }}
        </div>
      </div>
    </div>

    <!-- 游戏结束 - 延迟显示结算 -->
    <div v-else-if="room?.phase === 'finished'" class="max-w-4xl mx-auto">
      <!-- 倒计时期间：继续显示游戏画面 -->
      <template v-if="!showSettlement">
        <!-- 倒计时提示 -->
        <div class="text-center mb-4">
          <div class="inline-flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-lg">
            <span class="text-white">结算倒计时</span>
            <span class="text-2xl font-bold text-yellow-400">{{ settlementCountdown }}</span>
          </div>
        </div>
        
        <!-- 游戏画布 -->
        <div class="flex justify-center">
          <div
            class="relative rounded-lg overflow-hidden shadow-lg border-2 border-slate-700"
            :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
          >
            <div v-for="(row, y) in room.map?.cells" :key="y" class="flex">
              <div
                v-for="(cell, x) in row"
                :key="x"
                :class="getCellClass(cell, x, y)"
                :style="{ width: cellSize + 'px', height: cellSize + 'px' }"
              >
                <span v-if="cell.type === 'spike'" class="text-lg">📍</span>
              </div>
            </div>
            <!-- 玩家（显示存活和死亡的） -->
            <div
              v-for="player in room.players"
              :key="player.id"
              class="absolute flex items-center justify-center transition-all duration-100 pointer-events-none z-40"
              :style="{
                left: player.position.x * cellSize + 'px',
                top: player.position.y * cellSize + 'px',
                width: cellSize + 'px',
                height: cellSize + 'px',
                opacity: player.isAlive ? 1 : 0.5,
              }"
            >
              <span 
                :class="['text-2xl filter drop-shadow', !player.isAlive ? 'grayscale' : '']"
                :style="{ filter: `drop-shadow(0 2px 0 ${player.color})` }"
              >{{ player.isAlive ? '😎' : '💀' }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 结算页面 -->
      <template v-else>
        <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 text-center max-w-2xl mx-auto">
          <div class="text-5xl mb-4">🏆</div>
          <h2 class="text-2xl font-bold text-white mb-2">游戏结束</h2>
          <p 
            class="text-xl mb-6 font-bold"
            :class="room.winnerTeam === 'A' ? 'text-blue-400' : room.winnerTeam === 'B' ? 'text-red-400' : 'text-orange-400'"
          >
            {{ winnerName }} 获胜！
          </p>

          <!-- 队伍模式战绩 -->
          <template v-if="hasTeams">
            <div class="grid grid-cols-2 gap-4 mb-6">
              <!-- A队 -->
              <div :class="['p-4 rounded-xl border-2', room.winnerTeam === 'A' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 bg-slate-700/30']">
                <div class="text-blue-400 font-bold mb-3 text-lg">A队</div>
                <div class="space-y-2">
                  <div 
                    v-for="player in teamAPlayers" 
                    :key="player.id" 
                    :class="['flex items-center gap-2 p-2 rounded-lg', mvpPlayer?.id === player.id ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-slate-700/30']"
                  >
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-sm" :style="{ backgroundColor: player.color }">
                      {{ player.isAlive ? '😎' : '💀' }}
                    </div>
                    <div class="flex-1 text-left">
                      <div class="flex items-center gap-1">
                        <span class="text-sm text-white">{{ player.name }}</span>
                        <span v-if="mvpPlayer?.id === player.id" class="text-xs bg-yellow-500 text-black px-1 rounded font-bold">MVP</span>
                      </div>
                      <div class="text-xs text-slate-400 flex gap-2">
                        <span>💀 {{ player.kills }}</span>
                        <span>💊 {{ player.rescues }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- B队 -->
              <div :class="['p-4 rounded-xl border-2', room.winnerTeam === 'B' ? 'border-red-500 bg-red-500/10' : 'border-slate-600 bg-slate-700/30']">
                <div class="text-red-400 font-bold mb-3 text-lg">B队</div>
                <div class="space-y-2">
                  <div 
                    v-for="player in teamBPlayers" 
                    :key="player.id" 
                    :class="['flex items-center gap-2 p-2 rounded-lg', mvpPlayer?.id === player.id ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-slate-700/30']"
                  >
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-sm" :style="{ backgroundColor: player.color }">
                      {{ player.isAlive ? '😎' : '💀' }}
                    </div>
                    <div class="flex-1 text-left">
                      <div class="flex items-center gap-1">
                        <span class="text-sm text-white">{{ player.name }}</span>
                        <span v-if="mvpPlayer?.id === player.id" class="text-xs bg-yellow-500 text-black px-1 rounded font-bold">MVP</span>
                      </div>
                      <div class="text-xs text-slate-400 flex gap-2">
                        <span>💀 {{ player.kills }}</span>
                        <span>💊 {{ player.rescues }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 个人模式排名 -->
          <template v-else>
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
          </template>

          <button
            v-if="isHost"
            @click="restartGame"
            class="w-full py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white rounded-xl font-semibold transition"
          >
            再来一局
          </button>
        </div>
      </template>
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
  isDying: boolean       // 濒死状态
  dyingAt: number | null // 濒死开始时间
  position: Position
  bombCount: number
  maxBombs: number
  bombRange: number
  speed: number
  color: string
  team: 'A' | 'B' | null
  // 泡泡堂特殊能力
  canKick: boolean
  hasShield: boolean
  needleCount: number
  isTrapped: boolean
  trappedAt: number | null
  // 战绩统计
  kills: number
  rescues: number
}

interface Cell {
  type: 'empty' | 'wall' | 'brick' | 'bomb' | 'explosion' | 'powerup' | 'fence' | 'spike'
}

interface Bomb {
  id: string
  playerId: string
  position: Position
  range: number
  isMoving: boolean
  moveDirection: string | null
}

interface Explosion {
  positions: Position[]
  createdAt: number
  expiresAt: number
}

type PowerUpType = 'bomb_count' | 'bomb_range' | 'speed' | 'kick' | 'shield' | 'needle' | 'max_bomb' | 'max_range'

interface PowerUp {
  id: string
  type: PowerUpType
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
  selectedMapId: string
  bombs: Bomb[]
  explosions: Explosion[]
  powerUps: PowerUp[]
  winner: string | null
  winnerTeam: 'A' | 'B' | null
}

interface MapInfo {
  id: string
  name: string
  icon: string
  maxPlayers: number
}

const route = useRoute()
const router = useRouter()
const roomId = route.params.id as string

const socket = ref<Socket | null>(null)
const room = ref<Room | null>(null)
const userId = ref('')
const userName = ref('')

const toast = ref({ show: false, message: '', type: 'success' as 'success' | 'warning' | 'error' })
const mapList = ref<MapInfo[]>([])

// 结算延迟显示（游戏结束后3秒再显示结算）
const showSettlement = ref(false)
const settlementCountdown = ref(0)
let settlementTimer: ReturnType<typeof setInterval> | null = null

const cellSize = 40

const myPlayer = computed(() => room.value?.players.find(p => p.id === userId.value))
const isHost = computed(() => room.value?.hostId === userId.value)
const currentMap = computed(() => mapList.value.find(m => m.id === room.value?.selectedMapId))
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

// 队伍相关
const hasTeams = computed(() => room.value?.players.some(p => p.team !== null) || false)
const teamAPlayers = computed(() => room.value?.players.filter(p => p.team === 'A') || [])
const teamBPlayers = computed(() => room.value?.players.filter(p => p.team === 'B') || [])

// 等待房间队伍选择相关
const isKickBattleMap = computed(() => room.value?.selectedMapId === 'kick_battle')
const waitingTeamAPlayers = computed(() => room.value?.players.filter(p => p.team === 'A') || [])
const waitingTeamBPlayers = computed(() => room.value?.players.filter(p => p.team === 'B') || [])
const teamACount = computed(() => waitingTeamAPlayers.value.length)
const teamBCount = computed(() => waitingTeamBPlayers.value.length)

// 机器人相关
const hasBots = computed(() => room.value?.players.some(p => p.name.includes('[简单]') || p.name.includes('[普通]') || p.name.includes('[困难]')) || false)
const botCount = computed(() => room.value?.players.filter(p => p.name.includes('[简单]') || p.name.includes('[普通]') || p.name.includes('[困难]')).length || 0)

function addBot(difficulty: 'easy' | 'normal' | 'hard') {
  socket.value?.emit('bomberman:bot:add', { roomId: roomId, userId: userId.value, difficulty })
}

function removeBot() {
  socket.value?.emit('bomberman:bot:remove', { roomId: roomId, userId: userId.value })
}

const winnerName = computed(() => {
  // 队伍模式
  if (room.value?.winnerTeam) {
    return room.value.winnerTeam === 'A' ? 'A队' : 'B队'
  }
  // 个人模式
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

// MVP计算（击杀数*2 + 救援数，取最高分）
const mvpPlayer = computed(() => {
  if (!room.value) return null
  const players = room.value.players
  if (players.length === 0) return null
  
  let mvp = players[0]
  let maxScore = mvp.kills * 2 + mvp.rescues
  
  for (const p of players) {
    const score = p.kills * 2 + p.rescues
    if (score > maxScore) {
      maxScore = score
      mvp = p
    }
  }
  
  // 如果分数为0，没有MVP
  if (maxScore === 0) return null
  return mvp
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

// 濒死倒计时显示
const now = ref(Date.now())
let nowInterval: ReturnType<typeof setInterval> | null = null

function getDyingCountdown(dyingAt: number): number {
  const elapsed = now.value - dyingAt
  const remaining = Math.max(0, 6 - Math.floor(elapsed / 1000))
  return remaining
}

// 启动结算倒计时
function startSettlementCountdown() {
  showSettlement.value = false
  settlementCountdown.value = 3
  
  if (settlementTimer) clearInterval(settlementTimer)
  
  settlementTimer = setInterval(() => {
    settlementCountdown.value--
    if (settlementCountdown.value <= 0) {
      if (settlementTimer) clearInterval(settlementTimer)
      showSettlement.value = true
    }
  }, 1000)
}

onMounted(() => {
  // 每秒更新 now 以刷新倒计时显示
  nowInterval = setInterval(() => {
    now.value = Date.now()
  }, 1000)
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
  if (nowInterval) clearInterval(nowInterval)
  if (settlementTimer) clearInterval(settlementTimer)
  socket.value?.disconnect()
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

function initSocket() {
  socket.value = io()

  socket.value.on('connect', () => {
    socket.value?.emit('bomberman:room:rejoin', { roomId, userId: userId.value })
    socket.value?.emit('bomberman:game:getMapList')
  })

  socket.value.on('bomberman:game:mapList', (data: MapInfo[]) => {
    mapList.value = data
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
    // 启动结算倒计时（3秒后显示结算）
    startSettlementCountdown()
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

function selectMap(mapId: string) {
  if (!isHost.value) return
  socket.value?.emit('bomberman:game:selectMap', { userId: userId.value, mapId })
}

function selectTeam(team: 'A' | 'B') {
  socket.value?.emit('bomberman:game:selectTeam', { userId: userId.value, team })
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

// 记录最后移动方向，用于扔泡泡和针
const lastDirection = ref<string>('down')

function handleKeyDown(e: KeyboardEvent) {
  if (room.value?.phase !== 'playing' || !myPlayer.value?.isAlive) return

  // 放炸弹（空格）
  if (e.key === ' ') {
    e.preventDefault()
    placeBomb()
    return
  }

  // 使用针（E键）
  if (e.key === 'e' || e.key === 'E') {
    e.preventDefault()
    if (myPlayer.value?.needleCount && myPlayer.value.needleCount > 0) {
      socket.value?.emit('bomberman:game:needle', { 
        userId: userId.value, 
        direction: lastDirection.value 
      })
    }
    return
  }

  // 移动
  const direction = getDirectionFromKey(e.key)
  if (direction) {
    e.preventDefault()
    lastDirection.value = direction
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
  const base = 'flex items-center justify-center relative '
  
  // 棋盘格背景（空地）- 低调灰绿色，适合摸鱼
  const isAlt = (x + y) % 2 === 0
  const bgClass = isAlt ? 'bg-[#4a5548]' : 'bg-[#3d4740]'

  switch (cell.type) {
    case 'wall':
      // 立体墙壁样式 - 深灰色
      return base + 'bg-[#2d3436] shadow-[inset_0_-4px_0_rgba(0,0,0,0.3),inset_0_2px_0_rgba(255,255,255,0.1)]'
    case 'brick':
      // 砖块样式 - 暗棕色
      return base + 'bg-[#5d4e37] shadow-[inset_0_0_0_4px_rgba(0,0,0,0.1),inset_0_2px_0_rgba(255,255,255,0.05)] after:content-[""] after:absolute after:inset-2 after:border-2 after:border-[#3d342a]/30'
    case 'fence':
      // 铁丝网样式 - 暗灰色
      return base + 'bg-[#3a3f42]/50 border-2 border-dashed border-[#5a6268]'
    case 'spike':
      // 地刺样式（背景色 + 标记会在模板中渲染）
      return base + bgClass
    default:
      return base + bgClass
  }
}

function getPowerUpAt(x: number, y: number): PowerUp | undefined {
  return room.value?.powerUps.find(p => p.position.x === x && p.position.y === y)
}

function getPowerUpIcon(type?: string): string {
  switch (type) {
    case 'bomb_count': return '💣'    // 泡泡+1
    case 'bomb_range': return '💧'    // 药水（范围+1）
    case 'speed': return '👟'         // 溜冰鞋
    case 'kick': return '🦶'          // 踢泡泡
    case 'shield': return '🛡️'       // 盾牌
    case 'needle': return '📌'        // 针
    case 'max_bomb': return '💥'      // 最大泡泡
    case 'max_range': return '🌊'     // 最大药水
    default: return '❓'
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
  // 重置结算状态
  showSettlement.value = false
  settlementCountdown.value = 0
  if (settlementTimer) {
    clearInterval(settlementTimer)
    settlementTimer = null
  }
  
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
