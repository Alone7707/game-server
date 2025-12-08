// 炸弹人游戏状态管理

import type { Room, Player, RoomRules, GameMap, Cell, Bomb, Explosion, PowerUp, Position, PowerUpType } from './types'
import { DEFAULT_RULES, PLAYER_COLORS } from './types'

// 地图尺寸配置
const MAP_SIZES = {
  small: { width: 11, height: 9 },
  medium: { width: 13, height: 11 },
  large: { width: 15, height: 13 },
}

// 玩家出生点（按顺序）
const SPAWN_POINTS = [
  { x: 1, y: 1 },           // 左上
  { x: -2, y: -2 },         // 右下（相对地图大小）
  { x: -2, y: 1 },          // 右上
  { x: 1, y: -2 },          // 左下
]

class BombermanStateManager {
  private rooms: Map<string, Room> = new Map()
  private playerRooms: Map<string, string> = new Map()

  // ============ 房间管理 ============

  createRoom(hostId: string, hostName: string, roomName: string, rules: Partial<RoomRules>, password?: string): Room {
    const roomId = this.generateId()
    const room: Room = {
      id: roomId,
      name: roomName || `${hostName}的房间`,
      password,
      hostId,
      hostName,
      rules: { ...DEFAULT_RULES, ...rules },
      players: [{
        id: hostId,
        name: hostName,
        isOnline: true,
        isReady: false,
        isAlive: true,
        position: { x: 1, y: 1 },
        bombCount: rules.initialBombs || DEFAULT_RULES.initialBombs,
        maxBombs: rules.initialBombs || DEFAULT_RULES.initialBombs,
        bombRange: rules.initialRange || DEFAULT_RULES.initialRange,
        speed: 1,
        color: PLAYER_COLORS[0],
      }],
      phase: 'waiting',
      map: null,
      bombs: [],
      explosions: [],
      powerUps: [],
      winner: null,
      createdAt: Date.now(),
      gameStartedAt: null,
    }

    this.rooms.set(roomId, room)
    this.playerRooms.set(hostId, roomId)
    return room
  }

  joinRoom(roomId: string, playerId: string, playerName: string, password?: string): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false, error: '房间不存在' }
    if (room.phase !== 'waiting') return { success: false, error: '游戏已开始' }
    if (room.players.length >= room.rules.playerCount) return { success: false, error: '房间已满' }
    if (room.password && room.password !== password) return { success: false, error: '密码错误' }
    if (room.players.some(p => p.id === playerId)) return { success: false, error: '已在房间中' }

    const playerIndex = room.players.length
    room.players.push({
      id: playerId,
      name: playerName,
      isOnline: true,
      isReady: false,
      isAlive: true,
      position: { x: 0, y: 0 },
      bombCount: room.rules.initialBombs,
      maxBombs: room.rules.initialBombs,
      bombRange: room.rules.initialRange,
      speed: 1,
      color: PLAYER_COLORS[playerIndex],
    })

    this.playerRooms.set(playerId, roomId)
    return { success: true, room }
  }

  leaveRoom(playerId: string): { success: boolean; room?: Room; disbanded?: boolean } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false }

    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    // 游戏中离开标记为死亡
    if (room.phase === 'playing') {
      const player = room.players.find(p => p.id === playerId)
      if (player) {
        player.isAlive = false
        player.isOnline = false
      }
      this.playerRooms.delete(playerId)
      
      // 检查游戏是否结束
      const alivePlayers = room.players.filter(p => p.isAlive)
      if (alivePlayers.length <= 1) {
        room.phase = 'finished'
        room.winner = alivePlayers[0]?.id || null
      }
      
      return { success: true, room }
    }

    // 等待中直接移除
    room.players = room.players.filter(p => p.id !== playerId)
    this.playerRooms.delete(playerId)

    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      return { success: true, disbanded: true }
    }

    // 房主离开，转移房主
    if (room.hostId === playerId) {
      room.hostId = room.players[0].id
      room.hostName = room.players[0].name
    }

    return { success: true, room }
  }

  // ============ 游戏操作 ============

  setReady(playerId: string, ready: boolean): { success: boolean; room?: Room } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false }

    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'waiting') return { success: false }

    const player = room.players.find(p => p.id === playerId)
    if (!player) return { success: false }

    player.isReady = ready
    return { success: true, room }
  }

  startGame(roomId: string): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false, error: '房间不存在' }
    if (room.phase !== 'waiting') return { success: false, error: '游戏已开始' }
    if (room.players.length < 2) return { success: false, error: '至少需要2名玩家' }
    if (!room.players.every(p => p.isReady || p.id === room.hostId)) {
      return { success: false, error: '还有玩家未准备' }
    }

    // 生成地图
    room.map = this.generateMap(room.rules.mapSize)
    
    // 设置玩家出生点
    const mapSize = MAP_SIZES[room.rules.mapSize]
    room.players.forEach((player, index) => {
      const spawn = SPAWN_POINTS[index]
      player.position = {
        x: spawn.x < 0 ? mapSize.width + spawn.x : spawn.x,
        y: spawn.y < 0 ? mapSize.height + spawn.y : spawn.y,
      }
      player.isAlive = true
      player.bombCount = room.rules.initialBombs
      player.maxBombs = room.rules.initialBombs
      player.bombRange = room.rules.initialRange
      player.speed = 1
    })

    room.phase = 'playing'
    room.gameStartedAt = Date.now()
    room.bombs = []
    room.explosions = []
    room.powerUps = []

    return { success: true, room }
  }

  // 玩家移动
  movePlayer(playerId: string, direction: string): { success: boolean; room?: Room; error?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'playing') return { success: false, error: '游戏未开始' }

    const player = room.players.find(p => p.id === playerId)
    if (!player || !player.isAlive) return { success: false, error: '玩家已死亡' }

    const newPos = { ...player.position }
    switch (direction) {
      case 'up': newPos.y--; break
      case 'down': newPos.y++; break
      case 'left': newPos.x--; break
      case 'right': newPos.x++; break
      default: return { success: false, error: '无效方向' }
    }

    // 检查是否可以移动
    if (!this.canMoveTo(room, newPos)) {
      return { success: false, error: '无法移动到该位置' }
    }

    player.position = newPos

    // 检查是否捡到道具
    this.checkPowerUp(room, player)

    // 检查是否被爆炸击中
    if (this.isInExplosion(room, player.position)) {
      player.isAlive = false
      this.checkGameEnd(room)
    }

    return { success: true, room }
  }

  // 放置炸弹
  placeBomb(playerId: string): { success: boolean; room?: Room; bomb?: Bomb; error?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'playing') return { success: false, error: '游戏未开始' }

    const player = room.players.find(p => p.id === playerId)
    if (!player || !player.isAlive) return { success: false, error: '玩家已死亡' }

    if (player.bombCount <= 0) {
      return { success: false, error: '没有可用炸弹' }
    }

    // 检查当前位置是否已有炸弹
    if (room.bombs.some(b => b.position.x === player.position.x && b.position.y === player.position.y)) {
      return { success: false, error: '此位置已有炸弹' }
    }

    const bomb: Bomb = {
      id: this.generateId(),
      playerId,
      position: { ...player.position },
      range: player.bombRange,
      placedAt: Date.now(),
      explodeAt: Date.now() + room.rules.bombTimer,
    }

    room.bombs.push(bomb)
    player.bombCount--

    return { success: true, room, bomb }
  }

  // 炸弹爆炸
  explodeBomb(roomId: string, bombId: string): { success: boolean; room?: Room; explosion?: Explosion; chainBombIds?: string[] } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    const bombIndex = room.bombs.findIndex(b => b.id === bombId)
    if (bombIndex === -1) return { success: false }

    const bomb = room.bombs[bombIndex]
    room.bombs.splice(bombIndex, 1)

    // 归还炸弹给玩家
    const player = room.players.find(p => p.id === bomb.playerId)
    if (player && player.isAlive) {
      player.bombCount++
    }

    // 计算爆炸范围
    const explosionPositions = this.calculateExplosion(room, bomb)
    
    const explosion: Explosion = {
      positions: explosionPositions,
      createdAt: Date.now(),
      expiresAt: Date.now() + 500,
    }
    room.explosions.push(explosion)

    // 处理爆炸效果并获取连锁炸弹
    const chainBombIds = this.handleExplosionEffects(room, explosionPositions)

    // 检查游戏结束
    this.checkGameEnd(room)

    return { success: true, room, explosion, chainBombIds }
  }

  // 清除过期爆炸
  clearExpiredExplosions(roomId: string): { success: boolean; room?: Room } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    const now = Date.now()
    room.explosions = room.explosions.filter(e => e.expiresAt > now)

    return { success: true, room }
  }

  // ============ 辅助方法 ============

  private generateMap(size: 'small' | 'medium' | 'large'): GameMap {
    const { width, height } = MAP_SIZES[size]
    const cells: Cell[][] = []

    for (let y = 0; y < height; y++) {
      cells[y] = []
      for (let x = 0; x < width; x++) {
        // 边界是墙
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          cells[y][x] = { type: 'wall' }
        }
        // 偶数行偶数列是墙（经典泡泡堂布局）
        else if (x % 2 === 0 && y % 2 === 0) {
          cells[y][x] = { type: 'wall' }
        }
        // 其余随机生成砖块（60%概率）
        else if (Math.random() < 0.6) {
          cells[y][x] = { type: 'brick' }
        }
        else {
          cells[y][x] = { type: 'empty' }
        }
      }
    }

    // 清理出生点周围的砖块
    const spawnAreas = [
      { x: 1, y: 1 },
      { x: width - 2, y: height - 2 },
      { x: width - 2, y: 1 },
      { x: 1, y: height - 2 },
    ]
    
    for (const spawn of spawnAreas) {
      // 清理出生点和周围
      const clearPositions = [
        { x: spawn.x, y: spawn.y },
        { x: spawn.x + 1, y: spawn.y },
        { x: spawn.x, y: spawn.y + 1 },
        { x: spawn.x - 1, y: spawn.y },
        { x: spawn.x, y: spawn.y - 1 },
      ]
      for (const pos of clearPositions) {
        if (pos.x > 0 && pos.x < width - 1 && pos.y > 0 && pos.y < height - 1) {
          if (cells[pos.y][pos.x].type === 'brick') {
            cells[pos.y][pos.x] = { type: 'empty' }
          }
        }
      }
    }

    return { width, height, cells }
  }

  private canMoveTo(room: Room, pos: Position): boolean {
    if (!room.map) return false
    const { width, height, cells } = room.map

    // 边界检查
    if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) {
      return false
    }

    const cell = cells[pos.y][pos.x]
    
    // 墙和砖块不能通过
    if (cell.type === 'wall' || cell.type === 'brick') {
      return false
    }

    // 炸弹不能通过
    if (room.bombs.some(b => b.position.x === pos.x && b.position.y === pos.y)) {
      return false
    }

    return true
  }

  private checkPowerUp(room: Room, player: Player): void {
    const powerUpIndex = room.powerUps.findIndex(
      p => p.position.x === player.position.x && p.position.y === player.position.y
    )

    if (powerUpIndex !== -1) {
      const powerUp = room.powerUps[powerUpIndex]
      room.powerUps.splice(powerUpIndex, 1)

      switch (powerUp.type) {
        case 'bomb_count':
          player.maxBombs++
          player.bombCount++
          break
        case 'bomb_range':
          player.bombRange++
          break
        case 'speed':
          player.speed = Math.min(player.speed + 0.2, 2)
          break
      }
    }
  }

  private isInExplosion(room: Room, pos: Position): boolean {
    return room.explosions.some(e =>
      e.positions.some(p => p.x === pos.x && p.y === pos.y)
    )
  }

  private calculateExplosion(room: Room, bomb: Bomb): Position[] {
    if (!room.map) return []

    const positions: Position[] = [bomb.position]
    const directions = [
      { dx: 0, dy: -1 }, // 上
      { dx: 0, dy: 1 },  // 下
      { dx: -1, dy: 0 }, // 左
      { dx: 1, dy: 0 },  // 右
    ]

    for (const dir of directions) {
      for (let i = 1; i <= bomb.range; i++) {
        const pos = {
          x: bomb.position.x + dir.dx * i,
          y: bomb.position.y + dir.dy * i,
        }

        // 边界检查
        if (pos.x < 0 || pos.x >= room.map.width || pos.y < 0 || pos.y >= room.map.height) {
          break
        }

        const cell = room.map.cells[pos.y][pos.x]

        // 墙阻挡爆炸
        if (cell.type === 'wall') {
          break
        }

        positions.push(pos)

        // 砖块阻挡爆炸但会被摧毁
        if (cell.type === 'brick') {
          break
        }
      }
    }

    return positions
  }

  private handleExplosionEffects(room: Room, positions: Position[]): string[] {
    const chainBombIds: string[] = []
    if (!room.map) return chainBombIds

    for (const pos of positions) {
      // 摧毁砖块并可能生成道具
      const cell = room.map.cells[pos.y][pos.x]
      if (cell.type === 'brick') {
        room.map.cells[pos.y][pos.x] = { type: 'empty' }
        
        // 30%概率掉落道具
        if (Math.random() < 0.3) {
          const types: PowerUpType[] = ['bomb_count', 'bomb_range', 'speed']
          const powerUp: PowerUp = {
            id: this.generateId(),
            type: types[Math.floor(Math.random() * types.length)],
            position: { ...pos },
          }
          room.powerUps.push(powerUp)
        }
      }

      // 击杀玩家
      for (const player of room.players) {
        if (player.isAlive && player.position.x === pos.x && player.position.y === pos.y) {
          player.isAlive = false
        }
      }

      // 收集需要连锁爆炸的炸弹
      const chainBomb = room.bombs.find(b => b.position.x === pos.x && b.position.y === pos.y)
      if (chainBomb) {
        chainBombIds.push(chainBomb.id)
      }
    }
    
    return chainBombIds
  }

  private checkGameEnd(room: Room): void {
    const alivePlayers = room.players.filter(p => p.isAlive)
    if (alivePlayers.length <= 1) {
      room.phase = 'finished'
      room.winner = alivePlayers[0]?.id || null
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10)
  }

  // ============ 查询方法 ============

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId)
    return roomId ? this.rooms.get(roomId) : undefined
  }

  getPublicRoomList(): Array<{
    id: string
    name: string
    hostName: string
    playerCount: number
    maxPlayers: number
    hasPassword: boolean
    phase: string
  }> {
    return Array.from(this.rooms.values())
      .filter(room => room.phase === 'waiting')
      .map(room => ({
        id: room.id,
        name: room.name,
        hostName: room.hostName,
        playerCount: room.players.length,
        maxPlayers: room.rules.playerCount,
        hasPassword: !!room.password,
        phase: room.phase,
      }))
  }

  getRoomPublicData(room: Room): Room {
    // 炸弹人游戏所有数据都是公开的
    return room
  }

  resetGame(roomId: string): { success: boolean; room?: Room } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    room.phase = 'waiting'
    room.map = null
    room.bombs = []
    room.explosions = []
    room.powerUps = []
    room.winner = null
    room.gameStartedAt = null

    for (const player of room.players) {
      player.isReady = false
      player.isAlive = true
      player.position = { x: 0, y: 0 }
      player.bombCount = room.rules.initialBombs
      player.maxBombs = room.rules.initialBombs
      player.bombRange = room.rules.initialRange
      player.speed = 1
    }

    return { success: true, room }
  }
}

export const bombermanState = new BombermanStateManager()
