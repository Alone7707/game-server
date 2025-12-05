import type { Card, Suit, CardValue, CardPattern, CardPatternResult } from '~/types'

// Card weight mapping for comparison
const cardWeights: Record<string, number> = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15,
  'joker_small': 16, 'joker_big': 17
}

// Card display mapping
const cardDisplays: Record<string, string> = {
  '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A', '2': '2',
  'joker_small': '小王', 'joker_big': '大王'
}

const suitSymbols: Record<Suit, string> = {
  'hearts': '♥',
  'diamonds': '♦',
  'clubs': '♣',
  'spades': '♠',
  'joker': '🃏'
}

// Create a standard 54-card deck for Dou Di Zhu
export function createDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const values: CardValue[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
  
  const cards: Card[] = []
  let id = 0
  
  // Add regular cards
  for (const suit of suits) {
    for (const value of values) {
      cards.push({
        id: `card_${id++}`,
        suit,
        value,
        display: cardDisplays[value],
        weight: cardWeights[value]
      })
    }
  }
  
  // Add jokers
  cards.push({
    id: `card_${id++}`,
    suit: 'joker',
    value: 'joker_small',
    display: '小王',
    weight: cardWeights['joker_small']
  })
  
  cards.push({
    id: `card_${id++}`,
    suit: 'joker',
    value: 'joker_big',
    display: '大王',
    weight: cardWeights['joker_big']
  })
  
  return cards
}

// Shuffle cards using Fisher-Yates algorithm
export function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Deal cards to 3 players (17 each) + 3 landlord cards
export function dealCards(deck: Card[]): { hands: Card[][]; landlordCards: Card[] } {
  const shuffled = shuffleDeck(deck)
  
  return {
    hands: [
      sortCards(shuffled.slice(0, 17)),
      sortCards(shuffled.slice(17, 34)),
      sortCards(shuffled.slice(34, 51))
    ],
    landlordCards: shuffled.slice(51, 54)
  }
}

// Sort cards by weight (descending)
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.weight - a.weight)
}

// Get suit symbol
export function getSuitSymbol(suit: Suit): string {
  return suitSymbols[suit]
}

// Check if suit is red
export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds' || suit === 'joker'
}

// Count cards by weight
function countByWeight(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const card of cards) {
    counts.set(card.weight, (counts.get(card.weight) || 0) + 1)
  }
  return counts
}

// Get cards sorted weights
function getSortedWeights(cards: Card[]): number[] {
  return [...new Set(cards.map(c => c.weight))].sort((a, b) => a - b)
}

// Check if weights form a consecutive sequence
function isConsecutive(weights: number[], length: number): boolean {
  if (weights.length !== length) return false
  // 2 and jokers cannot be in a straight
  if (weights.some(w => w >= 15)) return false
  for (let i = 1; i < weights.length; i++) {
    if (weights[i] - weights[i - 1] !== 1) return false
  }
  return true
}

// Analyze card pattern
export function analyzePattern(cards: Card[]): CardPatternResult {
  const n = cards.length
  if (n === 0) return { pattern: 'invalid', mainValue: 0, length: 0 }
  
  const counts = countByWeight(cards)
  const weights = getSortedWeights(cards)
  const countValues = Array.from(counts.values())
  
  // Rocket (pair of jokers)
  if (n === 2 && cards.every(c => c.suit === 'joker')) {
    return { pattern: 'rocket', mainValue: 17, length: 2 }
  }
  
  // Single
  if (n === 1) {
    return { pattern: 'single', mainValue: cards[0].weight, length: 1 }
  }
  
  // Pair
  if (n === 2 && countValues[0] === 2) {
    return { pattern: 'pair', mainValue: weights[0], length: 2 }
  }
  
  // Triple
  if (n === 3 && countValues[0] === 3) {
    return { pattern: 'triple', mainValue: weights[0], length: 3 }
  }
  
  // Bomb (4 of same)
  if (n === 4 && countValues[0] === 4) {
    return { pattern: 'bomb', mainValue: weights[0], length: 4 }
  }
  
  // Triple with single
  if (n === 4) {
    const tripleWeight = Array.from(counts.entries()).find(([_, count]) => count === 3)?.[0]
    if (tripleWeight !== undefined) {
      return { pattern: 'triple_single', mainValue: tripleWeight, length: 4 }
    }
  }
  
  // Triple with pair
  if (n === 5) {
    const tripleWeight = Array.from(counts.entries()).find(([_, count]) => count === 3)?.[0]
    const pairWeight = Array.from(counts.entries()).find(([_, count]) => count === 2)?.[0]
    if (tripleWeight !== undefined && pairWeight !== undefined) {
      return { pattern: 'triple_pair', mainValue: tripleWeight, length: 5 }
    }
  }
  
  // Straight (5+ consecutive singles)
  if (n >= 5 && countValues.every(c => c === 1) && isConsecutive(weights, n)) {
    return { pattern: 'straight', mainValue: weights[weights.length - 1], length: n }
  }
  
  // Straight pairs (3+ consecutive pairs)
  if (n >= 6 && n % 2 === 0 && countValues.every(c => c === 2)) {
    if (isConsecutive(weights, n / 2)) {
      return { pattern: 'straight_pairs', mainValue: weights[weights.length - 1], length: n }
    }
  }
  
  // Plane (2+ consecutive triples)
  if (n >= 6 && n % 3 === 0 && countValues.every(c => c === 3)) {
    if (isConsecutive(weights, n / 3)) {
      return { pattern: 'plane', mainValue: weights[weights.length - 1], length: n }
    }
  }
  
  // Plane with singles
  if (n >= 8 && n % 4 === 0) {
    const triples = Array.from(counts.entries())
      .filter(([_, count]) => count === 3)
      .map(([weight, _]) => weight)
      .sort((a, b) => a - b)
    
    if (triples.length === n / 4 && isConsecutive(triples, triples.length)) {
      return { pattern: 'plane_single', mainValue: triples[triples.length - 1], length: n }
    }
  }
  
  // Plane with pairs
  if (n >= 10 && n % 5 === 0) {
    const triples = Array.from(counts.entries())
      .filter(([_, count]) => count === 3)
      .map(([weight, _]) => weight)
      .sort((a, b) => a - b)
    
    const pairs = Array.from(counts.entries())
      .filter(([_, count]) => count === 2)
    
    if (triples.length === n / 5 && pairs.length === triples.length && isConsecutive(triples, triples.length)) {
      return { pattern: 'plane_pair', mainValue: triples[triples.length - 1], length: n }
    }
  }
  
  // Four with two singles or two pairs
  if (n === 6 || n === 8) {
    const fourWeight = Array.from(counts.entries()).find(([_, count]) => count === 4)?.[0]
    if (fourWeight !== undefined) {
      if (n === 6) {
        return { pattern: 'four_two', mainValue: fourWeight, length: n }
      }
      if (n === 8) {
        const otherCounts = Array.from(counts.entries())
          .filter(([w, _]) => w !== fourWeight)
          .map(([_, count]) => count)
        if (otherCounts.every(c => c === 2)) {
          return { pattern: 'four_two', mainValue: fourWeight, length: n }
        }
      }
    }
  }
  
  return { pattern: 'invalid', mainValue: 0, length: 0 }
}

// Check if cards can beat previous cards
export function canBeat(playedCards: Card[], lastCards: Card[]): boolean {
  const played = analyzePattern(playedCards)
  const last = analyzePattern(lastCards)
  
  if (played.pattern === 'invalid') return false
  
  // Rocket beats everything
  if (played.pattern === 'rocket') return true
  if (last.pattern === 'rocket') return false
  
  // Bomb beats non-bomb (except rocket)
  if (played.pattern === 'bomb' && last.pattern !== 'bomb') return true
  if (last.pattern === 'bomb' && played.pattern !== 'bomb') return false
  
  // Same pattern, same length, higher value
  if (played.pattern === last.pattern && played.length === last.length) {
    return played.mainValue > last.mainValue
  }
  
  return false
}

// Check if player has any valid play
export function hasValidPlay(hand: Card[], lastCards: Card[] | undefined): boolean {
  if (!lastCards || lastCards.length === 0) return true
  
  // Simple check: try to find any combination that can beat
  // This is a simplified version, full implementation would be more complex
  const lastPattern = analyzePattern(lastCards)
  
  // Check for rocket
  const jokers = hand.filter(c => c.suit === 'joker')
  if (jokers.length === 2) return true
  
  // Check for bombs
  const counts = countByWeight(hand)
  for (const [weight, count] of counts.entries()) {
    if (count === 4 && (lastPattern.pattern !== 'bomb' || weight > lastPattern.mainValue)) {
      return true
    }
  }
  
  // For same pattern, check if we have higher value
  if (lastPattern.pattern === 'single') {
    return hand.some(c => c.weight > lastPattern.mainValue)
  }
  
  if (lastPattern.pattern === 'pair') {
    for (const [weight, count] of counts.entries()) {
      if (count >= 2 && weight > lastPattern.mainValue) return true
    }
  }
  
  // Simplified: for other patterns, assume player might have valid play
  return true
}

// Generate card ID
export function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
