// 炸弹人游戏状态管理

import type { Room, Player, RoomRules, GameMap, Cell, Bomb, Explosion, PowerUp, Position, PowerUpType, Direction } from './types'
import { DEFAULT_RULES, PLAYER_COLORS } from './types'
import { PRESET_MAPS, getPresetMap, generateMapFromPreset } from './maps'

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
      isDying: false,
      dyingAt: null,
      position: { x: 1, y: 1 },
      bombCount: rules.initialBombs,
      maxBombs: rules.initialBombs,
      bombRange: rules.initialRange,
      speed: 1,
      color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
      team: null,  // 队伍（踢弹大战模式会分配）
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
      selectedMapId: 'classic',
      dropRate: 0.5,
      bombs: [],
      explosions: [],
      powerUps: [],
      winner: null,
      winnerTeam: null,
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
    const player = this.createPlayer(playerId, playerName, room.rules, playerIndex)
    
    // 踢弹大战模式：自动分配队伍（平衡两队人数）
    if (room.selectedMapId === 'kick_battle') {
      this.autoAssignTeam(room, player)
    }
    
    room.players.push(player)
    this.playerRooms.set(playerId, roomId)
    return { success: true, room }
  }

  // 自动分配队伍（加入人数少的队）
  private autoAssignTeam(room: Room, player: Player): void {
    const teamACount = room.players.filter(p => p.team === 'A').length
    const teamBCount = room.players.filter(p => p.team === 'B').length
    
    const teamAColors = ['#3b82f6', '#60a5fa', '#93c5fd']
    const teamBColors = ['#ef4444', '#f87171', '#fca5a5']
    
    if (teamACount <= teamBCount) {
      player.team = 'A'
      player.color = teamAColors[teamACount % teamAColors.length]
    } else {
      player.team = 'B'
      player.color = teamBColors[teamBCount % teamBColors.length]
    }
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

  // 选择地图（仅房主可操作）
  selectMap(playerId: string, mapId: string): { success: boolean; room?: Room; error?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room) return { success: false, error: '房间不存在' }
    if (room.phase !== 'waiting') return { success: false, error: '游戏已开始' }
    if (room.hostId !== playerId) return { success: false, error: '只有房主可以选择地图' }

    const preset = getPresetMap(mapId)
    if (!preset) return { success: false, error: '地图不存在' }

    const wasKickBattle = room.selectedMapId === 'kick_battle'
    const isKickBattle = mapId === 'kick_battle'
    room.selectedMapId = mapId
    
    // 切换到踢弹大战模式：自动分配队伍
    if (isKickBattle && !wasKickBattle) {
      this.autoAssignAllTeams(room)
    }
    // 从踢弹大战切换到其他模式：清除队伍
    else if (!isKickBattle && wasKickBattle) {
      this.clearAllTeams(room)
    }
    
    return { success: true, room }
  }

  // 给所有玩家自动分配队伍
  private autoAssignAllTeams(room: Room): void {
    const teamAColors = ['#3b82f6', '#60a5fa', '#93c5fd']
    const teamBColors = ['#ef4444', '#f87171', '#fca5a5']
    
    room.players.forEach((player, index) => {
      // 交替分配到A队和B队
      if (index % 2 === 0) {
        player.team = 'A'
        const teamAIndex = Math.floor(index / 2)
        player.color = teamAColors[teamAIndex % teamAColors.length]
      } else {
        player.team = 'B'
        const teamBIndex = Math.floor(index / 2)
        player.color = teamBColors[teamBIndex % teamBColors.length]
      }
    })
  }

  // 清除所有玩家的队伍
  private clearAllTeams(room: Room): void {
    room.players.forEach((player, index) => {
      player.team = null
      player.color = PLAYER_COLORS[index % PLAYER_COLORS.length]
    })
  }

  // 获取地图列表
  getMapList(): Array<{ id: string; name: string; icon: string; maxPlayers: number }> {
    return PRESET_MAPS.map(m => ({ id: m.id, name: m.name, icon: m.icon, maxPlayers: m.maxPlayers }))
  }

  // 选择队伍（踢弹大战模式）
  selectTeam(playerId: string, team: 'A' | 'B'): { success: boolean; room?: Room; error?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room) return { success: false, error: '房间不存在' }
    if (room.phase !== 'waiting') return { success: false, error: '游戏已开始' }
    
    // 只有踢弹大战模式才能选队伍
    if (room.selectedMapId !== 'kick_battle') {
      return { success: false, error: '当前地图不支持队伍模式' }
    }

    const player = room.players.find(p => p.id === playerId)
    if (!player) return { success: false, error: '玩家不存在' }

    // 检查队伍人数（每队最多3人）
    const teamCount = room.players.filter(p => p.team === team).length
    const isAlreadyInTeam = player.team === team
    if (!isAlreadyInTeam && teamCount >= 3) {
      return { success: false, error: `${team}队已满` }
    }

    player.team = team
    // 根据队伍分配颜色
    const teamAColors = ['#3b82f6', '#60a5fa', '#93c5fd']
    const teamBColors = ['#ef4444', '#f87171', '#fca5a5']
    const teamPlayers = room.players.filter(p => p.team === team)
    const colorIndex = teamPlayers.indexOf(player)
    player.color = team === 'A' 
      ? teamAColors[colorIndex % teamAColors.length]
      : teamBColors[colorIndex % teamBColors.length]

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

    // 使用预设地图
    const preset = getPresetMap(room.selectedMapId)
    if (!preset) return { success: false, error: '地图不存在' }
    if (room.players.length > preset.maxPlayers) {
      return { success: false, error: `该地图最多支持${preset.maxPlayers}人` }
    }

    const isKickBattleMode = preset.id === 'kick_battle'
    
    // 踢弹大战模式：检查队伍
    if (isKickBattleMode) {
      const teamAPlayers = room.players.filter(p => p.team === 'A')
      const teamBPlayers = room.players.filter(p => p.team === 'B')
      const noTeamPlayers = room.players.filter(p => p.team === null)
      
      if (noTeamPlayers.length > 0) {
        return { success: false, error: '还有玩家未选择队伍' }
      }
      if (teamAPlayers.length === 0 || teamBPlayers.length === 0) {
        return { success: false, error: '每队至少需要1名玩家' }
      }
    }

    room.map = generateMapFromPreset(preset)
    room.dropRate = preset.dropRate
    
    // 从地图布局中找出生点（按y坐标分组）
    const midY = Math.floor(preset.height / 2)
    const spawnPointsA: Position[] = []  // 上半部分出生点
    const spawnPointsB: Position[] = []  // 下半部分出生点
    const spawnPositions: Position[] = []
    
    for (let y = 0; y < preset.height; y++) {
      for (let x = 0; x < preset.width; x++) {
        if (preset.layout[y][x] === 'S') {
          const pos = { x, y }
          spawnPositions.push(pos)
          if (y < midY) {
            spawnPointsA.push(pos)
          } else {
            spawnPointsB.push(pos)
          }
        }
      }
    }

    // 设置玩家出生点
    let spawnIndexA = 0
    let spawnIndexB = 0

    room.players.forEach((player, index) => {
      // 踢弹大战模式：根据队伍分配出生点
      let spawn: Position
      if (isKickBattleMode) {
        if (player.team === 'A') {
          spawn = spawnPointsA[spawnIndexA % spawnPointsA.length]
          spawnIndexA++
        } else {
          spawn = spawnPointsB[spawnIndexB % spawnPointsB.length]
          spawnIndexB++
        }
      } else {
        spawn = spawnPositions[index] || spawnPositions[0]
        player.team = null
      }
      
      player.position = { x: spawn.x, y: spawn.y }
      player.isAlive = true
      player.isDying = false
      player.dyingAt = null
      player.bombCount = preset.initialBombs
      player.maxBombs = preset.initialBombs
      player.bombRange = preset.initialRange
      player.speed = 1
      player.canKick = isKickBattleMode  // 踢弹大战模式默认有踢泡泡能力
      player.hasShield = false
      player.needleCount = 0
      // 重置战绩
      player.kills = 0
      player.rescues = 0
    })

    room.phase = 'playing'
    room.gameStartedAt = Date.now()
    room.bombs = []
    room.explosions = []
    room.powerUps = []

    return { success: true, room }
  }

  // 玩家移动
  movePlayer(playerId: string, direction: Direction): { success: boolean; room?: Room; error?: string; kickedBomb?: Bomb; pushingBomb?: Bomb; direction?: Direction; rescuedPlayer?: Player } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'playing') return { success: false, error: '游戏未开始' }

    const player = room.players.find(p => p.id === playerId)
    if (!player || !player.isAlive || player.isDying) return { success: false, error: '玩家无法行动' }

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

    // 检查是否救援濒死队友
    const rescuedPlayer = this.checkRescueTeammate(room, player)

    // 检查是否捡到道具
    this.checkPowerUp(room, player)

    // 注意：不在移动时检测爆炸，只在爆炸发生瞬间判定
    // 这样玩家可以在爆炸动画期间安全通过（符合泡泡堂逻辑）

    return { success: true, room, rescuedPlayer }
  }

  // 检查并救援濒死队友
  private checkRescueTeammate(room: Room, player: Player): Player | undefined {
    if (!player.team) return undefined
    
    // 找到同位置的濒死队友
    const dyingTeammate = room.players.find(
      p => p.id !== player.id && 
           p.team === player.team && 
           p.isDying && 
           p.position.x === player.position.x && 
           p.position.y === player.position.y
    )
    
    if (dyingTeammate) {
      // 救活队友
      dyingTeammate.isDying = false
      dyingTeammate.dyingAt = null
      // 记录救援次数
      player.rescues++
      return dyingTeammate
    }
    
    return undefined
  }

  // 踢泡泡到尽头
  kickBombToEnd(roomId: string, bombId: string, direction: Direction): { success: boolean; room?: Room; bomb?: Bomb; hitSpike?: boolean } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    const bomb = room.bombs.find(b => b.id === bombId)
    if (!bomb) return { success: false }

    // 计算泡泡最终位置（一直滑到碰到障碍物）
    const finalPos = this.calculateKickEndPosition(room, bomb.position, direction, bombId)
    bomb.position = finalPos
    bomb.isMoving = false
    bomb.moveDirection = null

    // 检查是否停在地刺上
    const hitSpike = this.isBombOnSpike(room, finalPos)

    return { success: true, room, bomb, hitSpike }
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
      
      // 铁丝网可以穿过，继续移动
      // 地刺处停下（后续会触发爆炸）
      if (cell.type === 'spike') {
        currentPos = nextPos
        break // 停在地刺上
      }

      // 检查是否有其他炸弹
      if (room.bombs.some(b => b.id !== bombId && b.position.x === nextPos.x && b.position.y === nextPos.y)) {
        break // 碰到其他炸弹
      }

      // 检查是否有玩家（铁丝网隔开时可以继续）
      if (cell.type !== 'fence' && room.players.some(p => p.isAlive && p.position.x === nextPos.x && p.position.y === nextPos.y)) {
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
        
        // 检查是否碰到地刺，立即爆炸
        if (this.isBombOnSpike(room, newPos)) {
          explodedBombs.push(bomb.id)
          bomb.isMoving = false
          bomb.moveDirection = null
        }
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
    
    // 墙和砖块不能通过（但铁丝网和地刺可以）
    if (cell.type === 'wall' || cell.type === 'brick') {
      return false
    }

    // 其他炸弹不能通过
    if (room.bombs.some(b => b.id !== bombId && b.position.x === pos.x && b.position.y === pos.y)) {
      return false
    }

    // 玩家位置也停止（但铁丝网隔开的情况下可以继续）
    if (cell.type !== 'fence' && room.players.some(p => p.isAlive && p.position.x === pos.x && p.position.y === pos.y)) {
      return false
    }

    return true
  }

  // 检查炸弹是否在地刺上
  private isBombOnSpike(room: Room, pos: Position): boolean {
    if (!room.map) return false
    const cell = room.map.cells[pos.y]?.[pos.x]
    return cell?.type === 'spike'
  }

  // 使用针刺破泡泡
  useNeedle(playerId: string, direction: Direction): { success: boolean; room?: Room; poppedBomb?: Bomb; error?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'playing') return { success: false, error: '游戏未开始' }

    const player = room.players.find(p => p.id === playerId)
    if (!player || !player.isAlive || player.isDying) return { success: false, error: '玩家无法行动' }

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
    if (!player || !player.isAlive || player.isDying) return { success: false, error: '玩家无法行动' }

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

    // 处理爆炸效果并获取连锁炸弹（传入炸弹所有者ID用于统计击杀）
    const chainBombIds = this.handleExplosionEffects(room, explosionPositions, bomb.playerId)

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
    
    // 墙、砖块、铁丝网不能通过（玩家不能穿过铁丝网）
    if (cell.type === 'wall' || cell.type === 'brick' || cell.type === 'fence') {
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

  private handleExplosionEffects(room: Room, positions: Position[], bombOwnerId: string): string[] {
    const chainBombIds: string[] = []
    if (!room.map) return chainBombIds
    
    // 找到炸弹所有者
    const bombOwner = room.players.find(p => p.id === bombOwnerId)

    for (const pos of positions) {
      // 摧毁砖块并可能生成道具
      const cell = room.map.cells[pos.y][pos.x]
      if (cell.type === 'brick') {
        room.map.cells[pos.y][pos.x] = { type: 'empty' }
        
        // 根据地图配置的概率掉落道具
        if (Math.random() < room.dropRate) {
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
        if (player.isAlive && !player.isDying && player.position.x === pos.x && player.position.y === pos.y) {
          if (player.hasShield) {
            // 盾牌抵消一次伤害
            player.hasShield = false
          } else {
            // 队伍模式：检查是否有队友可以救援
            const hasTeammate = player.team && room.players.some(
              p => p.id !== player.id && p.team === player.team && p.isAlive && !p.isDying
            )
            
            // 记录击杀数（不算自杀，不算炸自己队友）
            if (bombOwner && bombOwner.id !== player.id && bombOwner.team !== player.team) {
              bombOwner.kills++
            }
            
            if (hasTeammate) {
              // 进入濒死状态
              player.isDying = true
              player.dyingAt = Date.now()
            } else {
              // 直接死亡
              player.isAlive = false
              player.isDying = false
              player.dyingAt = null
            }
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

  // 检查濒死玩家超时（6秒）
  checkDyingTimeout(roomId: string): { room?: Room; diedPlayers: Player[] } {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'playing') return { diedPlayers: [] }
    
    const DYING_TIMEOUT = 6000 // 6秒
    const now = Date.now()
    const diedPlayers: Player[] = []
    
    for (const player of room.players) {
      if (player.isDying && player.dyingAt && (now - player.dyingAt >= DYING_TIMEOUT)) {
        // 超时，玩家死亡
        player.isAlive = false
        player.isDying = false
        player.dyingAt = null
        diedPlayers.push(player)
      }
    }
    
    if (diedPlayers.length > 0) {
      this.checkGameEnd(room)
    }
    
    return { room, diedPlayers }
  }

  private checkGameEnd(room: Room): void {
    // 存活玩家：isAlive=true 且 不在濒死状态
    const alivePlayers = room.players.filter(p => p.isAlive && !p.isDying)
    
    // 检查是否是队伍模式（踢弹大战）
    const hasTeams = room.players.some(p => p.team !== null)
    
    if (hasTeams) {
      // 队伍模式：检查是否有一队全灭（濒死不算存活）
      const aliveTeamA = alivePlayers.filter(p => p.team === 'A')
      const aliveTeamB = alivePlayers.filter(p => p.team === 'B')
      
      if (aliveTeamA.length === 0 && aliveTeamB.length > 0) {
        // A队全灭，B队获胜
        room.phase = 'finished'
        room.winnerTeam = 'B'
        room.winner = null
      } else if (aliveTeamB.length === 0 && aliveTeamA.length > 0) {
        // B队全灭，A队获胜
        room.phase = 'finished'
        room.winnerTeam = 'A'
        room.winner = null
      } else if (aliveTeamA.length === 0 && aliveTeamB.length === 0) {
        // 平局
        room.phase = 'finished'
        room.winnerTeam = null
        room.winner = null
      }
    } else {
      // 个人模式：只剩1人或0人时结束
      if (alivePlayers.length <= 1) {
        room.phase = 'finished'
        room.winner = alivePlayers[0]?.id || null
        room.winnerTeam = null
      }
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
