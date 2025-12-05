<template>
  <div class="card-container overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="table-header">
            <th class="px-4 py-3 text-left">房间号</th>
            <th class="px-4 py-3 text-left">房主</th>
            <th class="px-4 py-3 text-center">人数</th>
            <th class="px-4 py-3 text-center">底分</th>
            <th class="px-4 py-3 text-center">状态</th>
            <th class="px-4 py-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rooms.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
              暂无房间，快来创建一个吧！
            </td>
          </tr>
          <tr 
            v-for="room in rooms" 
            :key="room.id"
            class="table-row"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span v-if="room.hasPassword" class="text-casino-gold">🔒</span>
                <span class="font-mono">{{ room.id }}</span>
              </div>
            </td>
            <td class="px-4 py-3">{{ room.hostName }}</td>
            <td class="px-4 py-3 text-center">
              <span 
                :class="room.players.length >= room.maxPlayers ? 'text-casino-red' : 'text-casino-gold'"
              >
                {{ room.players.length }}/{{ room.maxPlayers }}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="text-casino-gold font-bold">{{ room.baseScore }}</span> 分
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="getStatusClass(room.status)">
                {{ getStatusText(room.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <button
                v-if="room.status === 'waiting' && room.players.length < room.maxPlayers"
                class="btn-success text-sm py-1 px-3"
                @click="handleJoin(room)"
              >
                加入
              </button>
              <span v-else class="text-gray-500">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Room } from '~/types'
import { getRoomStatusText, getRoomStatusClass } from '~/utils/helpers'

defineProps<{
  rooms: Room[]
}>()

const emit = defineEmits<{
  (e: 'join', room: Room): void
}>()

function getStatusText(status: string) {
  return getRoomStatusText(status)
}

function getStatusClass(status: string) {
  return getRoomStatusClass(status)
}

function handleJoin(room: Room) {
  emit('join', room)
}
</script>
