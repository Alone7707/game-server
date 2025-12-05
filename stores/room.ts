import { defineStore } from 'pinia'
import type { Room, Player } from '~/types'

export const useRoomStore = defineStore('room', {
  state: () => ({
    rooms: [] as Room[],
    currentRoom: null as Room | null,
    isLoading: false,
    error: null as string | null,
  }),
  
  getters: {
    waitingRooms: (state) => state.rooms.filter(r => r.status === 'waiting'),
    playingRooms: (state) => state.rooms.filter(r => r.status !== 'waiting'),
    playerCount: (state) => state.currentRoom?.players.length || 0,
    isHost: (state) => (userId: string) => state.currentRoom?.hostId === userId,
    canStart: (state) => {
      if (!state.currentRoom) return false
      return state.currentRoom.players.length === 3 && 
             state.currentRoom.players.every(p => p.isReady)
    },
    myPlayer: (state) => (userId: string) => 
      state.currentRoom?.players.find(p => p.id === userId),
    otherPlayers: (state) => (userId: string) => 
      state.currentRoom?.players.filter(p => p.id !== userId) || [],
  },
  
  actions: {
    setRooms(rooms: Room[]) {
      this.rooms = rooms
    },
    
    addRoom(room: Room) {
      const index = this.rooms.findIndex(r => r.id === room.id)
      if (index >= 0) {
        this.rooms[index] = room
      } else {
        this.rooms.push(room)
      }
    },
    
    updateRoom(room: Room) {
      const index = this.rooms.findIndex(r => r.id === room.id)
      if (index >= 0) {
        this.rooms[index] = room
      }
      if (this.currentRoom?.id === room.id) {
        this.currentRoom = room
      }
    },
    
    removeRoom(roomId: string) {
      this.rooms = this.rooms.filter(r => r.id !== roomId)
      if (this.currentRoom?.id === roomId) {
        this.currentRoom = null
      }
    },
    
    setCurrentRoom(room: Room | null) {
      this.currentRoom = room
    },
    
    updatePlayer(playerId: string, updates: Partial<Player>) {
      if (!this.currentRoom) return
      const player = this.currentRoom.players.find(p => p.id === playerId)
      if (player) {
        Object.assign(player, updates)
      }
    },
    
    setLoading(loading: boolean) {
      this.isLoading = loading
    },
    
    setError(error: string | null) {
      this.error = error
    },
    
    clearError() {
      this.error = null
    },
    
    leaveRoom() {
      this.currentRoom = null
    },
  },
})
