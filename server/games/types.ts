import type { Socket, Server as SocketServer } from 'socket.io'

// 游戏模块上下文
export interface GameContext {
  io: SocketServer
  socket: Socket
  socketUsers: Map<string, string>  // socketId -> userId
  userSockets: Map<string, string>  // userId -> socketId
}

// 游戏模块接口
export interface GameModule {
  name: string
  // 注册该游戏的所有 socket 事件处理器
  registerHandlers: (ctx: GameContext) => void
  // 处理玩家断线
  handleDisconnect?: (ctx: GameContext, userId: string) => void
}
