import { io, Socket } from 'socket.io-client'
import type { Room, Card } from '~/types'
import { useUserStore } from '~/stores/user'
import { useRoomStore } from '~/stores/room'
import { useGameStore } from '~/stores/game'

let socket: Socket | null = null
let isConnecting = false
let heartbeatInterval: ReturnType<typeof setInterval> | null = null

export function useSocket() {
  const userStore = useUserStore()
  const roomStore = useRoomStore()
  const gameStore = useGameStore()
  
  const connect = () => {
    if (socket?.connected || isConnecting) return
    
    // 仅在客户端运行
    if (typeof window === 'undefined') return
    
    isConnecting = true
    
    const socketUrl = window.location.origin
    console.log('Connecting to socket at:', socketUrl)
    
    socket = io(socketUrl, {
      transports: ['polling'],  // 开发模式只用 polling，避免与 Vite HMR 冲突
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      path: '/socket.io/',
    })
    
    setupListeners()
  }
  
  // 心跳函数
  const startHeartbeat = () => {
    stopHeartbeat() // 先清除旧的
    heartbeatInterval = setInterval(() => {
      if (socket?.connected) {
        socket.emit('ping')
      }
    }, 15000) // 每15秒发送一次心跳
  }
  
  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }
  
  const setupListeners = () => {
    if (!socket) return
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id)
      isConnecting = false
      userStore.setConnected(true)
      
      // Register user
      socket?.emit('user:register', {
        userId: userStore.id,
        userName: userStore.name,
      })
      
      // 重连后自动重新加入房间
      const currentRoomId = roomStore.currentRoom?.id || userStore.roomId
      if (currentRoomId) {
        console.log('Reconnecting to room:', currentRoomId)
        socket?.emit('room:rejoin', {
          roomId: currentRoomId,
          userId: userStore.id,
          userName: userStore.name,
        })
      }
      
      // 启动心跳
      startHeartbeat()
    })
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
      isConnecting = false
    })
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      userStore.setConnected(false)
      stopHeartbeat()
    })
    
    // 心跳响应
    socket.on('pong', () => {
      // 服务器响应心跳，连接正常
    })
    
    // Room events
    socket.on('room:list', (rooms: Room[]) => {
      roomStore.setRooms(rooms)
    })
    
    socket.on('room:created', (room: Room) => {
      roomStore.addRoom(room)
    })
    
    socket.on('room:updated', (room: Room) => {
      roomStore.updateRoom(room)
      // 如果是当前房间，也更新 currentRoom
      if (roomStore.currentRoom?.id === room.id) {
        roomStore.setCurrentRoom(room)
      }
    })
    
    socket.on('room:deleted', (roomId: string) => {
      roomStore.removeRoom(roomId)
      // 如果当前房间被删除，返回大厅
      if (roomStore.currentRoom?.id === roomId) {
        roomStore.leaveRoom()
        userStore.setRoomId(null)
        gameStore.reset()
      }
    })
    
    socket.on('room:joined', (data: { room: Room; playerId: string }) => {
      roomStore.setCurrentRoom(data.room)
      userStore.setRoomId(data.room.id)
    })
    
    // 重连后恢复房间状态
    socket.on('room:rejoined', (data: { 
      room: any
      playerId: string
      myCards: Card[]
      opponentCounts: Record<string, number>
    }) => {
      console.log('Rejoined room:', data.room.id, 'status:', data.room.status)
      roomStore.setCurrentRoom(data.room)
      userStore.setRoomId(data.room.id)
      
      // 恢复游戏阶段（先设置阶段，再设置其他状态）
      if (data.room.status === 'bidding') {
        gameStore.setPhase('bidding')
      } else if (data.room.status === 'playing') {
        gameStore.setPhase('playing')
      }
      
      // 恢复手牌
      if (data.myCards && data.myCards.length > 0) {
        gameStore.setMyCards(data.myCards)
      }
      
      // 恢复对手牌数
      if (data.opponentCounts) {
        for (const [playerId, count] of Object.entries(data.opponentCounts)) {
          gameStore.setOpponentCardCount(playerId, count)
        }
      }
      
      // 恢复地主信息
      if (data.room.landlordId) {
        gameStore.setLandlord(data.room.landlordId)
        if (data.room.landlordCards) {
          gameStore.setLandlordCards(data.room.landlordCards)
        }
      }
      
      // 恢复上一次出的牌
      if (data.room.lastPlayedCards && data.room.lastPlayedCards.length > 0) {
        gameStore.setLastPlayed(data.room.lastPlayerId, data.room.lastPlayedCards)
      }
    })
    
    socket.on('room:left', () => {
      roomStore.leaveRoom()
      userStore.setRoomId(null)
      gameStore.reset()
    })
    
    // 当其他玩家离开房间时
    socket.on('player:left', (data: { playerId: string; room: Room }) => {
      if (roomStore.currentRoom?.id === data.room.id) {
        roomStore.setCurrentRoom(data.room)
      }
    })
    
    socket.on('room:error', (data: { message: string }) => {
      console.error('Room error:', data.message)
      roomStore.setError(data.message)
      
      // 如果房间不存在或玩家不在房间中，清除保存的 roomId
      if (data.message.includes('不存在') || data.message.includes('不在此房间')) {
        userStore.setRoomId(null)
      }
    })
    
    // Player ready event
    socket.on('player:ready', (data: { playerId: string; isReady: boolean }) => {
      if (roomStore.currentRoom) {
        const player = roomStore.currentRoom.players.find(p => p.id === data.playerId)
        if (player) {
          player.isReady = data.isReady
        }
      }
    })
    
    // Game events
    socket.on('game:started', (data: { room: Room }) => {
      roomStore.setCurrentRoom(data.room)
      gameStore.setPhase('dealing')
    })
    
    socket.on('game:cards_dealt', (data: { cards: Card[] }) => {
      gameStore.setMyCards(data.cards)
      // 只有在等待或发牌阶段才设置为叫分阶段，避免重连时覆盖 playing 状态
      if (gameStore.phase === 'waiting' || gameStore.phase === 'dealing') {
        gameStore.setPhase('bidding')
      }
    })
    
    socket.on('game:bidding_turn', (data: { playerId: string; currentBid: number }) => {
      gameStore.setBidding(data.playerId, data.currentBid)
      gameStore.setIsMyTurn(data.playerId === userStore.id)
    })
    
    socket.on('game:bid_made', (data: { playerId: string; bid: number }) => {
      gameStore.setBidding(data.playerId, data.bid)
    })
    
    socket.on('game:landlord_selected', (data: { playerId: string; landlordCards: Card[] }) => {
      gameStore.setLandlordCards(data.landlordCards)
      gameStore.setLandlord(data.playerId)
      
      // If I'm the landlord, add the cards to my hand
      if (data.playerId === userStore.id) {
        gameStore.addCards(data.landlordCards)
      }
      
      // 初始化对手牌数（地主20张，农民17张）
      if (roomStore.currentRoom) {
        const opponentIds = roomStore.currentRoom.players
          .filter(p => p.id !== userStore.id)
          .map(p => p.id)
        gameStore.initOpponentCardCounts(opponentIds, data.playerId)
      }
    })
    
    socket.on('game:your_turn', (data: { canPass: boolean }) => {
      gameStore.setIsMyTurn(true)
      gameStore.setCurrentTurn(userStore.id, data.canPass)
    })
    
    socket.on('game:turn_changed', (data: { playerId: string; canPass: boolean }) => {
      gameStore.setCurrentTurn(data.playerId, data.canPass)
      gameStore.setIsMyTurn(data.playerId === userStore.id)
    })
    
    socket.on('game:cards_played', (data: { playerId: string; playerName: string; cards: Card[] }) => {
      gameStore.setLastPlayed(data.playerId, data.cards)
      gameStore.addToHistory(data.playerId, data.playerName, data.cards)
      // 牌数由 player:card_count 事件更新
    })
    
    socket.on('game:player_passed', (data: { playerId: string; playerName: string }) => {
      gameStore.recordPass(data.playerId)
      gameStore.addToHistory(data.playerId, data.playerName, [], true)
    })
    
    socket.on('game:ended', (data: { winner: string; winnerName: string; scores: Record<string, number>; isLandlordWin: boolean }) => {
      gameStore.setWinner(data.winnerName, data.scores)
    })
    
    socket.on('game:reset', () => {
      gameStore.reset()
    })
    
    // Player updates
    socket.on('player:ready', (data: { playerId: string; isReady: boolean }) => {
      roomStore.updatePlayer(data.playerId, { isReady: data.isReady })
    })
    
    socket.on('player:card_count', (data: { playerId: string; count: number }) => {
      // 更新对手的牌数
      if (data.playerId !== userStore.id) {
        gameStore.setOpponentCardCount(data.playerId, data.count)
      }
    })
  }
  
  const disconnect = () => {
    socket?.disconnect()
    socket = null
  }
  
  // Room actions
  const createRoom = (name: string, baseScore: number, password?: string) => {
    socket?.emit('room:create', {
      hostId: userStore.id,
      hostName: userStore.name,
      name,
      baseScore,
      password,
    })
  }
  
  const joinRoom = (roomId: string, password?: string) => {
    socket?.emit('room:join', {
      roomId,
      userId: userStore.id,
      userName: userStore.name,
      password,
    })
  }
  
  const rejoinRoom = (roomId: string) => {
    socket?.emit('room:rejoin', {
      roomId,
      userId: userStore.id,
      userName: userStore.name,
    })
  }
  
  const leaveRoom = (roomId: string) => {
    socket?.emit('room:leave', {
      roomId,
      userId: userStore.id,
    })
  }
  
  const setReady = (roomId: string, isReady: boolean) => {
    socket?.emit('player:ready', {
      roomId,
      userId: userStore.id,
      isReady,
    })
  }
  
  const startGame = (roomId: string) => {
    socket?.emit('game:start', {
      roomId,
      userId: userStore.id,
    })
  }
  
  // Game actions
  const bid = (roomId: string, bidAmount: number) => {
    socket?.emit('game:bid', {
      roomId,
      userId: userStore.id,
      bid: bidAmount,
    })
  }
  
  const passBid = (roomId: string) => {
    socket?.emit('game:pass_bid', {
      roomId,
      userId: userStore.id,
    })
  }
  
  const playCards = (roomId: string, cards: Card[]) => {
    socket?.emit('game:play', {
      roomId,
      userId: userStore.id,
      cards,
    })
  }
  
  const passPlay = (roomId: string) => {
    socket?.emit('game:pass', {
      roomId,
      userId: userStore.id,
    })
  }
  
  const requestRoomList = () => {
    socket?.emit('room:list')
  }
  
  const quickJoin = () => {
    socket?.emit('room:quick_join', {
      userId: userStore.id,
      userName: userStore.name,
    })
  }
  
  return {
    connect,
    disconnect,
    createRoom,
    joinRoom,
    rejoinRoom,
    leaveRoom,
    setReady,
    startGame,
    bid,
    passBid,
    playCards,
    passPlay,
    requestRoomList,
    quickJoin,
  }
}
