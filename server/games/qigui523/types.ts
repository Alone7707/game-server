// 7鬼523 游戏类型定义

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker'
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | 'joker_small' | 'joker_big'

export interface Card {
  id: string
  suit: Suit
  rank: Rank
  value: number  // 用于比较大小
}

// 房间规则配置
export interface RoomRules {
  // 玩家人数（2-5人）
  playerCount: number
  
  // 每人手牌数量（默认5张）
  handSize: number
}

// 默认规则
export const DEFAULT_RULES: RoomRules = {
  playerCount: 4,
  handSize: 5,
}

export type GamePhase = 'waiting' | 'playing' | 'round_end' | 'finished'

export interface Player {
  id: string
  name: string
  hand: Card[]
  isReady: boolean
  isOnline: boolean
  score: number  // 捡分模式下的得分
  position: number  // 座位位置
}

export interface PlayRecord {
  playerId: string
  cards: Card[]
  pattern: CardPattern
  passed: boolean
}

export interface Room {
  id: string
  name: string
  hostId: string
  hostName: string
  password?: string
  hasPassword: boolean
  rules: RoomRules
  players: Player[]
  phase: GamePhase
  
  // 游戏状态
  deck: Card[]  // 牌堆
  currentTurn: string | null  // 当前出牌玩家ID
  lastPlay: PlayRecord | null  // 上一手有效出牌（非pass）
  roundStarter: string | null  // 本轮首个出牌者
  roundCards: Card[]  // 本轮桌面上的牌（用于捡分）
  passCount: number  // 连续pass次数
  turnOrder: string[]  // 出牌顺序（逆时针）
  firstRound: boolean  // 是否是游戏第一轮（需要出最小牌）
  finishOrder: string[]  // 出完牌的玩家顺序
  
  createdAt: number
}

// 牌型
// single: 单张
// pair: 对子（2张相同点数）
// triple: 三张（3张相同点数，也是炸弹）
// bomb_4: 四张炸弹（4张相同点数）
// three_with_two: 三带二
// straight: 顺子（暂不实现，规则中未明确）
export type CardPattern = 'single' | 'pair' | 'triple' | 'bomb_4' | 'three_with_two' | 'invalid'

export interface PatternResult {
  pattern: CardPattern
  mainValue: number  // 主要比较值（用于比较大小）
  bombSize?: number  // 炸弹大小（3或4）
  cards: Card[]
}
