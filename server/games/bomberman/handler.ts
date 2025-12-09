// 炸弹人游戏 Socket.IO 事件处理

import type { Server, Socket } from 'socket.io'
import type { GameContext, GameModule } from '../types'
import type { RoomRules } from './types'
import { bombermanState } from './state'

const prefix = 'bomberman:'

type UserSockets = Map<string, string>

const bombermanHandler = {
  register(io: Server, socket: Socket, userSockets: UserSockets) {
    // 获取房间列表
    socket.on(`${prefix}room:list`, () => {
      socket.emit(`${prefix}room:list`, bombermanState.getPublicRoomList())
    })

    // 创建房间
    socket.on(`${prefix}room:create`, (data: {
      userId: string
      userName: string
      roomName: string
      rules: Partial<RoomRules>
      password?: string
    }) => {
      const room = bombermanState.createRoom(
        data.userId,
        data.userName,
        data.roomName,
        data.rules,
        data.password
      )

      socket.join(room.id)
      socket.emit(`${prefix}room:created`, { room })
      io.emit(`${prefix}room:list`, bombermanState.getPublicRoomList())
    })

    // 加入房间
    socket.on(`${prefix}room:join`, (data: {
      roomId: string
      userId: string
      userName: string
      password?: string
    }) => {
      const result = bombermanState.joinRoom(data.roomId, data.userId, data.userName, data.password)

      if (!result.success) {
        socket.emit(`${prefix}room:error`, { message: result.error })
        return
      }

      socket.join(data.roomId)
      socket.emit(`${prefix}room:joined`, { room: result.room })

      // 通知房间内其他玩家
      socket.to(data.roomId).emit(`${prefix}room:player_joined`, { room: result.room })
      io.emit(`${prefix}room:list`, bombermanState.getPublicRoomList())
    })

    // 离开房间
    socket.on(`${prefix}room:leave`, (data: { userId: string }) => {
      const room = bombermanState.getRoomByPlayer(data.userId)
      const roomId = room?.id

      const result = bombermanState.leaveRoom(data.userId)

      if (result.success && roomId) {
        socket.leave(roomId)

        if (result.disbanded) {
          io.to(roomId).emit(`${prefix}room:disbanded`)
        } else if (result.room) {
          io.to(roomId).emit(`${prefix}room:player_left`, { room: result.room })
        }

        io.emit(`${prefix}room:list`, bombermanState.getPublicRoomList())
      }
    })

    // 准备/取消准备
    socket.on(`${prefix}game:ready`, (data: { userId: string; ready: boolean }) => {
      const result = bombermanState.setReady(data.userId, data.ready)

      if (result.success && result.room) {
        io.to(result.room.id).emit(`${prefix}room:updated`, { room: result.room })
      }
    })

    // 开始游戏
    socket.on(`${prefix}game:start`, (data: { roomId: string; userId: string }) => {
      const room = bombermanState.getRoom(data.roomId)

      if (!room) {
        socket.emit(`${prefix}room:error`, { message: '房间不存在' })
        return
      }

      if (room.hostId !== data.userId) {
        socket.emit(`${prefix}room:error`, { message: '只有房主可以开始游戏' })
        return
      }

      const result = bombermanState.startGame(data.roomId)

      if (!result.success) {
        socket.emit(`${prefix}room:error`, { message: result.error })
        return
      }

      io.to(data.roomId).emit(`${prefix}game:started`, { room: result.room })
      io.emit(`${prefix}room:list`, bombermanState.getPublicRoomList())
    })

    // 存储玩家推泡泡的状态 { oderId_bombId: { startTime, direction, timeout } }
    const pushingState = new Map<string, { startTime: number; direction: string; timeout: NodeJS.Timeout }>()
    const PUSH_DELAY = 300 // 推300ms后踢出

    // 玩家移动
    socket.on(`${prefix}game:move`, (data: { userId: string; direction: string }) => {
      const result = bombermanState.movePlayer(data.userId, data.direction as 'up' | 'down' | 'left' | 'right')

      if (result.success && result.room) {
        io.to(result.room.id).emit(`${prefix}game:updated`, { room: result.room })

        // 清除之前的推泡泡状态（因为成功移动了）
        const pushKey = `${data.userId}_push`
        const existingPush = pushingState.get(pushKey)
        if (existingPush) {
          clearTimeout(existingPush.timeout)
          pushingState.delete(pushKey)
        }

        // 如果游戏结束
        if (result.room.phase === 'finished') {
          const winner = result.room.players.find(p => p.id === result.room!.winner)
          io.to(result.room.id).emit(`${prefix}game:finished`, {
            winnerId: result.room.winner,
            winnerName: winner?.name,
          })
        }
      } else if (result.pushingBomb && result.direction) {
        // 正在推泡泡
        const pushKey = `${data.userId}_push`
        const existingPush = pushingState.get(pushKey)
        
        if (existingPush && existingPush.direction === data.direction) {
          // 继续推同一个方向，检查是否达到300ms
          // timeout已经在运行，不需要做什么
        } else {
          // 新的推或者换方向了，重新计时
          if (existingPush) {
            clearTimeout(existingPush.timeout)
          }
          
          const timeout = setTimeout(() => {
            // 300ms到了，踢出泡泡
            const roomId = bombermanState.getPlayerRoom(data.userId)
            if (roomId && result.pushingBomb) {
              const kickResult = bombermanState.kickBombToEnd(roomId, result.pushingBomb.id, result.direction as 'up' | 'down' | 'left' | 'right')
              if (kickResult.success && kickResult.room) {
                io.to(kickResult.room.id).emit(`${prefix}game:updated`, { room: kickResult.room })
                io.to(kickResult.room.id).emit(`${prefix}game:bomb_kicked`, { bomb: kickResult.bomb })
              }
            }
            pushingState.delete(pushKey)
          }, PUSH_DELAY)

          pushingState.set(pushKey, {
            startTime: Date.now(),
            direction: data.direction,
            timeout
          })
        }
      } else {
        // 其他失败情况，清除推泡泡状态
        const pushKey = `${data.userId}_push`
        const existingPush = pushingState.get(pushKey)
        if (existingPush) {
          clearTimeout(existingPush.timeout)
          pushingState.delete(pushKey)
        }
      }
    })

    // 处理炸弹爆炸（支持连锁爆炸）
    function handleBombExplosion(roomId: string, bombId: string) {
      const explodeResult = bombermanState.explodeBomb(roomId, bombId)
      if (!explodeResult.success || !explodeResult.room) return

      io.to(explodeResult.room.id).emit(`${prefix}game:explosion`, {
        room: explodeResult.room,
        explosion: explodeResult.explosion,
      })

      // 处理连锁爆炸
      if (explodeResult.chainBombIds && explodeResult.chainBombIds.length > 0) {
        // 短暂延迟后引爆连锁炸弹，让视觉效果更好
        setTimeout(() => {
          for (const chainBombId of explodeResult.chainBombIds!) {
            handleBombExplosion(roomId, chainBombId)
          }
        }, 50)
      }

      // 如果游戏结束
      if (explodeResult.room.phase === 'finished') {
        const winner = explodeResult.room.players.find(p => p.id === explodeResult.room!.winner)
        io.to(explodeResult.room.id).emit(`${prefix}game:finished`, {
          winnerId: explodeResult.room.winner,
          winnerName: winner?.name,
        })
      }

      // 清除爆炸效果
      setTimeout(() => {
        const clearResult = bombermanState.clearExpiredExplosions(roomId)
        if (clearResult.success && clearResult.room) {
          io.to(clearResult.room.id).emit(`${prefix}game:updated`, { room: clearResult.room })
        }
      }, 500)
    }

    // 放置炸弹
    socket.on(`${prefix}game:bomb`, (data: { userId: string }) => {
      const result = bombermanState.placeBomb(data.userId)

      if (!result.success) {
        socket.emit(`${prefix}game:error`, { message: result.error })
        return
      }

      if (result.room && result.bomb) {
        io.to(result.room.id).emit(`${prefix}game:bomb_placed`, {
          room: result.room,
          bomb: result.bomb,
        })

        // 设置定时爆炸
        setTimeout(() => {
          handleBombExplosion(result.room!.id, result.bomb!.id)
        }, result.room.rules.bombTimer)
      }
    })

    // 使用针
    socket.on(`${prefix}game:needle`, (data: { userId: string; direction: string }) => {
      const result = bombermanState.useNeedle(data.userId, data.direction as 'up' | 'down' | 'left' | 'right')

      if (!result.success) {
        socket.emit(`${prefix}game:error`, { message: result.error })
        return
      }

      if (result.room && result.poppedBomb) {
        // 立即引爆被针刺破的泡泡
        handleBombExplosion(result.room.id, result.poppedBomb.id)
      }
    })

    // 重新开始
    socket.on(`${prefix}game:restart`, (data: { roomId: string; userId: string }) => {
      const room = bombermanState.getRoom(data.roomId)

      if (!room) {
        socket.emit(`${prefix}room:error`, { message: '房间不存在' })
        return
      }

      if (room.hostId !== data.userId) {
        socket.emit(`${prefix}room:error`, { message: '只有房主可以重新开始' })
        return
      }

      const result = bombermanState.resetGame(data.roomId)

      if (result.success && result.room) {
        io.to(data.roomId).emit(`${prefix}game:reset`, { room: result.room })
        io.emit(`${prefix}room:list`, bombermanState.getPublicRoomList())
      }
    })

    // 重连
    socket.on(`${prefix}room:rejoin`, (data: { roomId: string; userId: string }) => {
      const room = bombermanState.getRoom(data.roomId)

      if (!room) {
        socket.emit(`${prefix}room:error`, { message: '房间不存在' })
        return
      }

      const player = room.players.find(p => p.id === data.userId)
      if (!player) {
        socket.emit(`${prefix}room:error`, { message: '你不在此房间中' })
        return
      }

      player.isOnline = true
      socket.join(data.roomId)
      socket.emit(`${prefix}room:joined`, { room })

      socket.to(data.roomId).emit(`${prefix}room:player_reconnected`, {
        playerId: data.userId,
        playerName: player.name,
      })
    })
  },

  // 处理玩家断线
  handleDisconnect(ctx: GameContext, userId: string) {
    const room = bombermanState.getRoomByPlayer(userId)
    if (room) {
      const player = room.players.find(p => p.id === userId)
      if (player) {
        player.isOnline = false

        // 游戏中断线视为死亡
        if (room.phase === 'playing') {
          player.isAlive = false

          // 检查游戏结束
          const alivePlayers = room.players.filter(p => p.isAlive)
          if (alivePlayers.length <= 1) {
            room.phase = 'finished'
            room.winner = alivePlayers[0]?.id || null

            const winner = room.players.find(p => p.id === room.winner)
            ctx.io.to(room.id).emit('bomberman:game:finished', {
              winnerId: room.winner,
              winnerName: winner?.name,
            })
          }
        }

        ctx.io.to(room.id).emit('bomberman:room:player_offline', {
          playerId: userId,
          playerName: player.name,
          room,
        })
      }
    }
  },
}

// 导出游戏模块
export const bombermanModule: GameModule = {
  name: 'bomberman',
  registerHandlers: (ctx: GameContext) => {
    bombermanHandler.register(ctx.io, ctx.socket, ctx.userSockets)
  },
  handleDisconnect: bombermanHandler.handleDisconnect,
}
