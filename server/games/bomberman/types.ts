// 炸弹人游戏类型定义

export type GamePhase = 'waiting' | 'playing' | 'finished'

export type Direction = 'up' | 'down' | 'left' | 'right'

export type CellType = 'empty' | 'wall' | 'brick' | 'bomb' | 'explosion' | 'powerup'

export type PowerUpType = 'bomb_count' | 'bomb_range' | 'speed'

export interface Position {
  x: number
  y: number
}

export interface Player {
  id: string
  name: string
  socketId?: string
  isOnline: boolean
  isReady: boolean
  isAlive: boolean
  position: Position
  bombCount: number      // 当前可放置炸弹数
  maxBombs: number       // 最大炸弹数
  bombRange: number      // 炸弹爆炸范围
  speed: number          // 移动速度
  color: string          // 玩家颜色
}

export interface Bomb {
  id: string
  playerId: string
  position: Position
  range: number
  placedAt: number       // 放置时间戳
  explodeAt: number      // 爆炸时间戳
}

export interface Explosion {
  positions: Position[]
  createdAt: number
  expiresAt: number
}

export interface PowerUp {
  id: string
  type: PowerUpType
  position: Position
}

export interface Cell {
  type: CellType
  powerUp?: PowerUp
}

export interface GameMap {
  width: number
  height: number
  cells: Cell[][]
}

export interface RoomRules {
  playerCount: number    // 2-4人
  mapSize: 'small' | 'medium' | 'large'
  bombTimer: number      // 炸弹爆炸时间（毫秒）
  initialBombs: number   // 初始炸弹数
  initialRange: number   // 初始爆炸范围
}

export interface Room {
  id: string
  name: string
  password?: string
  hostId: string
  hostName: string
  rules: RoomRules
  players: Player[]
  phase: GamePhase
  map: GameMap | null
  bombs: Bomb[]
  explosions: Explosion[]
  powerUps: PowerUp[]
  winner: string | null
  createdAt: number
  gameStartedAt: number | null
}

// 玩家颜色
export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308']

// 默认规则
export const DEFAULT_RULES: RoomRules = {
  playerCount: 4,
  mapSize: 'medium',
  bombTimer: 3000,
  initialBombs: 1,
  initialRange: 2,
}
