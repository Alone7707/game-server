// 7鬼523 游戏状态管理
// 按照传统7鬼523规则实现

import type { Room, Player, Card, RoomRules, GamePhase, PlayRecord, CardPattern } from './types'
import { DEFAULT_RULES } from './types'
import { createDeck, shuffleDeck, sortCards, analyzePattern, isValidPlay, canPass, calculatePoints, findSmallestCard, compareCards } from './rules'

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

export class QiGui523StateManager {
  private rooms: Map<string, Room> = new Map()
  private playerRooms: Map<string, string> = new Map()

  // ============ 房间管理 ============

  createRoom(
    hostId: string,
    hostName: string,
    name: string,
    rules: Partial<RoomRules> = {},
    password?: string
  ): Room {
    const roomId = generateRoomId()
    
    const room: Room = {
      id: roomId,
      name: name || `${hostName}的房间`,
      hostId,
      hostName,
      password: password ? simpleHash(password) : undefined,
      hasPassword: !!password,
      rules: { ...DEFAULT_RULES, ...rules },
      players: [{
        id: hostId,
        name: hostName,
        hand: [],
        isReady: true,  // 房主默认准备
        isOnline: true,
        score: 0,
        position: 1,
      }],
      phase: 'waiting',
      deck: [],
      currentTurn: null,
      lastPlay: null,
      roundStarter: null,
      roundCards: [],
      playHistory: [],
      passCount: 0,
      turnOrder: [],
      firstRound: true,
      finishOrder: [],
      createdAt: Date.now(),
    }

    this.rooms.set(roomId, room)
    this.playerRooms.set(hostId, roomId)

    return room
  }

  joinRoom(
    roomId: string,
    playerId: string,
    playerName: string,
    password?: string
  ): { success: boolean; room?: Room; error?: string; isReconnect?: boolean; wasOffline?: boolean } {
    const room = this.rooms.get(roomId)

    if (!room) {
      return { success: false, error: '房间不存在' }
    }

    // 检查是否已在房间（重连）
    const existingPlayer = room.players.find(p => p.id === playerId)
    if (existingPlayer) {
      const wasOffline = !existingPlayer.isOnline
      existingPlayer.isOnline = true
      return { success: true, room, isReconnect: true, wasOffline }
    }

    // 检查房间状态
    if (room.phase !== 'waiting') {
      return { success: false, error: '游戏已开始' }
    }

    // 检查人数
    if (room.players.length >= room.rules.playerCount) {
      return { success: false, error: '房间已满' }
    }

    // 检查密码
    if (room.hasPassword && room.password) {
      if (!password || simpleHash(password) !== room.password) {
        return { success: false, error: '密码错误' }
      }
    }

    // 分配座位
    const usedPositions = new Set(room.players.map(p => p.position))
    let position = 1
    while (usedPositions.has(position)) position++

    room.players.push({
      id: playerId,
      name: playerName,
      hand: [],
      isReady: false,
      isOnline: true,
      score: 0,
      position,
    })

    this.playerRooms.set(playerId, roomId)
    return { success: true, room }
  }

  leaveRoom(playerId: string): { success: boolean; room?: Room; disbanded?: boolean } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false }

    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    // 游戏中离开标记为离线
    if (room.phase !== 'waiting') {
      const player = room.players.find(p => p.id === playerId)
      if (player) {
        player.isOnline = false
      }
      this.playerRooms.delete(playerId)
      
      // 检查是否所有玩家都离线了，如果是则销毁房间
      const allOffline = room.players.every(p => !p.isOnline)
      if (allOffline) {
        // 清理所有玩家的房间映射
        for (const p of room.players) {
          this.playerRooms.delete(p.id)
        }
        this.rooms.delete(roomId)
        return { success: true, disbanded: true }
      }
      
      return { success: true, room }
    }

    // 等待中直接移除
    room.players = room.players.filter(p => p.id !== playerId)
    this.playerRooms.delete(playerId)

    // 房间空了就解散
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

  // ============ 准备与开始 ============

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

  canStartGame(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false

    // 人数达到要求且所有人准备好
    return room.players.length === room.rules.playerCount &&
           room.players.every(p => p.isReady)
  }

  startGame(roomId: string): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false, error: '房间不存在' }

    if (!this.canStartGame(roomId)) {
      return { success: false, error: '条件不满足' }
    }

    // 初始化牌堆
    room.deck = shuffleDeck(createDeck())

    // 发牌
    for (const player of room.players) {
      player.hand = []
      player.score = 0
      for (let i = 0; i < room.rules.handSize; i++) {
        const card = room.deck.pop()
        if (card) {
          player.hand.push(card)
        }
      }
      player.hand = sortCards(player.hand)
    }

    // 设置出牌顺序（按座位顺序，逆时针）
    room.turnOrder = room.players
      .sort((a, b) => a.position - b.position)
      .map(p => p.id)

    // 找出拥有最小牌的玩家，首轮由该玩家先出
    let smallestCardPlayer: Player | null = null
    let smallestCard: Card | null = null
    
    for (const player of room.players) {
      const playerSmallest = findSmallestCard(player.hand)
      if (playerSmallest) {
        if (!smallestCard || compareCards(playerSmallest, smallestCard) < 0) {
          smallestCard = playerSmallest
          smallestCardPlayer = player
        }
      }
    }

    // 设置第一个出牌者
    room.currentTurn = smallestCardPlayer?.id || room.turnOrder[0]
    room.roundStarter = room.currentTurn
    room.phase = 'playing'
    room.lastPlay = null
    room.passCount = 0
    room.roundCards = []
    room.playHistory = []
    room.firstRound = true
    room.finishOrder = []

    return { success: true, room }
  }

  // ============ 出牌逻辑 ============

  playCards(
    playerId: string,
    cardIds: string[]
  ): { success: boolean; room?: Room; error?: string; roundWinner?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room) return { success: false, error: '房间不存在' }

    if (room.phase !== 'playing') {
      return { success: false, error: '游戏未在进行中' }
    }

    if (room.currentTurn !== playerId) {
      return { success: false, error: '不是你的回合' }
    }

    const player = room.players.find(p => p.id === playerId)
    if (!player) return { success: false, error: '玩家不存在' }

    // 获取要出的牌
    const cards = cardIds
      .map(id => player.hand.find(c => c.id === id))
      .filter((c): c is Card => !!c)

    if (cards.length !== cardIds.length) {
      return { success: false, error: '无效的牌' }
    }

    // 构建上一手出牌信息（用于验证）
    const lastPlayInfo = room.lastPlay && !room.lastPlay.passed ? {
      cards: room.lastPlay.cards,
      pattern: room.lastPlay.pattern,
      mainValue: analyzePattern(room.lastPlay.cards).mainValue,
    } : null

    // 首轮是否需要出最小牌
    const mustIncludeSmallest = room.firstRound && room.roundStarter === playerId

    // 验证出牌
    const validation = isValidPlay(cards, lastPlayInfo, player.hand, mustIncludeSmallest)
    if (!validation.valid) {
      return { success: false, error: validation.reason }
    }

    const pattern = validation.pattern!

    // 出牌
    player.hand = player.hand.filter(c => !cardIds.includes(c.id))

    // 记录本次出牌
    const playRecord: PlayRecord = {
      playerId,
      cards,
      pattern: pattern.pattern,
      passed: false,
    }
    room.lastPlay = playRecord
    room.playHistory.push(playRecord)  // 添加到出牌历史

    // 如果是本轮第一个出牌，记录出牌者
    if (!room.roundStarter) {
      room.roundStarter = playerId
    }

    // 将牌加入本轮牌堆（用于捡分）
    room.roundCards.push(...cards)
    room.passCount = 0

    // 首轮结束后标记为非首轮
    if (room.firstRound) {
      room.firstRound = false
    }

    // 检查是否出完牌
    if (player.hand.length === 0) {
      // 记录出完顺序
      if (!room.finishOrder.includes(playerId)) {
        room.finishOrder.push(playerId)
      }
      
      // 检查是否所有人都出完了
      const activePlayers = room.players.filter(p => p.hand.length > 0)
      if (activePlayers.length === 0) {
        // 游戏结束，结算本轮分数
        this.endRound(room)
        room.phase = 'finished'
        return { success: true, room, roundWinner: room.finishOrder[0] }
      }
      
      // 牌堆为空时，第一个出完牌的玩家触发清算
      if (room.deck.length === 0) {
        // 先结算本轮分数
        this.endRound(room)
        // 清算：没出完牌的玩家手上有多少分就倒扣多少分
        this.finalSettlement(room)
        room.phase = 'finished'
        return { success: true, room, roundWinner: playerId }
      }
    }

    // 下一个玩家
    this.nextTurn(room)

    return { success: true, room }
  }

  pass(playerId: string): { success: boolean; room?: Room; error?: string; roundWinner?: string } {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return { success: false, error: '未在房间中' }

    const room = this.rooms.get(roomId)
    if (!room) return { success: false, error: '房间不存在' }

    if (room.phase !== 'playing') {
      return { success: false, error: '游戏未在进行中' }
    }

    if (room.currentTurn !== playerId) {
      return { success: false, error: '不是你的回合' }
    }

    // 本轮第一个出牌者不能pass
    const isFirstInRound = room.roundStarter === playerId && !room.lastPlay
    if (!canPass(room.lastPlay, isFirstInRound)) {
      return { success: false, error: '你必须出牌' }
    }

    room.passCount++

    // 获取有效玩家数（还有手牌的玩家）
    const activePlayers = room.players.filter(p => p.hand.length > 0)

    // 如果除了最后出牌者外所有人都pass了，本轮结束
    if (room.passCount >= activePlayers.length - 1) {
      return this.endRound(room)
    }

    // 下一个玩家
    this.nextTurn(room)

    return { success: true, room }
  }

  // ============ 辅助方法 ============

  private drawCards(room: Room, player: Player): void {
    // 补到手牌上限
    while (player.hand.length < room.rules.handSize && room.deck.length > 0) {
      const card = room.deck.pop()
      if (card) {
        player.hand.push(card)
      }
    }
    player.hand = sortCards(player.hand)
  }

  private nextTurn(room: Room): void {
    if (!room.currentTurn) return

    const currentIndex = room.turnOrder.indexOf(room.currentTurn)
    let nextIndex = (currentIndex + 1) % room.turnOrder.length

    // 跳过已出完牌的玩家
    let attempts = 0
    while (attempts < room.turnOrder.length) {
      const nextPlayerId = room.turnOrder[nextIndex]
      const nextPlayer = room.players.find(p => p.id === nextPlayerId)
      
      if (nextPlayer && nextPlayer.hand.length > 0) {
        room.currentTurn = nextPlayerId
        return
      }
      
      nextIndex = (nextIndex + 1) % room.turnOrder.length
      attempts++
    }

    // 如果所有人都出完了，游戏结束
    room.phase = 'finished'
  }

  private endRound(room: Room): { success: boolean; room: Room; roundWinner?: string } {
    // 找出最后一个有效出牌的人（赢家）
    // lastPlay如果是passed就往前找
    let winnerId: string | undefined
    if (room.lastPlay && !room.lastPlay.passed) {
      winnerId = room.lastPlay.playerId
    } else {
      // 如果最后是pass，赢家就是roundStarter（本轮第一个出牌者）
      winnerId = room.roundStarter || undefined
    }
    
    // 赢家获得本轮分数（5=5分，10=10分，K=10分）
    if (winnerId) {
      const points = calculatePoints(room.roundCards)
      const winner = room.players.find(p => p.id === winnerId)
      if (winner) {
        winner.score += points
      }
    }

    // 补牌：赢家先补，然后按逆时针顺序补牌
    if (winnerId) {
      const winnerIndex = room.turnOrder.indexOf(winnerId)
      for (let i = 0; i < room.turnOrder.length; i++) {
        const playerIndex = (winnerIndex + i) % room.turnOrder.length
        const playerId = room.turnOrder[playerIndex]
        const player = room.players.find(p => p.id === playerId)
        if (player && player.hand.length > 0) {
          this.drawCards(room, player)
        }
      }
    }

    // 清空本轮状态
    room.roundCards = []
    room.playHistory = []  // 清空出牌历史
    room.lastPlay = null
    room.passCount = 0
    room.roundStarter = winnerId || null

    // 赢家先出下一轮
    if (winnerId) {
      const winner = room.players.find(p => p.id === winnerId)
      // 如果赢家已经出完牌，找下一个还有牌的玩家
      if (winner && winner.hand.length > 0) {
        room.currentTurn = winnerId
      } else {
        this.nextTurn(room)
      }
    }

    // 检查游戏是否结束（牌堆空了且所有人手牌都出完）
    const allHandsEmpty = room.players.every(p => p.hand.length === 0)
    if (room.deck.length === 0 && allHandsEmpty) {
      room.phase = 'finished'
    }

    return { success: true, room, roundWinner: winnerId }
  }

  /**
   * 最终清算：牌堆为空且有人出完牌时触发
   * 没出完牌的玩家手上有多少分就倒扣多少分
   */
  private finalSettlement(room: Room): void {
    for (const player of room.players) {
      if (player.hand.length > 0) {
        // 计算手牌中的分值（5=5分，10=10分，K=10分）
        const handPoints = calculatePoints(player.hand)
        // 倒扣分数
        player.score -= handPoints
      }
    }
  }

  // ============ 查询方法 ============

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId)
    return roomId ? this.rooms.get(roomId) : undefined
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  getPublicRoomList(): Array<{
    id: string
    name: string
    hostName: string
    hasPassword: boolean
    playerCount: number
    maxPlayers: number
    phase: GamePhase
    rules: RoomRules
  }> {
    return this.getAllRooms().map(room => ({
      id: room.id,
      name: room.name,
      hostName: room.hostName,
      hasPassword: room.hasPassword,
      playerCount: room.players.length,
      maxPlayers: room.rules.playerCount,
      phase: room.phase,
      rules: room.rules,
    }))
  }

  getPlayerHand(playerId: string): Card[] {
    const room = this.getRoomByPlayer(playerId)
    if (!room) return []
    
    const player = room.players.find(p => p.id === playerId)
    return player?.hand || []
  }

  // 获取房间公开数据（隐藏其他玩家手牌）
  getRoomPublicData(room: Room, forPlayerId?: string): any {
    return {
      ...room,
      deck: { count: room.deck.length },  // 只返回牌堆数量
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
        hand: p.id === forPlayerId ? p.hand : undefined,  // 只返回自己的手牌
        isReady: p.isReady,
        isOnline: p.isOnline,
        score: p.score,
        position: p.position,
      })),
    }
  }

  // 重置游戏（重新开始）
  resetGame(roomId: string): { success: boolean; room?: Room } {
    const room = this.rooms.get(roomId)
    if (!room) return { success: false }

    room.phase = 'waiting'
    room.deck = []
    room.currentTurn = null
    room.lastPlay = null
    room.roundStarter = null
    room.roundCards = []
    room.playHistory = []
    room.passCount = 0
    room.turnOrder = []
    room.firstRound = true
    room.finishOrder = []

    for (const player of room.players) {
      player.hand = []
      player.score = 0
      player.isReady = player.id === room.hostId  // 房主默认准备
    }

    return { success: true, room }
  }

  // 快速加入
  quickJoin(playerId: string, playerName: string): { success: boolean; room?: Room; error?: string; isReconnect?: boolean; wasOffline?: boolean } {
    // 查找可加入的房间
    for (const room of this.rooms.values()) {
      if (room.phase === 'waiting' && 
          !room.hasPassword && 
          room.players.length < room.rules.playerCount) {
        return this.joinRoom(room.id, playerId, playerName)
      }
    }
    return { success: false, error: '没有可加入的房间' }
  }
}

// 单例
export const qigui523State = new QiGui523StateManager()
