// Card types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker'
export type CardValue = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | 'joker_small' | 'joker_big'

export interface Card {
  id: string
  suit: Suit
  value: CardValue
  display: string
  weight: number
}

// Player types
export interface Player {
  id: string
  name: string
  avatar?: string
  cards: Card[]
  isReady: boolean
  isLandlord: boolean
  position: 'left' | 'right' | 'bottom' // relative to current player
}

// Room types
export type RoomStatus = 'waiting' | 'bidding' | 'playing' | 'finished'

export interface Room {
  id: string
  name: string
  hostId: string
  hostName: string
  players: Player[]
  maxPlayers: number
  baseScore: number
  hasPassword: boolean
  status: RoomStatus
  currentTurn?: string
  lastPlayedCards?: Card[]
  lastPlayerId?: string
  landlordCards?: Card[]
  currentBid?: number
  biddingPlayer?: string
  winner?: string
}

// Game action types
export type GameAction = 
  | 'join_room'
  | 'leave_room'
  | 'ready'
  | 'start_game'
  | 'bid'
  | 'pass_bid'
  | 'play_cards'
  | 'pass_play'

// Socket event types
export interface SocketEvents {
  // Client to server
  'room:create': { name: string; baseScore: number; password?: string }
  'room:join': { roomId: string; password?: string }
  'room:leave': { roomId: string }
  'room:ready': { roomId: string }
  'game:bid': { roomId: string; bid: number }
  'game:pass_bid': { roomId: string }
  'game:play': { roomId: string; cards: Card[] }
  'game:pass': { roomId: string }
  
  // Server to client
  'room:list': Room[]
  'room:updated': Room
  'room:joined': { room: Room; playerId: string }
  'room:left': { roomId: string }
  'room:error': { message: string }
  'game:started': { room: Room }
  'game:your_turn': { action: 'bid' | 'play' }
  'game:cards_played': { playerId: string; cards: Card[] }
  'game:bid_made': { playerId: string; bid: number }
  'game:landlord_selected': { playerId: string; landlordCards: Card[] }
  'game:ended': { winner: string; scores: Record<string, number> }
}

// Card pattern types for validation
export type CardPattern = 
  | 'single'           // 单张
  | 'pair'             // 对子
  | 'triple'           // 三张
  | 'triple_single'    // 三带一
  | 'triple_pair'      // 三带二
  | 'straight'         // 顺子
  | 'straight_pairs'   // 连对
  | 'plane'            // 飞机
  | 'plane_single'     // 飞机带单
  | 'plane_pair'       // 飞机带对
  | 'four_two'         // 四带二
  | 'bomb'             // 炸弹
  | 'rocket'           // 王炸
  | 'invalid'

export interface CardPatternResult {
  pattern: CardPattern
  mainValue: number
  length: number
}

// User session
export interface UserSession {
  id: string
  name: string
  roomId?: string
}
