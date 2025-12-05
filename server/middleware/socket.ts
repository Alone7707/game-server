import { Server as SocketServer } from 'socket.io'
import type { H3Event } from 'h3'
import { gameState } from '../utils/gameState'

// 全局 Socket.IO 实例
let io: SocketServer | null = null
const socketUsers = new Map<string, string>() // socketId -> userId
const userSockets = new Map<string, string>() // userId -> socketId

function initSocketIO(event: H3Event) {
  if (io) return
  
  const nodeReq = event.node.req as any
  const server = nodeReq.socket?.server
  
  if (!server) {
    console.log('No server available yet')
    return
  }
  
  // 检查是否已经有 Socket.IO 实例
  if ((server as any)._io) {
    io = (server as any)._io
    return
  }
  
  console.log('Initializing Socket.IO server...')
  
  io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    serveClient: false,
    path: '/socket.io/',
    transports: ['polling'],  // 开发模式只用 polling，避免与 Vite HMR WebSocket 冲突
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  })
  
  // 存储到 server 上避免重复创建
  ;(server as any)._io = io
  
  setupSocketHandlers()
  console.log('Socket.IO server initialized!')
}

function setupSocketHandlers() {
  if (!io) return
  
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)
    
    // 心跳响应
    socket.on('ping', () => {
      socket.emit('pong')
    })
    
    // User registration
    socket.on('user:register', (data: { userId: string; userName: string }) => {
      console.log('User registered:', data.userName)
      socketUsers.set(socket.id, data.userId)
      userSockets.set(data.userId, socket.id)
      
      // Send current room list
      socket.emit('room:list', gameState.getAllRooms())
    })
    
    // Room list request
    socket.on('room:list', () => {
      socket.emit('room:list', gameState.getAllRooms())
    })
    
    // Create room
    socket.on('room:create', (data: { hostId: string; hostName: string; name: string; baseScore: number; password?: string }) => {
      console.log('Creating room:', data.name)
      const room = gameState.createRoom(data.hostId, data.hostName, data.name, data.baseScore, data.password)
      
      socket.join(room.id)
      socket.emit('room:joined', { room, playerId: data.hostId })
      
      // Broadcast to all clients
      io!.emit('room:created', {
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        hostName: room.hostName,
        players: room.players.map(p => ({ ...p, cards: [] })),
        maxPlayers: room.maxPlayers,
        baseScore: room.baseScore,
        hasPassword: room.hasPassword,
        status: room.status,
      })
    })
    
    // Join room
    socket.on('room:join', (data: { roomId: string; userId: string; userName: string; password?: string }) => {
      const result = gameState.joinRoom(data.roomId, data.userId, data.userName, data.password)
      
      if (result.success && result.room) {
        socket.join(data.roomId)
        socket.emit('room:joined', { room: result.room, playerId: data.userId })
        
        // Notify others in room
        socket.to(data.roomId).emit('room:updated', {
          ...result.room,
          players: result.room.players.map(p => ({ ...p, cards: [] })),
        })
        
        // Update room list for all
        io!.emit('room:updated', {
          id: result.room.id,
          name: result.room.name,
          hostId: result.room.hostId,
          hostName: result.room.hostName,
          players: result.room.players.map(p => ({ ...p, cards: [] })),
          maxPlayers: result.room.maxPlayers,
          baseScore: result.room.baseScore,
          hasPassword: result.room.hasPassword,
          status: result.room.status,
        })
      } else {
        socket.emit('room:error', { message: result.error || '加入房间失败' })
      }
    })
    
    // Rejoin room after reconnection
    socket.on('room:rejoin', (data: { roomId: string; userId: string; userName: string }) => {
      console.log('Player rejoining room:', data.roomId, data.userName)
      
      const room = gameState.getRoom(data.roomId)
      if (!room) {
        socket.emit('room:error', { message: '房间不存在或已结束' })
        return
      }
      
      // 检查玩家是否在房间中
      const playerInRoom = room.players.find(p => p.id === data.userId)
      if (!playerInRoom) {
        socket.emit('room:error', { message: '你不在此房间中' })
        return
      }
      
      // 更新 socket 映射
      socketUsers.set(socket.id, data.userId)
      userSockets.set(data.userId, socket.id)
      
      // 重新加入 socket room
      socket.join(data.roomId)
      
      // 发送完整的房间状态
      const roomData = {
        id: room.id,
        name: room.name,
        hostId: room.hostId,
        hostName: room.hostName,
        players: room.players.map(p => ({ ...p, cards: [] })),
        maxPlayers: room.maxPlayers,
        baseScore: room.baseScore,
        hasPassword: room.hasPassword,
        status: room.status,
        currentTurn: room.currentTurn,
        landlordId: room.landlordId,
        landlordCards: room.landlordCards,
        lastPlayedCards: room.lastPlayedCards,
        lastPlayerId: room.lastPlayerId,
        currentBid: room.currentBid,
        biddingPlayer: room.biddingPlayer,
      }
      
      // 如果游戏在进行中，在 rejoined 事件中包含手牌
      let myCards: any[] = []
      const opponentCounts: Record<string, number> = {}
      
      if (room.status === 'bidding' || room.status === 'playing') {
        myCards = gameState.getPlayerHand(data.roomId, data.userId)
        
        // 收集对手牌数
        for (const player of room.players) {
          if (player.id !== data.userId) {
            const playerHand = gameState.getPlayerHand(data.roomId, player.id)
            opponentCounts[player.id] = playerHand.length
          }
        }
      }
      
      socket.emit('room:rejoined', { 
        room: roomData, 
        playerId: data.userId,
        myCards,
        opponentCounts,
      })
      
      // 如果游戏在进行中，发送当前轮次信息
      if ((room.status === 'bidding' || room.status === 'playing') && room.currentTurn) {
        const canPass = room.lastPlayedCards.length > 0 && room.lastPlayerId !== room.currentTurn
        socket.emit('game:turn_changed', {
          playerId: room.currentTurn,
          canPass,
        })
      }
      
      console.log('Player rejoined successfully:', data.userName)
    })
    
    // Quick join
    socket.on('room:quick_join', (data: { userId: string; userName: string }) => {
      const result = gameState.quickJoin(data.userId, data.userName)
      
      if (result.success && result.room) {
        socket.join(result.room.id)
        socket.emit('room:joined', { room: result.room, playerId: data.userId })
        
        io!.emit('room:updated', {
          id: result.room.id,
          name: result.room.name,
          hostId: result.room.hostId,
          hostName: result.room.hostName,
          players: result.room.players.map(p => ({ ...p, cards: [] })),
          maxPlayers: result.room.maxPlayers,
          baseScore: result.room.baseScore,
          hasPassword: result.room.hasPassword,
          status: result.room.status,
        })
      } else {
        socket.emit('room:error', { message: result.error || '快速加入失败' })
      }
    })
    
    // Leave room
    socket.on('room:leave', (data: { roomId: string; userId: string }) => {
      const result = gameState.leaveRoom(data.roomId, data.userId)
      
      socket.leave(data.roomId)
      socket.emit('room:left')
      
      if (result.deleted) {
        io!.emit('room:deleted', data.roomId)
      } else if (result.room) {
        // 通知房间内其他玩家
        const roomData = {
          id: result.room.id,
          name: result.room.name,
          hostId: result.room.hostId,
          hostName: result.room.hostName,
          players: result.room.players.map(p => ({ ...p, cards: [] })),
          maxPlayers: result.room.maxPlayers,
          baseScore: result.room.baseScore,
          hasPassword: result.room.hasPassword,
          status: result.room.status,
        }
        io!.to(data.roomId).emit('player:left', { playerId: data.userId, room: roomData })
        io!.emit('room:updated', roomData)
      }
    })
    
    // Player ready
    socket.on('player:ready', (data: { roomId: string; userId: string; isReady: boolean }) => {
      const room = gameState.setPlayerReady(data.roomId, data.userId, data.isReady)
      
      if (room) {
        io!.to(data.roomId).emit('player:ready', { playerId: data.userId, isReady: data.isReady })
        io!.to(data.roomId).emit('room:updated', {
          ...room,
          players: room.players.map(p => ({ ...p, cards: [] })),
        })
      }
    })
    
    // Start game
    socket.on('game:start', (data: { roomId: string; userId: string }) => {
      const room = gameState.getRoom(data.roomId)
      
      if (!room) {
        socket.emit('room:error', { message: '房间不存在' })
        return
      }
      
      if (room.hostId !== data.userId) {
        socket.emit('room:error', { message: '只有房主可以开始游戏' })
        return
      }
      
      if (!gameState.canStartGame(data.roomId)) {
        socket.emit('room:error', { message: '所有玩家必须准备好' })
        return
      }
      
      const result = gameState.startGame(data.roomId)
      
      if (result) {
        // Notify all players
        io!.to(data.roomId).emit('game:started', { room: result.room })
        
        // Send cards to each player
        for (const player of result.room.players) {
          const playerSocket = userSockets.get(player.id)
          if (playerSocket) {
            const hand = result.hands.get(player.id)
            io!.to(playerSocket).emit('game:cards_dealt', { cards: hand })
          }
        }
        
        // Start bidding
        io!.to(data.roomId).emit('game:bidding_turn', {
          playerId: result.firstBidder,
          currentBid: 0,
        })
        
        // Update room list
        io!.emit('room:updated', {
          id: result.room.id,
          name: result.room.name,
          hostId: result.room.hostId,
          hostName: result.room.hostName,
          players: result.room.players.map(p => ({ ...p, cards: [] })),
          maxPlayers: result.room.maxPlayers,
          baseScore: result.room.baseScore,
          hasPassword: result.room.hasPassword,
          status: result.room.status,
        })
      }
    })
    
    // Bidding
    socket.on('game:bid', (data: { roomId: string; userId: string; bid: number }) => {
      const result = gameState.handleBid(data.roomId, data.userId, data.bid)
      
      if (result) {
        io!.to(data.roomId).emit('game:bid_made', { playerId: data.userId, bid: data.bid })
        
        if (result.landlordSelected && result.landlordId) {
          // 只广播给房间一次，避免地主收到重复事件
          io!.to(data.roomId).emit('game:landlord_selected', {
            playerId: result.landlordId,
            landlordCards: result.room.landlordCards,
          })
          
          // Start game - landlord's turn
          io!.to(data.roomId).emit('game:turn_changed', {
            playerId: result.landlordId,
            canPass: false,
          })
        } else {
          // Continue bidding
          io!.to(data.roomId).emit('game:bidding_turn', {
            playerId: result.room.biddingPlayer,
            currentBid: result.room.currentBid,
          })
        }
      }
    })
    
    // Pass bid
    socket.on('game:pass_bid', (data: { roomId: string; userId: string }) => {
      const result = gameState.handleBid(data.roomId, data.userId, 0)
      
      if (result) {
        io!.to(data.roomId).emit('game:bid_made', { playerId: data.userId, bid: 0 })
        
        if (result.landlordSelected && result.landlordId) {
          // 只广播给房间一次，避免地主收到重复事件
          io!.to(data.roomId).emit('game:landlord_selected', {
            playerId: result.landlordId,
            landlordCards: result.room.landlordCards,
          })
          
          io!.to(data.roomId).emit('game:turn_changed', {
            playerId: result.landlordId,
            canPass: false,
          })
        } else if (result.room.status === 'waiting') {
          // Game reset due to no bids
          io!.to(data.roomId).emit('game:reset')
          io!.to(data.roomId).emit('room:updated', result.room)
        } else {
          io!.to(data.roomId).emit('game:bidding_turn', {
            playerId: result.room.biddingPlayer,
            currentBid: result.room.currentBid,
          })
        }
      }
    })
    
    // Play cards
    socket.on('game:play', (data: { roomId: string; userId: string; cards: any[] }) => {
      const result = gameState.handlePlay(data.roomId, data.userId, data.cards)
      
      if (result.success && result.room) {
        const player = result.room.players.find(p => p.id === data.userId)
        
        io!.to(data.roomId).emit('game:cards_played', {
          playerId: data.userId,
          playerName: player?.name || '未知',
          cards: data.cards,
        })
        
        // Send card count update
        io!.to(data.roomId).emit('player:card_count', {
          playerId: data.userId,
          count: gameState.getPlayerHand(data.roomId, data.userId).length,
        })
        
        if (result.gameEnded && result.winner) {
          const winnerPlayer = result.room.players.find(p => p.id === result.winner)
          const isLandlordWin = result.winner === result.room.landlordId
          
          // Calculate scores
          const baseScore = result.room.baseScore
          const multiplier = result.room.currentBid || 1
          const scores: Record<string, number> = {}
          
          for (const p of result.room.players) {
            if (p.id === result.room.landlordId) {
              scores[p.id] = isLandlordWin ? baseScore * multiplier * 2 : -baseScore * multiplier * 2
            } else {
              scores[p.id] = isLandlordWin ? -baseScore * multiplier : baseScore * multiplier
            }
          }
          
          io!.to(data.roomId).emit('game:ended', {
            winner: result.winner,
            winnerName: winnerPlayer?.name || '未知',
            scores,
            isLandlordWin,
          })
        } else {
          // Next turn
          const canPass = result.room.lastPlayerId !== result.room.currentTurn
          io!.to(data.roomId).emit('game:turn_changed', {
            playerId: result.room.currentTurn,
            canPass,
          })
        }
      } else {
        socket.emit('room:error', { message: result.error || '出牌失败' })
      }
    })
    
    // Pass play
    socket.on('game:pass', (data: { roomId: string; userId: string }) => {
      const result = gameState.handlePass(data.roomId, data.userId)
      
      if (result.success && result.room) {
        const player = result.room.players.find(p => p.id === data.userId)
        
        io!.to(data.roomId).emit('game:player_passed', {
          playerId: data.userId,
          playerName: player?.name || '未知',
        })
        
        const canPass = result.room.lastPlayedCards.length > 0 && result.room.lastPlayerId !== result.room.currentTurn
        io!.to(data.roomId).emit('game:turn_changed', {
          playerId: result.room.currentTurn,
          canPass,
        })
      } else {
        socket.emit('room:error', { message: result.error || '不能过牌' })
      }
    })
    
    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
      
      const userId = socketUsers.get(socket.id)
      if (userId) {
        // Leave any room the player was in
        const room = gameState.getPlayerRoom(userId)
        if (room) {
          const result = gameState.leaveRoom(room.id, userId)
          
          if (result.deleted) {
            io!.emit('room:deleted', room.id)
          } else if (result.room) {
            const roomData = {
              id: result.room.id,
              name: result.room.name,
              hostId: result.room.hostId,
              hostName: result.room.hostName,
              players: result.room.players.map(p => ({ ...p, cards: [] })),
              maxPlayers: result.room.maxPlayers,
              baseScore: result.room.baseScore,
              hasPassword: result.room.hasPassword,
              status: result.room.status,
            }
            // 通知房间内其他玩家有人断线离开
            io!.to(room.id).emit('player:left', { playerId: userId, room: roomData })
            io!.emit('room:updated', roomData)
          }
        }
        
        socketUsers.delete(socket.id)
        userSockets.delete(userId)
      }
    })
  })
}

// 导出中间件
export default defineEventHandler((event) => {
  // 对于 socket.io 路径，初始化 socket 后直接返回，不传递给 Vue
  const url = event.node.req.url || ''
  
  initSocketIO(event)
  
  // 如果是 socket.io 请求，不要继续处理（Socket.IO 会自己处理）
  if (url.startsWith('/socket.io')) {
    return
  }
})
