// 炸弹人游戏状态管理

import type { Room, Player, RoomRules, GameMap, Cell, Bomb, Explosion, PowerUp, Position, PowerUpType, Direction } from './types'
import { DEFAULT_RULES, PLAYER_COLORS } from './types'

// 地图尺寸配置
const MAP_SIZES = {
  small: { width: 11, height: 9 },
  medium: { width: 13, height: 11 },
  large: { width: 15, height: 13 },
}

// 玩家出生点（按顺序，相对坐标，负数表示从边缘算）
const SPAWN_POINTS = [
  { x: 1, y: 1 },           // 左上
  { x: -2, y: -2 },         // 右下
  { x: -2, y: 1 },          // 右上
  { x: 1, y: -2 },          // 左下
  { x: 0, y: 1, midX: true },   // 上中
  { x: 0, y: -2, midX: true },  // 下中
] as const

class BombermanStateManager {
  private rooms: Map<string, Room> = new Map()
  private playerRooms: Map<string, string> = new Map()

  // ============ 辅助函数 ============
  
  // 创建玩家对象
  private createPlayer(id: string, name: string, rules: RoomRules, colorIndex: number): Player {
    return {
      id,
      name,
      isOnline: true,
      isReady: false,
      isAlive: true,
      position: { x: 1, y: 1 },
      bombCount: rules.initialBombs,
      maxBombs: rules.initialBombs,
      bombRange: rules.initialRange,
      speed: 1,
      color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
      // 泡泡堂特殊能力
      canKick: false,
      hasShield: false,
      needleCount: 0,
      isTrapped: false,
      trappedAt: null,
    }
  }

  // ============ 房间管理 ============

  createRoom(hostId: string, hostName: string, roomName: string, rules: Partial<RoomRules>, password?: string): Room {
    const roomId = this.generateId()
    const mergedRules = { ...DEFAULT_RULES, ...rules }
    const room: Room = {
      id: roomId,
      name: roomName || `${hostName}的房间`,
      password,
      hostId,
      hostName,
      rules: mergedRules,
      players: [this.createPlayer(hostId, hostName, mergedRules, 0)],
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
    room.players.push(this.createPlayer(playerId, playerName, room.rules, playerIndex))

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
      let x: number, y: number
      
      // 处理X坐标
      if ('midX' in spawn && spawn.midX) {
        // 中间位置，确保是奇数位置（避开墙）
        x = Math.floor(mapSize.width / 2)
        if (x % 2 === 0) x++  // 偶数列是墙，移到奇数列
      } else {
        x = spawn.x < 0 ? mapSize.width + spawn.x : spawn.x
      }
      
      // 处理Y坐标
      y = spawn.y < 0 ? mapSize.height + spawn.y : spawn.y
      
      player.position = { x, y }
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
  movePlayer(playerId: string, direction: Direction): { success: boolean; room?: Room; error?: string; kickedBomb?: Bomb; pushingBomb?: Bomb; direction?: Direction } {
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

    // 检查目标位置是否有炸弹
    const bombAtTarget = room.bombs.find(b => b.position.x === newPos.x && b.position.y === newPos.y)
    
    if (bombAtTarget) {
      // 有踢泡泡能力时，返回正在推的炸弹信息
      if (player.canKick) {
        return { success: false, error: '推泡泡中', pushingBomb: bombAtTarget, direction }
      }
      // 没有踢泡泡能力，不能移动
      return { success: false, error: '无法移动到该位置' }
    }

    // 检查是否可以移动
    if (!this.canMoveTo(room, newPos)) {
      return { success: false, error: '无法移动到该位置' }
    }

    player.position = newPos

    // 检查是否捡到道具
    this.checkPowerUp(room, player)

    // 注意：不在移动时检测爆炸，只在爆炸发生瞬间判定
    // 这样玩家可以在爆炸动画期间安全通过（符合泡泡堂逻辑）

    return { success: true, room }
  }

  // 踢泡泡到尽头
  kickBombToEnd(roomId: string, bombId: string, direction: Direction): { success: boolean; room?: Room; bomb?: Bomb } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    const bomb = room.bombs.find(b => b.id === bombId)
    if (!bomb) return { success: false }

    // 计算泡泡最终位置（一直滑到碰到障碍物）
    const finalPos = this.calculateKickEndPosition(room, bomb.position, direction, bombId)
    bomb.position = finalPos
    bomb.isMoving = false
    bomb.moveDirection = null

    return { success: true, room, bomb }
  }

  // 计算踢泡泡的最终位置
  private calculateKickEndPosition(room: Room, start: Position, direction: Direction, bombId: string): Position {
    if (!room.map) return start

    const { width, height, cells } = room.map
    let currentPos = { ...start }

    while (true) {
      const nextPos = { ...currentPos }
      switch (direction) {
        case 'up': nextPos.y--; break
        case 'down': nextPos.y++; break
        case 'left': nextPos.x--; break
        case 'right': nextPos.x++; break
      }

      // 检查是否可以继续移动
      if (nextPos.x < 0 || nextPos.x >= width || nextPos.y < 0 || nextPos.y >= height) {
        break // 到达边界
      }

      const cell = cells[nextPos.y][nextPos.x]
      if (cell.type === 'wall' || cell.type === 'brick') {
        break // 碰到墙或砖块
      }

      // 检查是否有其他炸弹
      if (room.bombs.some(b => b.id !== bombId && b.position.x === nextPos.x && b.position.y === nextPos.y)) {
        break // 碰到其他炸弹
      }

      // 检查是否有玩家
      if (room.players.some(p => p.isAlive && p.position.x === nextPos.x && p.position.y === nextPos.y)) {
        break // 碰到玩家
      }

      currentPos = nextPos
    }

    return currentPos
  }

  // 更新移动中的炸弹位置
  updateMovingBombs(roomId: string): { success: boolean; room?: Room; explodedBombs?: string[] } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    const explodedBombs: string[] = []
    
    for (const bomb of room.bombs) {
      if (!bomb.isMoving || !bomb.moveDirection) continue
      
      const newPos = { ...bomb.position }
      switch (bomb.moveDirection) {
        case 'up': newPos.y--; break
        case 'down': newPos.y++; break
        case 'left': newPos.x--; break
        case 'right': newPos.x++; break
      }

      // 检查是否可以移动
      if (this.canBombMoveTo(room, newPos, bomb.id)) {
        bomb.position = newPos
      } else {
        // 碰到障碍物停止
        bomb.isMoving = false
        bomb.moveDirection = null
      }
    }

    return { success: true, room, explodedBombs }
  }

  // 检查炸弹是否可以移动到指定位置
  private canBombMoveTo(room: Room, pos: Position, bombId: string): boolean {
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

    // 其他炸弹不能通过
    if (room.bombs.some(b => b.id !== bombId && b.position.x === pos.x && b.position.y === pos.y)) {
      return false
    }

    // 玩家位置也停止
    if (room.players.some(p => p.isAlive && p.position.x === pos.x && p.position.y === pos.y)) {
      return false
    }

    return true
  }

  // 使用针刺破泡泡
  useNeedle(playerId: string, direction: Direction): { success: boolean; room?: Room; poppedBomb?: Bomb; error?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'playing') return { success: false, error: '游戏未开始' }

    const player = room.players.find(p => p.id === playerId)
    if (!player || !player.isAlive) return { success: false, error: '玩家已死亡' }

    if (player.needleCount <= 0) {
      return { success: false, error: '没有针了' }
    }

    // 找到方向上最近的炸弹
    const targetBomb = this.findBombInDirection(room, player.position, direction)
    if (!targetBomb) {
      return { success: false, error: '该方向没有泡泡' }
    }

    // 消耗一根针
    player.needleCount--

    return { success: true, room, poppedBomb: targetBomb }
  }

  // 在指定方向找到最近的炸弹
  private findBombInDirection(room: Room, start: Position, direction: Direction): Bomb | null {
    if (!room.map) return null

    const { width, height } = room.map
    
    for (let i = 1; i <= Math.max(width, height); i++) {
      const checkPos = { ...start }
      switch (direction) {
        case 'up': checkPos.y -= i; break
        case 'down': checkPos.y += i; break
        case 'left': checkPos.x -= i; break
        case 'right': checkPos.x += i; break
      }

      // 超出边界
      if (checkPos.x < 0 || checkPos.x >= width || checkPos.y < 0 || checkPos.y >= height) {
        return null
      }

      // 找到炸弹
      const bomb = room.bombs.find(b => b.position.x === checkPos.x && b.position.y === checkPos.y)
      if (bomb) return bomb

      // 被墙阻挡
      const cell = room.map.cells[checkPos.y][checkPos.x]
      if (cell.type === 'wall') {
        return null
      }
    }

    return null
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
      isMoving: false,
      moveDirection: null,
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
    let midX = Math.floor(width / 2)
    if (midX % 2 === 0) midX++  // 偶数列是墙，移到奇数列
    
    const spawnAreas = [
      { x: 1, y: 1 },
      { x: width - 2, y: height - 2 },
      { x: width - 2, y: 1 },
      { x: 1, y: height - 2 },
      { x: midX, y: 1 },           // 上中（5号玩家）
      { x: midX, y: height - 2 },  // 下中（6号玩家）
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
          player.maxBombs = Math.min(player.maxBombs + 1, 8)
          player.bombCount = Math.min(player.bombCount + 1, player.maxBombs)
          break
        case 'bomb_range':
          player.bombRange = Math.min(player.bombRange + 1, 8)
          break
        case 'speed':
          player.speed = Math.min(player.speed + 1, 6)
          break
        case 'kick':
          player.canKick = true
          break
        case 'shield':
          player.hasShield = true
          break
        case 'needle':
          player.needleCount++
          break
        case 'max_bomb':
          player.maxBombs = 8
          player.bombCount = 8
          break
        case 'max_range':
          player.bombRange = 8
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

  // 随机选择道具类型（加权概率）
  private randomPowerUpType(): PowerUpType {
    const weights: { type: PowerUpType; weight: number }[] = [
      { type: 'bomb_count', weight: 25 },   // 泡泡+1
      { type: 'bomb_range', weight: 25 },   // 药水
      { type: 'speed', weight: 20 },        // 溜冰鞋
      { type: 'kick', weight: 12 },         // 踢泡泡
      { type: 'shield', weight: 6 },        // 盾牌（稀有）
      { type: 'needle', weight: 5 },        // 针（稀有）
      { type: 'max_bomb', weight: 4 },      // 最大泡泡（非常稀有）
      { type: 'max_range', weight: 3 },     // 最大药水（非常稀有）
    ]
    
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const item of weights) {
      random -= item.weight
      if (random <= 0) return item.type
    }
    
    return 'bomb_count'
  }

  private handleExplosionEffects(room: Room, positions: Position[]): string[] {
    const chainBombIds: string[] = []
    if (!room.map) return chainBombIds

    for (const pos of positions) {
      // 摧毁砖块并可能生成道具
      const cell = room.map.cells[pos.y][pos.x]
      if (cell.type === 'brick') {
        room.map.cells[pos.y][pos.x] = { type: 'empty' }
        
        // 50%概率掉落道具
        if (Math.random() < 0.5) {
          const powerUp: PowerUp = {
            id: this.generateId(),
            type: this.randomPowerUpType(),
            position: { ...pos },
          }
          room.powerUps.push(powerUp)
        }
      }

      // 击杀玩家（盾牌保护）
      for (const player of room.players) {
        if (player.isAlive && player.position.x === pos.x && player.position.y === pos.y) {
          if (player.hasShield) {
            // 盾牌抵消一次伤害
            player.hasShield = false
          } else {
            player.isAlive = false
          }
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

  getPlayerRoom(playerId: string): string | undefined {
    return this.playerRooms.get(playerId)
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
