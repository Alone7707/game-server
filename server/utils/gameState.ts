import type { Room, Player, Card } from '~/types'
import { createDeck, dealCards, sortCards, analyzePattern, canBeat } from '~/utils/cards'
import { generateId, generateRoomCode, simpleHash } from '~/utils/helpers'

// In-memory game state storage
interface GameRoom extends Room {
  passwordHash?: string
  deck?: Card[]
  playerHands: Map<string, Card[]>
  currentPlayerIndex: number
  biddingIndex: number
  biddingPassed: number[]
  lastPlayerId?: string
  lastPlayedCards: Card[]
  passCount: number
  landlordId?: string
  landlordCards?: Card[]
  currentBid?: number
  biddingPlayer?: string
  currentTurn?: string
}

class GameStateManager {
  private rooms: Map<string, GameRoom> = new Map()
  private playerRooms: Map<string, string> = new Map() // playerId -> roomId
  
  createRoom(hostId: string, hostName: string, name: string, baseScore: number, password?: string): GameRoom {
    const roomId = generateRoomCode()
    
    const room: GameRoom = {
      id: roomId,
      name: name || `${hostName}的房间`,
      hostId,
      hostName,
      players: [{
        id: hostId,
        name: hostName,
        cards: [],
        isReady: true,  // 房主自动准备
        isLandlord: false,
        position: 'bottom',
      }],
      maxPlayers: 3,
      baseScore,
      hasPassword: !!password,
      passwordHash: password ? simpleHash(password) : undefined,
      status: 'waiting',
      playerHands: new Map(),
      currentPlayerIndex: 0,
      biddingIndex: 0,
      biddingPassed: [],
      lastPlayedCards: [],
      passCount: 0,
    }
    
    this.rooms.set(roomId, room)
    this.playerRooms.set(hostId, roomId)
    
    return room
  }
  
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId)
  }
  
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      hostName: room.hostName,
      players: room.players.map(p => ({
        ...p,
        cards: [], // Don't expose cards in room list
      })),
      maxPlayers: room.maxPlayers,
      baseScore: room.baseScore,
      hasPassword: room.hasPassword,
      status: room.status,
    }))
  }
  
  joinRoom(roomId: string, playerId: string, playerName: string, password?: string): { success: boolean; room?: GameRoom; error?: string } {
    const room = this.rooms.get(roomId)
    
    if (!room) {
      return { success: false, error: '房间不存在' }
    }
    
    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: '房间已满' }
    }
    
    if (room.status !== 'waiting') {
      return { success: false, error: '游戏已开始' }
    }
    
    if (room.hasPassword && room.passwordHash) {
      if (!password || simpleHash(password) !== room.passwordHash) {
        return { success: false, error: '密码错误' }
      }
    }
    
    // Check if player already in room
    if (room.players.some(p => p.id === playerId)) {
      return { success: true, room }
    }
    
    // Assign position
    const positions: Array<'left' | 'right' | 'bottom'> = ['left', 'right', 'bottom']
    const usedPositions = room.players.map(p => p.position)
    const availablePosition = positions.find(p => !usedPositions.includes(p)) || 'bottom'
    
    room.players.push({
      id: playerId,
      name: playerName,
      cards: [],
      isReady: false,
      isLandlord: false,
      position: availablePosition,
    })
    
    this.playerRooms.set(playerId, roomId)
    
    return { success: true, room }
  }
  
  leaveRoom(roomId: string, playerId: string): { deleted: boolean; room?: GameRoom } {
    const room = this.rooms.get(roomId)
    
    if (!room) {
      return { deleted: false }
    }
    
    room.players = room.players.filter(p => p.id !== playerId)
    this.playerRooms.delete(playerId)
    room.playerHands.delete(playerId)
    
    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      return { deleted: true }
    }
    
    // If host left, assign new host
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id
      room.hostName = room.players[0].name
    }
    
    // Reset game if in progress
    if (room.status !== 'waiting') {
      this.resetGame(roomId)
    }
    
    return { deleted: false, room }
  }
  
  setPlayerReady(roomId: string, playerId: string, isReady: boolean): GameRoom | undefined {
    const room = this.rooms.get(roomId)
    
    if (!room) return undefined
    
    const player = room.players.find(p => p.id === playerId)
    if (player) {
      player.isReady = isReady
    }
    
    return room
  }
  
  canStartGame(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false
    
    return room.players.length === 3 && room.players.every(p => p.isReady)
  }
  
  startGame(roomId: string): { room: GameRoom; hands: Map<string, Card[]>; firstBidder: string } | undefined {
    const room = this.rooms.get(roomId)
    
    if (!room || room.players.length !== 3) return undefined
    
    // Create and deal cards
    const deck = createDeck()
    const { hands, landlordCards } = dealCards(deck)
    
    room.deck = deck
    room.landlordCards = landlordCards
    room.status = 'bidding'
    room.currentPlayerIndex = 0
    room.biddingIndex = 0
    room.biddingPassed = []
    room.currentBid = 0
    room.passCount = 0
    room.lastPlayedCards = []
    
    // Assign cards to players
    room.players.forEach((player, index) => {
      player.cards = hands[index]
      player.isLandlord = false
      room.playerHands.set(player.id, hands[index])
    })
    
    // Random first bidder
    const firstBidderIndex = Math.floor(Math.random() * 3)
    room.biddingIndex = firstBidderIndex
    room.biddingPlayer = room.players[firstBidderIndex].id
    
    return {
      room,
      hands: room.playerHands,
      firstBidder: room.players[firstBidderIndex].id,
    }
  }
  
  handleBid(roomId: string, playerId: string, bid: number): { room: GameRoom; landlordSelected?: boolean; landlordId?: string } | undefined {
    const room = this.rooms.get(roomId)
    
    if (!room || room.status !== 'bidding') return undefined
    if (room.players[room.biddingIndex].id !== playerId) return undefined
    
    if (bid > 0) {
      room.currentBid = bid
      
      // If bid is 3, player becomes landlord immediately
      if (bid === 3) {
        return this.selectLandlord(roomId, playerId)
      }
    } else {
      // Pass
      room.biddingPassed.push(room.biddingIndex)
    }
    
    // Move to next player
    room.biddingIndex = (room.biddingIndex + 1) % 3
    room.biddingPlayer = room.players[room.biddingIndex].id
    
    // Check if bidding is complete
    // If 2 players passed, the remaining one with highest bid becomes landlord
    if (room.biddingPassed.length >= 2) {
      // Find the player who didn't pass and had highest bid
      const landlordIndex = [0, 1, 2].find(i => !room.biddingPassed.includes(i))
      if (landlordIndex !== undefined && room.currentBid! > 0) {
        return this.selectLandlord(roomId, room.players[landlordIndex].id)
      } else {
        // No one bid, restart
        this.resetGame(roomId)
        return { room }
      }
    }
    
    // If everyone has had a chance and we have a bid
    if (room.biddingIndex === room.biddingPassed[0] && room.currentBid! > 0) {
      // Find player with highest bid
      const activePlayers = [0, 1, 2].filter(i => !room.biddingPassed.includes(i))
      if (activePlayers.length > 0) {
        return this.selectLandlord(roomId, room.players[activePlayers[0]].id)
      }
    }
    
    return { room }
  }
  
  private selectLandlord(roomId: string, playerId: string): { room: GameRoom; landlordSelected: boolean; landlordId: string } | undefined {
    const room = this.rooms.get(roomId)
    
    if (!room) return undefined
    
    const landlord = room.players.find(p => p.id === playerId)
    if (!landlord) return undefined
    
    landlord.isLandlord = true
    room.landlordId = playerId
    room.status = 'playing'
    
    // Add landlord cards to landlord's hand
    const currentHand = room.playerHands.get(playerId) || []
    const newHand = sortCards([...currentHand, ...room.landlordCards!])
    room.playerHands.set(playerId, newHand)
    landlord.cards = newHand
    
    // Landlord plays first
    room.currentTurn = playerId
    const landlordIndex = room.players.findIndex(p => p.id === playerId)
    room.currentPlayerIndex = landlordIndex
    
    return { room, landlordSelected: true, landlordId: playerId }
  }
  
  handlePlay(roomId: string, playerId: string, cards: Card[]): { success: boolean; room?: GameRoom; error?: string; gameEnded?: boolean; winner?: string } {
    const room = this.rooms.get(roomId)
    
    if (!room || room.status !== 'playing') {
      return { success: false, error: '游戏未开始' }
    }
    
    if (room.currentTurn !== playerId) {
      return { success: false, error: '不是你的回合' }
    }
    
    const playerHand = room.playerHands.get(playerId)
    if (!playerHand) {
      return { success: false, error: '玩家不存在' }
    }
    
    // Validate cards are in player's hand
    const cardIds = new Set(cards.map(c => c.id))
    const hasAllCards = cards.every(c => playerHand.some(h => h.id === c.id))
    if (!hasAllCards) {
      return { success: false, error: '无效的牌' }
    }
    
    // Validate pattern
    const pattern = analyzePattern(cards)
    if (pattern.pattern === 'invalid') {
      return { success: false, error: '无效的牌型' }
    }
    
    // Check if can beat last played cards
    if (room.lastPlayedCards.length > 0 && room.lastPlayerId !== playerId) {
      if (!canBeat(cards, room.lastPlayedCards)) {
        return { success: false, error: '牌型不够大' }
      }
    }
    
    // Remove cards from hand
    const newHand = playerHand.filter(c => !cardIds.has(c.id))
    room.playerHands.set(playerId, newHand)
    
    const player = room.players.find(p => p.id === playerId)
    if (player) {
      player.cards = newHand
    }
    
    // Update last played
    room.lastPlayedCards = cards
    room.lastPlayerId = playerId
    room.passCount = 0
    
    // Check win condition
    if (newHand.length === 0) {
      room.status = 'finished'
      room.winner = playerId
      return { success: true, room, gameEnded: true, winner: playerId }
    }
    
    // Next player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % 3
    room.currentTurn = room.players[room.currentPlayerIndex].id
    
    return { success: true, room }
  }
  
  handlePass(roomId: string, playerId: string): { success: boolean; room?: GameRoom; error?: string } {
    const room = this.rooms.get(roomId)
    
    if (!room || room.status !== 'playing') {
      return { success: false, error: '游戏未开始' }
    }
    
    if (room.currentTurn !== playerId) {
      return { success: false, error: '不是你的回合' }
    }
    
    // Can only pass if there are last played cards and they're not yours
    if (room.lastPlayedCards.length === 0 || room.lastPlayerId === playerId) {
      return { success: false, error: '必须出牌' }
    }
    
    room.passCount++
    
    // If 2 players passed, reset last played
    if (room.passCount >= 2) {
      room.lastPlayedCards = []
      room.lastPlayerId = undefined
      room.passCount = 0
    }
    
    // Next player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % 3
    room.currentTurn = room.players[room.currentPlayerIndex].id
    
    return { success: true, room }
  }
  
  resetGame(roomId: string): GameRoom | undefined {
    const room = this.rooms.get(roomId)
    
    if (!room) return undefined
    
    room.status = 'waiting'
    room.currentTurn = undefined
    room.lastPlayedCards = []
    room.lastPlayerId = undefined
    room.landlordCards = undefined
    room.landlordId = undefined
    room.currentBid = 0
    room.biddingPlayer = undefined
    room.passCount = 0
    room.biddingPassed = []
    room.winner = undefined
    room.playerHands.clear()
    
    room.players.forEach(player => {
      player.cards = []
      player.isReady = false
      player.isLandlord = false
    })
    
    return room
  }
  
  getPlayerRoom(playerId: string): GameRoom | undefined {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return undefined
    return this.rooms.get(roomId)
  }
  
  quickJoin(playerId: string, playerName: string): { success: boolean; room?: GameRoom; error?: string } {
    // Find a waiting room with space
    for (const room of this.rooms.values()) {
      if (room.status === 'waiting' && room.players.length < 3 && !room.hasPassword) {
        return this.joinRoom(room.id, playerId, playerName)
      }
    }
    
    // No room available, create one
    const room = this.createRoom(playerId, playerName, `${playerName}的房间`, 1)
    return { success: true, room }
  }
  
  getPlayerHand(roomId: string, playerId: string): Card[] {
    const room = this.rooms.get(roomId)
    if (!room) return []
    return room.playerHands.get(playerId) || []
  }
}

// Export singleton instance
export const gameState = new GameStateManager()
