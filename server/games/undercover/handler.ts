import type { GameModule, GameContext } from '../types'
import { undercoverState, type UndercoverRoom, type UndercoverPlayer } from './state'

// 获取房间公开数据（隐藏敏感信息）
function getRoomPublicData(room: UndercoverRoom, forPlayerId?: string) {
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    hostName: room.hostName,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      role: room.phase === 'ended' || !p.isAlive ? p.role : 'unknown',
      status: p.status,
      isReady: p.isReady,
      isAlive: p.isAlive,
      description: room.phase === 'voting' || room.phase === 'result' || room.phase === 'ended' ? p.description : '',
      position: p.position,
      hasVoted: !!p.votedFor,
    })),
    maxPlayers: room.maxPlayers,
    minPlayers: room.minPlayers,
    hasPassword: room.hasPassword,
    status: room.status,
    doubleUndercover: room.doubleUndercover,
    describeTime: room.describeTime,
    voteTime: room.voteTime,
    phase: room.phase,
    currentRound: room.currentRound,
    describeOrder: room.describeOrder,
    currentDescriber: room.currentDescriber,
    phaseEndTime: room.phaseEndTime,
    noVoteRounds: room.noVoteRounds,
    winner: room.winner,
  }
}

// 获取玩家私有数据
function getPlayerPrivateData(room: UndercoverRoom, playerId: string) {
  const player = room.players.find(p => p.id === playerId)
  if (!player) return null
  
  return {
    word: player.word,
    role: player.role,
  }
}

// 定时器管理
const phaseTimers = new Map<string, NodeJS.Timeout>()
// 断线重连延迟（玩家ID -> 超时定时器）
const disconnectTimers = new Map<string, NodeJS.Timeout>()

function clearPhaseTimer(roomId: string) {
  const timer = phaseTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    phaseTimers.delete(roomId)
  }
}

// 取消玩家的断线定时器（当玩家重连时）
function cancelDisconnectTimer(userId: string) {
  const timer = disconnectTimers.get(userId)
  if (timer) {
    clearTimeout(timer)
    disconnectTimers.delete(userId)
    console.log('[谁是卧底] Cancelled disconnect timer for:', userId)
  }
}

export const undercoverModule: GameModule = {
  name: 'undercover',
  
  registerHandlers(ctx: GameContext) {
    const { io, socket, socketUsers, userSockets } = ctx
    
    // ==================== 房间管理 ====================
    
    // 房间列表
    socket.on('undercover:room:list', () => {
      socket.emit('undercover:room:list', undercoverState.getAllRooms())
    })
    
    // 创建房间
    socket.on('undercover:room:create', (data: { hostId: string; hostName: string; name: string; password?: string }) => {
      console.log('[谁是卧底] Creating room:', data.name)
      const room = undercoverState.createRoom(data.hostId, data.hostName, data.name, data.password)
      
      socket.join(`undercover:${room.id}`)
      socket.emit('undercover:room:joined', { 
        room: getRoomPublicData(room), 
        playerId: data.hostId,
        privateData: getPlayerPrivateData(room, data.hostId),
      })
      
      io.emit('undercover:room:created', getRoomPublicData(room))
    })
    
    // 加入房间
    socket.on('undercover:room:join', (data: { roomId: string; userId: string; userName: string; password?: string }) => {
      // 取消可能存在的断线定时器
      cancelDisconnectTimer(data.userId)
      
      const result = undercoverState.joinRoom(data.roomId, data.userId, data.userName, data.password)
      
      if (result.success && result.room) {
        socket.join(`undercover:${data.roomId}`)
        socket.emit('undercover:room:joined', { 
          room: getRoomPublicData(result.room), 
          playerId: data.userId,
          privateData: getPlayerPrivateData(result.room, data.userId),
        })
        
        socket.to(`undercover:${data.roomId}`).emit('undercover:room:updated', getRoomPublicData(result.room))
        io.emit('undercover:room:updated', getRoomPublicData(result.room))
      } else {
        socket.emit('undercover:room:error', { message: result.error || '加入房间失败' })
      }
    })
    
    // 重新加入房间
    socket.on('undercover:room:rejoin', (data: { roomId: string; userId: string; userName: string }) => {
      console.log('[谁是卧底] Player rejoining:', data.userName)
      
      const room = undercoverState.getRoom(data.roomId)
      if (!room) {
        socket.emit('undercover:room:error', { message: '房间不存在或已结束' })
        return
      }
      
      const playerInRoom = room.players.find(p => p.id === data.userId)
      if (!playerInRoom) {
        socket.emit('undercover:room:error', { message: '你不在此房间中' })
        return
      }
      
      socketUsers.set(socket.id, data.userId)
      userSockets.set(data.userId, socket.id)
      socket.join(`undercover:${data.roomId}`)
      
      socket.emit('undercover:room:rejoined', {
        room: getRoomPublicData(room, data.userId),
        playerId: data.userId,
        privateData: getPlayerPrivateData(room, data.userId),
      })
    })
    
    // 快速加入
    socket.on('undercover:room:quick_join', (data: { userId: string; userName: string }) => {
      const result = undercoverState.quickJoin(data.userId, data.userName)
      
      if (result.success && result.room) {
        socket.join(`undercover:${result.room.id}`)
        socket.emit('undercover:room:joined', { 
          room: getRoomPublicData(result.room), 
          playerId: data.userId,
          privateData: getPlayerPrivateData(result.room, data.userId),
        })
        io.emit('undercover:room:updated', getRoomPublicData(result.room))
      } else {
        socket.emit('undercover:room:error', { message: result.error || '快速加入失败' })
      }
    })
    
    // 离开房间
    socket.on('undercover:room:leave', (data: { roomId: string; userId: string }) => {
      clearPhaseTimer(data.roomId)
      const result = undercoverState.leaveRoom(data.roomId, data.userId)
      
      socket.leave(`undercover:${data.roomId}`)
      socket.emit('undercover:room:left')
      
      if (result.deleted) {
        io.emit('undercover:room:deleted', data.roomId)
      } else if (result.room) {
        io.to(`undercover:${data.roomId}`).emit('undercover:player:left', { 
          playerId: data.userId, 
          room: getRoomPublicData(result.room) 
        })
        io.emit('undercover:room:updated', getRoomPublicData(result.room))
      }
    })
    
    // ==================== 玩家状态 ====================
    
    // 玩家准备
    socket.on('undercover:player:ready', (data: { roomId: string; userId: string; isReady: boolean }) => {
      const room = undercoverState.setPlayerReady(data.roomId, data.userId, data.isReady)
      
      if (room) {
        io.to(`undercover:${data.roomId}`).emit('undercover:player:ready', { 
          playerId: data.userId, 
          isReady: data.isReady 
        })
        io.to(`undercover:${data.roomId}`).emit('undercover:room:updated', getRoomPublicData(room))
      }
    })
    
    // 更新游戏设置
    socket.on('undercover:settings:update', (data: { roomId: string; userId: string; settings: any }) => {
      const room = undercoverState.getRoom(data.roomId)
      if (!room || room.hostId !== data.userId) {
        socket.emit('undercover:room:error', { message: '只有房主可以修改设置' })
        return
      }
      
      const updatedRoom = undercoverState.updateSettings(data.roomId, data.settings)
      if (updatedRoom) {
        io.to(`undercover:${data.roomId}`).emit('undercover:room:updated', getRoomPublicData(updatedRoom))
      }
    })
    
    // ==================== 游戏流程 ====================
    
    // 开始游戏
    socket.on('undercover:game:start', (data: { roomId: string; userId: string }) => {
      const room = undercoverState.getRoom(data.roomId)
      
      if (!room) {
        socket.emit('undercover:room:error', { message: '房间不存在' })
        return
      }
      
      if (room.hostId !== data.userId) {
        socket.emit('undercover:room:error', { message: '只有房主可以开始游戏' })
        return
      }
      
      if (!undercoverState.canStartGame(data.roomId)) {
        socket.emit('undercover:room:error', { message: '所有玩家必须准备好，且至少需要3人' })
        return
      }
      
      const startedRoom = undercoverState.startGame(data.roomId)
      if (startedRoom) {
        // 通知所有玩家游戏开始
        io.to(`undercover:${data.roomId}`).emit('undercover:game:started', {
          room: getRoomPublicData(startedRoom),
        })
        
        // 给每个玩家发送私有数据（词语和身份）
        for (const player of startedRoom.players) {
          const playerSocket = userSockets.get(player.id)
          if (playerSocket) {
            io.to(playerSocket).emit('undercover:game:word_assigned', {
              word: player.word,
              role: player.role,
            })
          }
        }
        
        // 开始描述阶段
        io.to(`undercover:${data.roomId}`).emit('undercover:phase:describe', {
          room: getRoomPublicData(startedRoom),
          currentDescriber: startedRoom.currentDescriber,
          endTime: startedRoom.phaseEndTime,
        })
        
        // 设置描述阶段超时
        setDescribePhaseTimer(data.roomId, startedRoom.describeTime * 1000)
        
        io.emit('undercover:room:updated', getRoomPublicData(startedRoom))
      }
    })
    
    // 提交描述
    socket.on('undercover:game:describe', (data: { roomId: string; userId: string; description: string }) => {
      const result = undercoverState.submitDescription(data.roomId, data.userId, data.description)
      
      if (result.success && result.room) {
        // 通知该玩家描述已提交
        socket.emit('undercover:game:describe_submitted', { success: true })
        
        // 通知所有人有玩家提交了描述
        io.to(`undercover:${data.roomId}`).emit('undercover:player:described', {
          playerId: data.userId,
        })
        
        // 如果所有人都提交了，进入投票阶段
        if (result.allSubmitted) {
          clearPhaseTimer(data.roomId)
          startVotePhase(data.roomId)
        }
      } else {
        socket.emit('undercover:game:describe_error', { message: result.error })
      }
    })
    
    // 提交投票
    socket.on('undercover:game:vote', (data: { roomId: string; userId: string; targetId: string }) => {
      const result = undercoverState.submitVote(data.roomId, data.userId, data.targetId)
      
      if (result.success && result.room) {
        socket.emit('undercover:game:vote_submitted', { success: true })
        
        // 通知所有人投票进度
        const votedCount = result.room.players.filter(p => p.isAlive && result.room!.votes[p.id]).length
        const totalAlive = result.room.players.filter(p => p.isAlive).length
        
        io.to(`undercover:${data.roomId}`).emit('undercover:vote:progress', {
          votedCount,
          totalAlive,
        })
        
        // 如果所有人都投票了，处理结果
        if (result.allVoted) {
          clearPhaseTimer(data.roomId)
          processVoteResult(data.roomId)
        }
      } else {
        socket.emit('undercover:game:vote_error', { message: result.error })
      }
    })
    
    // 继续下一轮
    socket.on('undercover:game:next_round', (data: { roomId: string; userId: string }) => {
      const room = undercoverState.getRoom(data.roomId)
      if (!room || room.hostId !== data.userId) {
        socket.emit('undercover:room:error', { message: '只有房主可以开始下一轮' })
        return
      }
      
      const nextRoom = undercoverState.nextRound(data.roomId)
      if (nextRoom) {
        io.to(`undercover:${data.roomId}`).emit('undercover:phase:describe', {
          room: getRoomPublicData(nextRoom),
          currentDescriber: nextRoom.currentDescriber,
          endTime: nextRoom.phaseEndTime,
        })
        
        setDescribePhaseTimer(data.roomId, nextRoom.describeTime * 1000)
      }
    })
    
    // 重置游戏
    socket.on('undercover:game:reset', (data: { roomId: string; userId: string }) => {
      const room = undercoverState.getRoom(data.roomId)
      if (!room || room.hostId !== data.userId) {
        socket.emit('undercover:room:error', { message: '只有房主可以重置游戏' })
        return
      }
      
      clearPhaseTimer(data.roomId)
      const resetRoom = undercoverState.resetGame(data.roomId)
      if (resetRoom) {
        io.to(`undercover:${data.roomId}`).emit('undercover:game:reset', {
          room: getRoomPublicData(resetRoom),
        })
      }
    })
    
    // ==================== 辅助函数 ====================
    
    function setDescribePhaseTimer(roomId: string, duration: number) {
      clearPhaseTimer(roomId)
      
      const timer = setTimeout(() => {
        // 时间到，自动进入投票阶段
        startVotePhase(roomId)
      }, duration)
      
      phaseTimers.set(roomId, timer)
    }
    
    function startVotePhase(roomId: string) {
      const room = undercoverState.startVotePhase(roomId)
      if (room) {
        io.to(`undercover:${roomId}`).emit('undercover:phase:vote', {
          room: getRoomPublicData(room),
          descriptions: room.descriptions,
          endTime: room.phaseEndTime,
        })
        
        // 设置投票超时
        const timer = setTimeout(() => {
          processVoteResult(roomId)
        }, room.voteTime * 1000)
        
        phaseTimers.set(roomId, timer)
      }
    }
    
    function processVoteResult(roomId: string) {
      clearPhaseTimer(roomId)
      
      const result = undercoverState.processVoteResult(roomId)
      if (!result) return
      
      const { room, eliminated, isTie, gameEnded, winner } = result
      
      // 发送投票结果
      io.to(`undercover:${roomId}`).emit('undercover:vote:result', {
        room: getRoomPublicData(room),
        votes: room.voteHistory[room.voteHistory.length - 1]?.votes || {},
        eliminated: eliminated ? {
          id: eliminated.id,
          name: eliminated.name,
          role: eliminated.role,
        } : null,
        isTie,
      })
      
      if (gameEnded) {
        // 游戏结束
        io.to(`undercover:${roomId}`).emit('undercover:game:ended', {
          room: getRoomPublicData(room),
          winner,
          players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            word: p.word,
            isAlive: p.isAlive,
          })),
        })
        
        io.emit('undercover:room:updated', getRoomPublicData(room))
      } else {
        // 进入结果展示阶段，等待房主开始下一轮
        io.to(`undercover:${roomId}`).emit('undercover:phase:result', {
          room: getRoomPublicData(room),
        })
      }
    }
  },
  
  // 处理断线 - 延迟5秒再真正移除，给页面跳转重连的机会
  handleDisconnect(ctx: GameContext, userId: string) {
    const { io } = ctx
    
    const room = undercoverState.getPlayerRoom(userId)
    if (!room) return
    
    // 如果游戏正在进行中，立即移除
    if (room.status === 'playing') {
      clearPhaseTimer(room.id)
      const result = undercoverState.leaveRoom(room.id, userId)
      
      if (result.deleted) {
        io.emit('undercover:room:deleted', room.id)
      } else if (result.room) {
        io.to(`undercover:${room.id}`).emit('undercover:player:left', { 
          playerId: userId, 
          room: getRoomPublicData(result.room) 
        })
        io.emit('undercover:room:updated', getRoomPublicData(result.room))
      }
      return
    }
    
    // 等待状态下，延迟5秒再移除，给重连机会
    console.log('[谁是卧底] Player disconnected, waiting 5s before removing:', userId)
    
    const timer = setTimeout(() => {
      disconnectTimers.delete(userId)
      
      // 再次检查房间是否还存在
      const currentRoom = undercoverState.getPlayerRoom(userId)
      if (!currentRoom) return
      
      console.log('[谁是卧底] Removing player after timeout:', userId)
      const result = undercoverState.leaveRoom(currentRoom.id, userId)
      
      if (result.deleted) {
        io.emit('undercover:room:deleted', currentRoom.id)
      } else if (result.room) {
        io.to(`undercover:${currentRoom.id}`).emit('undercover:player:left', { 
          playerId: userId, 
          room: getRoomPublicData(result.room) 
        })
        io.emit('undercover:room:updated', getRoomPublicData(result.room))
      }
    }, 5000)
    
    disconnectTimers.set(userId, timer)
  }
}
