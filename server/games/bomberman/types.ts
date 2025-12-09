// 炸弹人游戏类型定义（泡泡堂风格）

export type GamePhase = 'waiting' | 'playing' | 'finished'

export type Direction = 'up' | 'down' | 'left' | 'right'

export type CellType = 'empty' | 'wall' | 'brick' | 'bomb' | 'explosion' | 'powerup'

// 道具类型
export type PowerUpType = 
  | 'bomb_count'    // 泡泡+1
  | 'bomb_range'    // 药水（范围+1）
  | 'speed'         // 溜冰鞋（速度+1）
  | 'kick'          // 踢泡泡
  | 'shield'        // 盾牌（免疫一次）
  | 'needle'        // 针（远程刺破泡泡）
  | 'max_bomb'      // 最大泡泡（一次性加满）
  | 'max_range'     // 最大药水（一次性加满）

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
  // 泡泡堂特殊能力
  canKick: boolean       // 能否踢泡泡
  hasShield: boolean     // 是否有盾牌
  needleCount: number    // 针的数量
  isTrapped: boolean     // 是否被困在泡泡中
  trappedAt: number | null  // 被困时间
}

export interface Bomb {
  id: string
  playerId: string
  position: Position
  range: number
  placedAt: number       // 放置时间戳
  explodeAt: number      // 爆炸时间戳
  isMoving: boolean      // 是否正在移动
  moveDirection: Direction | null  // 移动方向
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
  playerCount: number    // 2-6人
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
  selectedMapId: string  // 选择的地图ID
  dropRate: number       // 道具掉落概率
  bombs: Bomb[]
  explosions: Explosion[]
  powerUps: PowerUp[]
  winner: string | null
  createdAt: number
  gameStartedAt: number | null
}

// 玩家颜色
export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4']

// 默认规则
export const DEFAULT_RULES: RoomRules = {
  playerCount: 4,
  mapSize: 'medium',
  bombTimer: 3000,
  initialBombs: 1,
  initialRange: 2,
}
