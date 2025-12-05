import type { GameModule, GameContext } from '../types'
import type { Player } from '~/types'
import { gameState, type GameRoom } from './state'

// 辅助函数：获取房间的公开数据（不包含手牌）
function getRoomPublicData(room: GameRoom) {
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    hostName: room.hostName,
    players: room.players.map((p: Player) => ({ ...p, cards: [] })),
    maxPlayers: room.maxPlayers,
    baseScore: room.baseScore,
    hasPassword: room.hasPassword,
    status: room.status,
  }
}

export const doudizhuModule: GameModule = {
  name: 'doudizhu',
  
  registerHandlers(ctx: GameContext) {
    const { io, socket, socketUsers, userSockets } = ctx
    
    // ==================== 房间管理 ====================
    
    // 房间列表请求
    socket.on('room:list', () => {
      socket.emit('room:list', gameState.getAllRooms())
    })
    
    // 创建房间
    socket.on('room:create', (data: { hostId: string; hostName: string; name: string; baseScore: number; password?: string }) => {
      console.log('[斗地主] Creating room:', data.name)
      const room = gameState.createRoom(data.hostId, data.hostName, data.name, data.baseScore, data.password)
      
      socket.join(room.id)
      socket.emit('room:joined', { room, playerId: data.hostId })
      
      // Broadcast to all clients
      io.emit('room:created', getRoomPublicData(room))
    })
    
    // 加入房间
    socket.on('room:join', (data: { roomId: string; userId: string; userName: string; password?: string }) => {
      const result = gameState.joinRoom(data.roomId, data.userId, data.userName, data.password)
      
      if (result.success && result.room) {
        socket.join(data.roomId)
        socket.emit('room:joined', { room: result.room, playerId: data.userId })
        
        // Notify others in room
        socket.to(data.roomId).emit('room:updated', getRoomPublicData(result.room))
        
        // Update room list for all
        io.emit('room:updated', getRoomPublicData(result.room))
      } else {
        socket.emit('room:error', { message: result.error || '加入房间失败' })
      }
    })
    
    // 重新加入房间（断线重连）
    socket.on('room:rejoin', (data: { roomId: string; userId: string; userName: string }) => {
      console.log('[斗地主] Player rejoining room:', data.roomId, data.userName)
      
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
        ...getRoomPublicData(room),
        currentTurn: room.currentTurn,
        landlordId: room.landlordId,
        landlordCards: room.landlordCards,
        lastPlayedCards: room.lastPlayedCards,
        lastPlayerId: room.lastPlayerId,
        currentBid: room.currentBid,
        biddingPlayer: room.biddingPlayer,
      }
      
      // 如果游戏在进行中，包含手牌信息
      let myCards: any[] = []
      const opponentCounts: Record<string, number> = {}
      
      if (room.status === 'bidding' || room.status === 'playing') {
        myCards = gameState.getPlayerHand(data.roomId, data.userId)
        
        // 收集对手牌数
        for (const p of room.players) {
          if (p.id !== data.userId) {
            const playerHand = gameState.getPlayerHand(data.roomId, p.id)
            opponentCounts[p.id] = playerHand.length
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
      
      console.log('[斗地主] Player rejoined successfully:', data.userName)
    })
    
    // 快速加入
    socket.on('room:quick_join', (data: { userId: string; userName: string }) => {
      const result = gameState.quickJoin(data.userId, data.userName)
      
      if (result.success && result.room) {
        socket.join(result.room.id)
        socket.emit('room:joined', { room: result.room, playerId: data.userId })
        io.emit('room:updated', getRoomPublicData(result.room))
      } else {
        socket.emit('room:error', { message: result.error || '快速加入失败' })
      }
    })
    
    // 离开房间
    socket.on('room:leave', (data: { roomId: string; userId: string }) => {
      const result = gameState.leaveRoom(data.roomId, data.userId)
      
      socket.leave(data.roomId)
      socket.emit('room:left')
      
      if (result.deleted) {
        io.emit('room:deleted', data.roomId)
      } else if (result.room) {
        const roomData = getRoomPublicData(result.room)
        io.to(data.roomId).emit('player:left', { playerId: data.userId, room: roomData })
        io.emit('room:updated', roomData)
      }
    })
    
    // ==================== 玩家状态 ====================
    
    // 玩家准备
    socket.on('player:ready', (data: { roomId: string; userId: string; isReady: boolean }) => {
      const room = gameState.setPlayerReady(data.roomId, data.userId, data.isReady)
      
      if (room) {
        io.to(data.roomId).emit('player:ready', { playerId: data.userId, isReady: data.isReady })
        io.to(data.roomId).emit('room:updated', getRoomPublicData(room))
      }
    })
    
    // ==================== 游戏流程 ====================
    
    // 开始游戏
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
        io.to(data.roomId).emit('game:started', { room: result.room })
        
        // Send cards to each player
        for (const player of result.room.players) {
          const playerSocket = userSockets.get(player.id)
          if (playerSocket) {
            const hand = result.hands.get(player.id)
            io.to(playerSocket).emit('game:cards_dealt', { cards: hand })
          }
        }
        
        // Start bidding
        io.to(data.roomId).emit('game:bidding_turn', {
          playerId: result.firstBidder,
          currentBid: 0,
        })
        
        // Update room list
        io.emit('room:updated', getRoomPublicData(result.room))
      }
    })
    
    // 叫分
    socket.on('game:bid', (data: { roomId: string; userId: string; bid: number }) => {
      const result = gameState.handleBid(data.roomId, data.userId, data.bid)
      
      if (result) {
        io.to(data.roomId).emit('game:bid_made', { playerId: data.userId, bid: data.bid })
        
        if (result.landlordSelected && result.landlordId) {
          io.to(data.roomId).emit('game:landlord_selected', {
            playerId: result.landlordId,
            landlordCards: result.room.landlordCards,
          })
          
          // Start game - landlord's turn
          io.to(data.roomId).emit('game:turn_changed', {
            playerId: result.landlordId,
            canPass: false,
          })
        } else {
          // Continue bidding
          io.to(data.roomId).emit('game:bidding_turn', {
            playerId: result.room.biddingPlayer,
            currentBid: result.room.currentBid,
          })
        }
      }
    })
    
    // 不叫
    socket.on('game:pass_bid', (data: { roomId: string; userId: string }) => {
      const result = gameState.handleBid(data.roomId, data.userId, 0)
      
      if (result) {
        io.to(data.roomId).emit('game:bid_made', { playerId: data.userId, bid: 0 })
        
        if (result.landlordSelected && result.landlordId) {
          io.to(data.roomId).emit('game:landlord_selected', {
            playerId: result.landlordId,
            landlordCards: result.room.landlordCards,
          })
          
          io.to(data.roomId).emit('game:turn_changed', {
            playerId: result.landlordId,
            canPass: false,
          })
        } else if (result.room.status === 'waiting') {
          // Game reset due to no bids
          io.to(data.roomId).emit('game:reset')
          io.to(data.roomId).emit('room:updated', result.room)
        } else {
          io.to(data.roomId).emit('game:bidding_turn', {
            playerId: result.room.biddingPlayer,
            currentBid: result.room.currentBid,
          })
        }
      }
    })
    
    // 出牌
    socket.on('game:play', (data: { roomId: string; userId: string; cards: any[] }) => {
      const result = gameState.handlePlay(data.roomId, data.userId, data.cards)
      
      if (result.success && result.room) {
        const player = result.room.players.find((p: Player) => p.id === data.userId)
        
        io.to(data.roomId).emit('game:cards_played', {
          playerId: data.userId,
          playerName: player?.name || '未知',
          cards: data.cards,
        })
        
        // Send card count update
        io.to(data.roomId).emit('player:card_count', {
          playerId: data.userId,
          count: gameState.getPlayerHand(data.roomId, data.userId).length,
        })
        
        if (result.gameEnded && result.winner) {
          const winnerPlayer = result.room.players.find((p: Player) => p.id === result.winner)
          const isLandlordWin = result.winner === result.room.landlordId
          
          // Calculate scores
          const baseScore = result.room.baseScore
          const multiplier = result.room.currentBid || 1
          const scores: Record<string, number> = {}
          
          for (const rp of result.room.players) {
            if (rp.id === result.room.landlordId) {
              scores[rp.id] = isLandlordWin ? baseScore * multiplier * 2 : -baseScore * multiplier * 2
            } else {
              scores[rp.id] = isLandlordWin ? -baseScore * multiplier : baseScore * multiplier
            }
          }
          
          io.to(data.roomId).emit('game:ended', {
            winner: result.winner,
            winnerName: winnerPlayer?.name || '未知',
            scores,
            isLandlordWin,
          })
        } else {
          // Next turn
          const canPass = result.room.lastPlayerId !== result.room.currentTurn
          io.to(data.roomId).emit('game:turn_changed', {
            playerId: result.room.currentTurn,
            canPass,
          })
        }
      } else {
        socket.emit('room:error', { message: result.error || '出牌失败' })
      }
    })
    
    // 过牌
    socket.on('game:pass', (data: { roomId: string; userId: string }) => {
      const result = gameState.handlePass(data.roomId, data.userId)
      
      if (result.success && result.room) {
        const player = result.room.players.find((p: Player) => p.id === data.userId)
        
        io.to(data.roomId).emit('game:player_passed', {
          playerId: data.userId,
          playerName: player?.name || '未知',
        })
        
        const canPass = result.room.lastPlayedCards.length > 0 && result.room.lastPlayerId !== result.room.currentTurn
        io.to(data.roomId).emit('game:turn_changed', {
          playerId: result.room.currentTurn,
          canPass,
        })
      } else {
        socket.emit('room:error', { message: result.error || '不能过牌' })
      }
    })
  },
  
  // 处理玩家断线
  handleDisconnect(ctx: GameContext, userId: string) {
    const { io } = ctx
    
    const room = gameState.getPlayerRoom(userId)
    if (room) {
      const result = gameState.leaveRoom(room.id, userId)
      
      if (result.deleted) {
        io.emit('room:deleted', room.id)
      } else if (result.room) {
        const roomData = {
          id: result.room.id,
          name: result.room.name,
          hostId: result.room.hostId,
          hostName: result.room.hostName,
          players: result.room.players.map((p: any) => ({ ...p, cards: [] })),
          maxPlayers: result.room.maxPlayers,
          baseScore: result.room.baseScore,
          hasPassword: result.room.hasPassword,
          status: result.room.status,
        }
        io.to(room.id).emit('player:left', { playerId: userId, room: roomData as any })
        io.emit('room:updated', roomData)
      }
    }
  }
}
