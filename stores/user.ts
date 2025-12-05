import { defineStore } from 'pinia'
import type { UserSession } from '~/types'
import { generateId, getRandomAvatar } from '~/utils/helpers'

export const useUserStore = defineStore('user', {
  state: () => ({
    id: '',
    name: '',
    avatar: '',
    roomId: null as string | null,
    isConnected: false,
    isInitialized: false,
  }),
  
  getters: {
    isInRoom: (state) => !!state.roomId,
    session: (state): UserSession => ({
      id: state.id,
      name: state.name,
      roomId: state.roomId || undefined,
    }),
  },
  
  actions: {
    initialize() {
      // 只在客户端初始化，避免 SSR hydration 问题
      if (typeof window === 'undefined') {
        return // 服务端不做任何事
      }
      
      if (this.isInitialized) {
        return // 避免重复初始化
      }
      
      const saved = localStorage.getItem('doudizhu_user')
      if (saved) {
        try {
          const data = JSON.parse(saved)
          // 验证保存的数据有效
          if (data.id && data.id.length > 10) {
            this.id = data.id
            this.name = data.name || ''
            this.avatar = data.avatar || getRandomAvatar()
            this.roomId = data.roomId || null
          } else {
            this.createNewUser()
          }
        } catch {
          this.createNewUser()
        }
      } else {
        this.createNewUser()
      }
      
      this.isInitialized = true
    },
    
    createNewUser() {
      // 使用更强的唯一 ID：时间戳 + 随机数
      this.id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      this.name = ''
      this.avatar = getRandomAvatar()
      this.saveToStorage()
    },
    
    setName(name: string) {
      this.name = name.trim()
      this.saveToStorage()
    },
    
    setRoomId(roomId: string | null) {
      this.roomId = roomId
      this.saveToStorage()
    },
    
    setConnected(connected: boolean) {
      this.isConnected = connected
    },
    
    saveToStorage() {
      if (typeof window !== 'undefined') {
        localStorage.setItem('doudizhu_user', JSON.stringify({
          id: this.id,
          name: this.name,
          avatar: this.avatar,
          roomId: this.roomId,
        }))
      }
    },
    
    logout() {
      this.roomId = null
      this.isConnected = false
    },
  },
})
