import { Server as SocketServer } from 'socket.io'
import type { H3Event } from 'h3'
import type { GameModule, GameContext } from '../games/types'
import { doudizhuModule } from '../games/doudizhu/handler'
import { undercoverModule } from '../games/undercover/handler'
import { qigui523Module } from '../games/qigui523/handler'
import { bombermanModule } from '../games/bomberman/handler'

// 全局 Socket.IO 实例
let io: SocketServer | null = null
const socketUsers = new Map<string, string>() // socketId -> userId
const userSockets = new Map<string, string>() // userId -> socketId

// 已注册的游戏模块
const gameModules: GameModule[] = [
  doudizhuModule,
  undercoverModule,
  qigui523Module,
  bombermanModule,
]

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
    
    // ==================== 公共事件处理 ====================
    
    // 心跳响应
    socket.on('ping', () => {
      socket.emit('pong')
    })
    
    // 用户注册
    socket.on('user:register', (data: { userId: string; userName: string }) => {
      console.log('User registered:', data.userName)
      socketUsers.set(socket.id, data.userId)
      userSockets.set(data.userId, socket.id)
    })
    
    // ==================== 注册游戏模块事件 ====================
    
    const ctx: GameContext = {
      io: io!,
      socket,
      socketUsers,
      userSockets,
    }
    
    // 为每个游戏模块注册事件处理器
    for (const module of gameModules) {
      module.registerHandlers(ctx)
    }
    
    // ==================== 断线处理 ====================
    
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
      
      const userId = socketUsers.get(socket.id)
      if (userId) {
        // 调用各游戏模块的断线处理
        for (const module of gameModules) {
          if (module.handleDisconnect) {
            module.handleDisconnect(ctx, userId)
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
