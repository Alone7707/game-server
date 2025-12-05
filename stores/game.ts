import { defineStore } from 'pinia'
import type { Card, Player, CardPattern } from '~/types'
import { sortCards, analyzePattern } from '~/utils/cards'

export type GamePhase = 'waiting' | 'dealing' | 'bidding' | 'playing' | 'finished'

export interface GameState {
  phase: GamePhase
  myCards: Card[]
  selectedCards: Card[]
  landlordCards: Card[]
  currentTurn: string | null
  lastPlayedCards: Card[]
  lastPlayerId: string | null
  landlordId: string | null
  currentBid: number
  biddingPlayerId: string | null
  passCount: number
  multiplier: number
  winner: string | null
  scores: Record<string, number>
  isMyTurn: boolean
  canPass: boolean
  lastPattern: CardPattern | null
  playHistory: Array<{ playerId: string; playerName: string; cards: Card[]; passed: boolean }>
  opponentCardCounts: Record<string, number>
}

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    phase: 'waiting',
    myCards: [],
    selectedCards: [],
    landlordCards: [],
    currentTurn: null,
    lastPlayedCards: [],
    lastPlayerId: null,
    landlordId: null,
    currentBid: 0,
    biddingPlayerId: null,
    passCount: 0,
    multiplier: 1,
    winner: null,
    scores: {},
    isMyTurn: false,
    canPass: false,
    lastPattern: null,
    playHistory: [],
    opponentCardCounts: {},
  }),
  
  getters: {
    sortedCards: (state) => sortCards(state.myCards),
    selectedPattern: (state) => {
      if (state.selectedCards.length === 0) return null
      return analyzePattern(state.selectedCards)
    },
    isValidSelection: (state): boolean => {
      if (state.selectedCards.length === 0) return false
      const pattern = analyzePattern(state.selectedCards)
      return pattern.pattern !== 'invalid'
    },
    cardCount: (state) => state.myCards.length,
    isLandlord: (state) => (playerId: string) => state.landlordId === playerId,
  },
  
  actions: {
    setPhase(phase: GamePhase) {
      this.phase = phase
    },
    
    setMyCards(cards: Card[]) {
      this.myCards = sortCards(cards)
      this.selectedCards = []
    },
    
    addCards(cards: Card[]) {
      // 防止重复添加相同的牌
      const existingIds = new Set(this.myCards.map(c => c.id))
      const newCards = cards.filter(c => !existingIds.has(c.id))
      if (newCards.length > 0) {
        this.myCards = sortCards([...this.myCards, ...newCards])
      }
    },
    
    toggleCardSelection(card: Card) {
      const index = this.selectedCards.findIndex(c => c.id === card.id)
      if (index >= 0) {
        this.selectedCards.splice(index, 1)
      } else {
        this.selectedCards.push(card)
      }
    },
    
    clearSelection() {
      this.selectedCards = []
    },
    
    selectCards(cards: Card[]) {
      this.selectedCards = cards
    },
    
    removeCards(cards: Card[]) {
      const cardIds = new Set(cards.map(c => c.id))
      this.myCards = this.myCards.filter(c => !cardIds.has(c.id))
      this.selectedCards = []
    },
    
    setLandlordCards(cards: Card[]) {
      this.landlordCards = cards
    },
    
    setLandlord(playerId: string) {
      this.landlordId = playerId
      this.phase = 'playing'
    },
    
    setCurrentTurn(playerId: string, canPass: boolean = true) {
      this.currentTurn = playerId
      this.canPass = canPass
    },
    
    setIsMyTurn(isMyTurn: boolean) {
      this.isMyTurn = isMyTurn
    },
    
    setLastPlayed(playerId: string, cards: Card[]) {
      this.lastPlayedCards = cards
      this.lastPlayerId = playerId
      if (cards.length > 0) {
        this.lastPattern = analyzePattern(cards).pattern
        this.passCount = 0
      }
    },
    
    recordPass(playerId: string) {
      this.passCount++
      if (this.passCount >= 2) {
        // Everyone passed, reset for new round
        this.lastPlayedCards = []
        this.lastPlayerId = null
        this.lastPattern = null
        this.passCount = 0
      }
    },
    
    addToHistory(playerId: string, playerName: string, cards: Card[], passed: boolean = false) {
      this.playHistory.push({ playerId, playerName, cards, passed })
      // Keep only last 10 plays
      if (this.playHistory.length > 10) {
        this.playHistory.shift()
      }
    },
    
    setBidding(playerId: string, bid: number) {
      this.biddingPlayerId = playerId
      this.currentBid = bid
      if (bid > 0) {
        this.multiplier = bid
      }
    },
    
    setWinner(winner: string, scores: Record<string, number>) {
      this.winner = winner
      this.scores = scores
      this.phase = 'finished'
    },
    
    setOpponentCardCount(playerId: string, count: number) {
      this.opponentCardCounts[playerId] = count
    },
    
    initOpponentCardCounts(playerIds: string[], isLandlordId: string | null) {
      for (const id of playerIds) {
        // 地主20张牌，农民17张牌
        this.opponentCardCounts[id] = id === isLandlordId ? 20 : 17
      }
    },
    
    reset() {
      this.phase = 'waiting'
      this.myCards = []
      this.selectedCards = []
      this.landlordCards = []
      this.currentTurn = null
      this.lastPlayedCards = []
      this.lastPlayerId = null
      this.landlordId = null
      this.currentBid = 0
      this.biddingPlayerId = null
      this.passCount = 0
      this.multiplier = 1
      this.winner = null
      this.scores = {}
      this.isMyTurn = false
      this.canPass = false
      this.lastPattern = null
      this.playHistory = []
      this.opponentCardCounts = {}
    },
  },
})
