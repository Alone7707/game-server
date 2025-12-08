// 7鬼523 游戏规则
// 规则来源：中国民间流行的扑克牌游戏

import type { Card, Suit, Rank, CardPattern, PatternResult, RoomRules } from './types'

// 牌的点数值 - 7鬼523特殊顺序
// 7 > 大王 > 小王 > 5 > 2 > 3 > A > K > Q > J > 10 > 9 > 8 > 6 > 4
const RANK_VALUES: Record<Rank, number> = {
  '4': 1,    // 最小
  '6': 2,
  '8': 3,
  '9': 4,
  '10': 5,
  'J': 6,
  'Q': 7,
  'K': 8,
  'A': 9,
  '3': 10,
  '2': 11,
  '5': 12,
  'joker_small': 13,
  'joker_big': 14,
  '7': 15,   // 最大
}

// 花色优先级（同点数时比较花色）
// 黑桃 > 红桃 > 梅花 > 方片
const SUIT_VALUES: Record<Suit, number> = {
  'diamonds': 1,  // 方片最小
  'clubs': 2,     // 梅花
  'hearts': 3,    // 红桃
  'spades': 4,    // 黑桃最大
  'joker': 5,     // 王
}

// 分牌的分值（5=5分，10=10分，K=10分）
const POINT_VALUES: Record<Rank, number> = {
  '5': 5,
  '10': 10,
  'K': 10,
  // 其他牌都是0分
  '3': 0, '4': 0, '6': 0, '7': 0, '8': 0, '9': 0,
  'J': 0, 'Q': 0, 'A': 0, '2': 0,
  'joker_small': 0, 'joker_big': 0,
}

// 特殊牌（7、大小王、5、2、3）
const SPECIAL_RANKS: Rank[] = ['7', 'joker_big', 'joker_small', '5', '2', '3']

/**
 * 获取牌的比较值
 */
export function getCardValue(card: Card): number {
  return RANK_VALUES[card.rank]
}

/**
 * 获取花色优先级
 */
export function getSuitValue(card: Card): number {
  return SUIT_VALUES[card.suit]
}

/**
 * 计算一组牌的分值（捡分模式）
 */
export function calculatePoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + (POINT_VALUES[card.rank] || 0), 0)
}

/**
 * 比较两张牌的大小
 * 返回: 正数表示a大，负数表示b大，0表示相等
 */
export function compareCards(a: Card, b: Card): number {
  const valueDiff = getCardValue(a) - getCardValue(b)
  if (valueDiff !== 0) return valueDiff
  return getSuitValue(a) - getSuitValue(b)
}

/**
 * 对牌进行排序（从大到小）
 */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => -compareCards(a, b))
}

/**
 * 判断是否为特殊牌（7、大小王、5、2、3）
 */
export function isSpecialCard(card: Card): boolean {
  return SPECIAL_RANKS.includes(card.rank)
}

/**
 * 统计牌中各点数的数量
 */
function countByValue(cards: Card[]): Map<number, Card[]> {
  const counts = new Map<number, Card[]>()
  for (const card of cards) {
    const value = getCardValue(card)
    if (!counts.has(value)) {
      counts.set(value, [])
    }
    counts.get(value)!.push(card)
  }
  return counts
}

/**
 * 分析牌型
 * 牌型规则：
 * - 单张：1张牌
 * - 对子：2张相同点数
 * - 三张（炸弹）：3张相同点数
 * - 四张炸弹：4张相同点数
 * - 三带二：3张相同点数 + 2张相同点数
 */
export function analyzePattern(cards: Card[]): PatternResult {
  if (cards.length === 0) {
    return { pattern: 'invalid', mainValue: 0, cards: [] }
  }

  const sorted = sortCards(cards)
  const counts = countByValue(cards)
  
  // 单张
  if (cards.length === 1) {
    return {
      pattern: 'single',
      mainValue: getCardValue(cards[0]),
      cards: sorted,
    }
  }
  
  // 对子：2张相同点数
  if (cards.length === 2) {
    if (counts.size === 1) {
      return {
        pattern: 'pair',
        mainValue: getCardValue(cards[0]),
        cards: sorted,
      }
    }
    return { pattern: 'invalid', mainValue: 0, cards: [] }
  }
  
  // 三张（炸弹）：3张相同点数
  if (cards.length === 3) {
    if (counts.size === 1) {
      return {
        pattern: 'triple',
        mainValue: getCardValue(cards[0]),
        bombSize: 3,
        cards: sorted,
      }
    }
    return { pattern: 'invalid', mainValue: 0, cards: [] }
  }
  
  // 四张炸弹：4张相同点数
  if (cards.length === 4) {
    if (counts.size === 1) {
      return {
        pattern: 'bomb_4',
        mainValue: getCardValue(cards[0]),
        bombSize: 4,
        cards: sorted,
      }
    }
    return { pattern: 'invalid', mainValue: 0, cards: [] }
  }
  
  // 三带二：3张相同点数 + 2张相同点数
  if (cards.length === 5) {
    const entries = Array.from(counts.entries())
    if (entries.length === 2) {
      const [first, second] = entries
      // 检查是否是3+2的组合
      if ((first[1].length === 3 && second[1].length === 2) ||
          (first[1].length === 2 && second[1].length === 3)) {
        // 主牌是三张的那个
        const mainValue = first[1].length === 3 ? first[0] : second[0]
        return {
          pattern: 'three_with_two',
          mainValue,
          cards: sorted,
        }
      }
    }
    return { pattern: 'invalid', mainValue: 0, cards: [] }
  }
  
  return { pattern: 'invalid', mainValue: 0, cards: [] }
}

/**
 * 判断是否为炸弹牌型
 */
export function isBomb(pattern: CardPattern): boolean {
  return pattern === 'triple' || pattern === 'bomb_4'
}

/**
 * 判断出牌是否合法
 * 
 * 规则：
 * 1. 炸弹可以压任何非炸弹牌型
 * 2. 四张炸弹 > 三张炸弹
 * 3. 非炸弹必须出相同张数且更大的牌
 * 4. 首轮必须出包含最小牌的牌型
 */
export function isValidPlay(
  cards: Card[],
  lastPlay: { cards: Card[]; pattern: CardPattern; mainValue: number } | null,
  playerHand: Card[],
  mustIncludeSmallest: boolean = false  // 是否必须包含最小牌（首轮）
): { valid: boolean; reason?: string; pattern?: PatternResult } {
  
  if (cards.length === 0) {
    return { valid: false, reason: '请选择要出的牌' }
  }
  
  // 检查牌是否在手牌中
  const handIds = new Set(playerHand.map(c => c.id))
  if (!cards.every(c => handIds.has(c.id))) {
    return { valid: false, reason: '出牌不在手牌中' }
  }
  
  const pattern = analyzePattern(cards)
  
  // 检查牌型是否有效
  if (pattern.pattern === 'invalid') {
    return { valid: false, reason: '无效的牌型' }
  }
  
  // 首轮必须出包含最小牌的牌型
  if (mustIncludeSmallest) {
    const smallestCard = findSmallestCard(playerHand)
    if (smallestCard && !cards.some(c => c.id === smallestCard.id)) {
      return { valid: false, reason: `首轮必须出包含最小牌(${smallestCard.rank})的牌型` }
    }
  }
  
  // 如果是本轮第一个出牌，任何有效牌型都可以
  if (!lastPlay) {
    return { valid: true, pattern }
  }
  
  const lastIsBomb = isBomb(lastPlay.pattern)
  const currentIsBomb = isBomb(pattern.pattern)
  
  // 炸弹可以压任何非炸弹牌型
  if (currentIsBomb && !lastIsBomb) {
    return { valid: true, pattern }
  }
  
  // 非炸弹不能压炸弹
  if (!currentIsBomb && lastIsBomb) {
    return { valid: false, reason: '只有炸弹才能压炸弹' }
  }
  
  // 炸弹压炸弹：比较炸弹大小（4张 > 3张），相同张数比点数
  if (currentIsBomb && lastIsBomb) {
    const currentBombSize = pattern.bombSize || 3
    const lastBombSize = lastPlay.pattern === 'bomb_4' ? 4 : 3
    
    if (currentBombSize > lastBombSize) {
      return { valid: true, pattern }
    }
    if (currentBombSize < lastBombSize) {
      return { valid: false, reason: '炸弹太小' }
    }
    // 相同大小比点数
    if (pattern.mainValue <= lastPlay.mainValue) {
      return { valid: false, reason: '炸弹必须比上家大' }
    }
    return { valid: true, pattern }
  }
  
  // 非炸弹：必须张数相同且更大
  if (cards.length !== lastPlay.cards.length) {
    return { valid: false, reason: '张数必须与上家相同' }
  }
  
  // 比较大小
  if (pattern.mainValue < lastPlay.mainValue) {
    return { valid: false, reason: '必须比上家大' }
  }
  
  // 点数相同时，比较花色（仅对单张有效）
  if (pattern.mainValue === lastPlay.mainValue) {
    if (pattern.pattern === 'single' && lastPlay.pattern === 'single') {
      // 单张同点数比较花色
      const currentSuit = getSuitValue(cards[0])
      const lastSuit = getSuitValue(lastPlay.cards[0])
      if (currentSuit <= lastSuit) {
        return { valid: false, reason: '花色必须比上家大（黑桃>红桃>梅花>方块）' }
      }
    } else {
      // 其他牌型同点数不能出
      return { valid: false, reason: '必须比上家大' }
    }
  }
  
  return { valid: true, pattern }
}

/**
 * 找出手牌中最小的牌
 */
export function findSmallestCard(hand: Card[]): Card | null {
  if (hand.length === 0) return null
  return hand.reduce((smallest, card) => 
    compareCards(smallest, card) < 0 ? smallest : card
  )
}

/**
 * 判断是否可以pass
 */
export function canPass(
  lastPlay: { cards: Card[] } | null,
  isFirstInRound: boolean
): boolean {
  // 如果是本轮第一个出牌，不能pass
  if (isFirstInRound || !lastPlay) {
    return false
  }
  return true
}

/**
 * 获取牌型名称
 */
export function getPatternName(pattern: CardPattern): string {
  const names: Record<CardPattern, string> = {
    'single': '单张',
    'pair': '对子',
    'triple': '三张炸弹',
    'bomb_4': '四张炸弹',
    'three_with_two': '三带二',
    'invalid': '无效',
  }
  return names[pattern]
}

/**
 * 获取花色名称
 */
export function getSuitName(suit: Suit): string {
  const names: Record<Suit, string> = {
    'hearts': '红桃',
    'diamonds': '方块',
    'clubs': '梅花',
    'spades': '黑桃',
    'joker': '王',
  }
  return names[suit]
}

/**
 * 创建一副牌
 */
export function createDeck(): Card[] {
  const deck: Card[] = []
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const ranks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
  
  let id = 0
  
  // 普通牌
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `card_${id++}`,
        suit,
        rank,
        value: RANK_VALUES[rank],
      })
    }
  }
  
  // 大小王
  deck.push({
    id: `card_${id++}`,
    suit: 'joker',
    rank: 'joker_small',
    value: RANK_VALUES['joker_small'],
  })
  
  deck.push({
    id: `card_${id++}`,
    suit: 'joker',
    rank: 'joker_big',
    value: RANK_VALUES['joker_big'],
  })
  
  return deck
}

/**
 * 洗牌
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
