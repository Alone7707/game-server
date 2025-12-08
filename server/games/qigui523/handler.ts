// 7鬼523 Socket事件处理器

import type { Server, Socket } from 'socket.io'
import type { GameModule, GameContext } from '../types'
import { qigui523State } from './state'
import type { RoomRules } from './types'

// 辅助函数：通过userId获取socket
function getSocketByUserId(io: Server, userSockets: Map<string, string>, userId: string): Socket | undefined {
  const socketId = userSockets.get(userId)
  if (!socketId) return undefined
  return io.sockets.sockets.get(socketId)
}

export const qigui523Module: GameModule = {
  name: 'qigui523',

  registerHandlers(ctx: GameContext) {
    const { io, socket, userSockets } = ctx
    const prefix = 'qigui523:'

    // 获取房间列表
    socket.on(`${prefix}room:list`, () => {
      const rooms = qigui523State.getPublicRoomList()
      socket.emit(`${prefix}room:list`, rooms)
    })

  // 创建房间
  socket.on(`${prefix}room:create`, (data: {
    hostId: string
    hostName: string
    name: string
    password?: string
    rules?: Partial<RoomRules>
  }) => {
    const room = qigui523State.createRoom(
      data.hostId,
      data.hostName,
      data.name,
      data.rules,
      data.password
    )

    socket.join(room.id)
    socket.emit(`${prefix}room:joined`, {
      room: qigui523State.getRoomPublicData(room, data.hostId),
    })

    // 广播房间列表更新
    io.emit(`${prefix}room:list`, qigui523State.getPublicRoomList())
  })

  // 加入房间
  socket.on(`${prefix}room:join`, (data: {
    roomId: string
    userId: string
    userName: string
    password?: string
  }) => {
    const result = qigui523State.joinRoom(
      data.roomId,
      data.userId,
      data.userName,
      data.password
    )

    if (!result.success) {
      socket.emit(`${prefix}room:error`, { message: result.error })
      return
    }

    socket.join(data.roomId)
    socket.emit(`${prefix}room:joined`, {
      room: qigui523State.getRoomPublicData(result.room!, data.userId),
    })

    // 通知房间内其他玩家（给每个玩家发送包含其手牌的数据）
    for (const player of result.room!.players) {
      if (player.id !== data.userId) {
        const playerSocket = getSocketByUserId(io, userSockets, player.id)
        if (playerSocket) {
          playerSocket.emit(`${prefix}room:player_joined`, {
            room: qigui523State.getRoomPublicData(result.room!, player.id),
          })
        }
      }
    }

    // 广播房间列表更新
    io.emit(`${prefix}room:list`, qigui523State.getPublicRoomList())
  })

  // 快速加入
  socket.on(`${prefix}room:quick_join`, (data: {
    userId: string
    userName: string
  }) => {
    const result = qigui523State.quickJoin(data.userId, data.userName)

    if (!result.success) {
      socket.emit(`${prefix}room:error`, { message: result.error })
      return
    }

    socket.join(result.room!.id)
    socket.emit(`${prefix}room:joined`, {
      room: qigui523State.getRoomPublicData(result.room!, data.userId),
    })

    // 通知房间内其他玩家（给每个玩家发送包含其手牌的数据）
    for (const player of result.room!.players) {
      if (player.id !== data.userId) {
        const playerSocket = getSocketByUserId(io, userSockets, player.id)
        if (playerSocket) {
          playerSocket.emit(`${prefix}room:player_joined`, {
            room: qigui523State.getRoomPublicData(result.room!, player.id),
          })
        }
      }
    }

    io.emit(`${prefix}room:list`, qigui523State.getPublicRoomList())
  })

  // 离开房间
  socket.on(`${prefix}room:leave`, (data: { userId: string }) => {
    const room = qigui523State.getRoomByPlayer(data.userId)
    const roomId = room?.id

    const result = qigui523State.leaveRoom(data.userId)

    if (result.success && roomId) {
      socket.leave(roomId)

      if (result.disbanded) {
        io.to(roomId).emit(`${prefix}room:disbanded`)
      } else if (result.room) {
        // 给每个剩余玩家发送包含其手牌的房间数据
        for (const player of result.room.players) {
          const playerSocket = getSocketByUserId(io, userSockets, player.id)
          if (playerSocket) {
            playerSocket.emit(`${prefix}room:player_left`, {
              room: qigui523State.getRoomPublicData(result.room, player.id),
            })
          }
        }
      }

      io.emit(`${prefix}room:list`, qigui523State.getPublicRoomList())
    }
  })

  // 准备/取消准备
  socket.on(`${prefix}game:ready`, (data: { userId: string; ready: boolean }) => {
    const result = qigui523State.setReady(data.userId, data.ready)

    if (result.success && result.room) {
      // 给每个玩家发送包含其手牌的房间数据
      for (const player of result.room.players) {
        const playerSocket = getSocketByUserId(io, userSockets, player.id)
        if (playerSocket) {
          playerSocket.emit(`${prefix}room:updated`, {
            room: qigui523State.getRoomPublicData(result.room, player.id),
          })
        }
      }
    }
  })

  // 开始游戏
  socket.on(`${prefix}game:start`, (data: { roomId: string; userId: string }) => {
    const room = qigui523State.getRoom(data.roomId)
    
    if (!room) {
      socket.emit(`${prefix}room:error`, { message: '房间不存在' })
      return
    }

    if (room.hostId !== data.userId) {
      socket.emit(`${prefix}room:error`, { message: '只有房主可以开始游戏' })
      return
    }

    const result = qigui523State.startGame(data.roomId)

    if (!result.success) {
      socket.emit(`${prefix}room:error`, { message: result.error })
      return
    }

    // 给每个玩家发送各自的手牌
    for (const player of result.room!.players) {
      const playerSocket = getSocketByUserId(io, userSockets, player.id)
      if (playerSocket) {
        playerSocket.emit(`${prefix}game:started`, {
          room: qigui523State.getRoomPublicData(result.room!, player.id),
        })
      }
    }

    io.emit(`${prefix}room:list`, qigui523State.getPublicRoomList())
  })

  // 出牌
  socket.on(`${prefix}game:play`, (data: {
    roomId: string
    userId: string
    cardIds: string[]
  }) => {
    const result = qigui523State.playCards(data.userId, data.cardIds)

    if (!result.success) {
      socket.emit(`${prefix}game:error`, { message: result.error })
      return
    }

    // 广播游戏状态更新
    for (const player of result.room!.players) {
      const playerSocket = getSocketByUserId(io, userSockets, player.id)
      if (playerSocket) {
        playerSocket.emit(`${prefix}game:updated`, {
          room: qigui523State.getRoomPublicData(result.room!, player.id),
        })
      }
    }

    // 如果有赢家（游戏结束）
    if (result.roundWinner && result.room!.phase === 'finished') {
      const winner = result.room!.players.find(p => p.id === result.roundWinner)
      io.to(data.roomId).emit(`${prefix}game:finished`, {
        winnerId: result.roundWinner,
        winnerName: winner?.name,
        scores: result.room!.players.map(p => ({
          id: p.id,
          name: p.name,
          score: p.score,
        })),
      })
    }
  })

  // Pass
  socket.on(`${prefix}game:pass`, (data: { roomId: string; userId: string }) => {
    const result = qigui523State.pass(data.userId)

    if (!result.success) {
      socket.emit(`${prefix}game:error`, { message: result.error })
      return
    }

    // 广播游戏状态更新
    for (const player of result.room!.players) {
      const playerSocket = getSocketByUserId(io, userSockets, player.id)
      if (playerSocket) {
        playerSocket.emit(`${prefix}game:updated`, {
          room: qigui523State.getRoomPublicData(result.room!, player.id),
        })
      }
    }

    // 如果本轮有赢家
    if (result.roundWinner) {
      const winner = result.room!.players.find(p => p.id === result.roundWinner)
      io.to(data.roomId).emit(`${prefix}game:round_end`, {
        winnerId: result.roundWinner,
        winnerName: winner?.name,
      })
    }

    // 如果游戏结束
    if (result.room!.phase === 'finished') {
      io.to(data.roomId).emit(`${prefix}game:finished`, {
        scores: result.room!.players.map(p => ({
          id: p.id,
          name: p.name,
          score: p.score,
        })),
      })
    }
  })

  // 重新开始游戏
  socket.on(`${prefix}game:restart`, (data: { roomId: string; userId: string }) => {
    const room = qigui523State.getRoom(data.roomId)
    
    if (!room) {
      socket.emit(`${prefix}room:error`, { message: '房间不存在' })
      return
    }

    if (room.hostId !== data.userId) {
      socket.emit(`${prefix}room:error`, { message: '只有房主可以重新开始' })
      return
    }

    const result = qigui523State.resetGame(data.roomId)

    if (result.success && result.room) {
      // 给每个玩家发送包含其手牌的房间数据
      for (const player of result.room.players) {
        const playerSocket = getSocketByUserId(io, userSockets, player.id)
        if (playerSocket) {
          playerSocket.emit(`${prefix}game:reset`, {
            room: qigui523State.getRoomPublicData(result.room, player.id),
          })
        }
      }

      io.emit(`${prefix}room:list`, qigui523State.getPublicRoomList())
    }
  })

  // 获取房间状态（重连用）
  socket.on(`${prefix}room:rejoin`, (data: { roomId: string; userId: string }) => {
    const room = qigui523State.getRoom(data.roomId)
    
    if (!room) {
      socket.emit(`${prefix}room:error`, { message: '房间不存在' })
      return
    }

    const player = room.players.find(p => p.id === data.userId)
    if (!player) {
      socket.emit(`${prefix}room:error`, { message: '你不在此房间中' })
      return
    }

    // 标记玩家在线
    player.isOnline = true

    socket.join(data.roomId)
    socket.emit(`${prefix}room:joined`, {
      room: qigui523State.getRoomPublicData(room, data.userId),
    })

    // 通知其他玩家（给每个玩家发送包含其手牌的数据）
    for (const p of room.players) {
      if (p.id !== data.userId) {
        const playerSocket = getSocketByUserId(io, userSockets, p.id)
        if (playerSocket) {
          playerSocket.emit(`${prefix}room:player_reconnected`, {
            playerId: data.userId,
            playerName: player.name,
            room: qigui523State.getRoomPublicData(room, p.id),
          })
        }
      }
    }
  })
  },

  // 处理玩家断线
  handleDisconnect(ctx: GameContext, userId: string) {
    const room = qigui523State.getRoomByPlayer(userId)
    if (room) {
      const player = room.players.find(p => p.id === userId)
      if (player) {
        player.isOnline = false
        
        // 只在游戏进行中检查是否需要销毁房间
        // 等待状态下不销毁，因为玩家可能只是刷新页面
        if (room.phase === 'playing' || room.phase === 'finished') {
          const allOffline = room.players.every(p => !p.isOnline)
          if (allOffline) {
            // 通知房间解散
            ctx.io.to(room.id).emit('qigui523:room:disbanded')
            // 调用 leaveRoom 来清理房间
            qigui523State.leaveRoom(userId)
            // 更新房间列表
            ctx.io.emit('qigui523:room:list', qigui523State.getPublicRoomList())
            return
          }
        }
        
        // 通知其他玩家该玩家离线
        ctx.io.to(room.id).emit('qigui523:room:player_offline', {
          playerId: userId,
          playerName: player.name,
        })
      }
    }
  },
}
