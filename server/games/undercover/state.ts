import { generateRoomCode, simpleHash } from '~/utils/helpers'
import { getRandomWordPair, type WordPair } from './words'

// 玩家角色
export type PlayerRole = 'civilian' | 'undercover' | 'unknown'

// 玩家状态
export type PlayerStatus = 'online' | 'describing' | 'voted' | 'eliminated'

// 游戏阶段
export type GamePhase = 'waiting' | 'describing' | 'voting' | 'result' | 'ended'

// 玩家信息
export interface UndercoverPlayer {
  id: string
  name: string
  role: PlayerRole
  word: string  // 该玩家拿到的词
  status: PlayerStatus
  isReady: boolean
  isAlive: boolean
  description: string  // 当前轮描述
  position: number  // 座位号 1-8
  votedFor?: string  // 投票给谁
}

// 投票记录
export interface VoteRecord {
  round: number
  votes: Record<string, string>  // voterId -> targetId
  result?: {
    eliminatedId?: string
    eliminatedRole?: PlayerRole
    isTie: boolean
  }
}

// 游戏房间
export interface UndercoverRoom {
  id: string
  name: string
  hostId: string
  hostName: string
  players: UndercoverPlayer[]
  maxPlayers: number  // 3-8
  minPlayers: number  // 最少3人
  hasPassword: boolean
  passwordHash?: string
  status: 'waiting' | 'playing' | 'finished'
  
  // 游戏设置
  doubleUndercover: boolean  // 双卧底模式(6人以上可开启)
  describeTime: number  // 描述时间(秒)
  voteTime: number  // 投票时间(秒)
  
  // 游戏状态
  phase: GamePhase
  currentRound: number
  wordPair?: WordPair  // 当前词组
  describeOrder: string[]  // 描述顺序(玩家ID列表)
  currentDescriber?: string  // 当前描述者ID
  describerIndex: number  // 当前描述者索引
  descriptions: Record<string, string>  // playerId -> description
  
  // 投票相关
  votes: Record<string, string>  // voterId -> targetId
  voteHistory: VoteRecord[]
  noVoteRounds: number  // 连续无人被投出的轮数
  
  // 计时器
  phaseEndTime?: number  // 当前阶段结束时间戳
  
  // 胜利者
  winner?: 'civilian' | 'undercover' | 'draw'
}

class UndercoverStateManager {
  private rooms: Map<string, UndercoverRoom> = new Map()
  private playerRooms: Map<string, string> = new Map()  // playerId -> roomId
  
  createRoom(hostId: string, hostName: string, name: string, password?: string): UndercoverRoom {
    const roomId = generateRoomCode()
    
    const room: UndercoverRoom = {
      id: roomId,
      name: name || `${hostName}的房间`,
      hostId,
      hostName,
      players: [{
        id: hostId,
        name: hostName,
        role: 'unknown',
        word: '',
        status: 'online',
        isReady: true,
        isAlive: true,
        description: '',
        position: 1,
      }],
      maxPlayers: 8,
      minPlayers: 3,
      hasPassword: !!password,
      passwordHash: password ? simpleHash(password) : undefined,
      status: 'waiting',
      
      doubleUndercover: false,
      describeTime: 30,
      voteTime: 20,
      
      phase: 'waiting',
      currentRound: 0,
      describeOrder: [],
      describerIndex: 0,
      descriptions: {},
      votes: {},
      voteHistory: [],
      noVoteRounds: 0,
    }
    
    this.rooms.set(roomId, room)
    this.playerRooms.set(hostId, roomId)
    
    return room
  }
  
  getRoom(roomId: string): UndercoverRoom | undefined {
    return this.rooms.get(roomId)
  }
  
  getAllRooms(): UndercoverRoom[] {
    return Array.from(this.rooms.values()).map(room => ({
      ...room,
      players: room.players.map(p => ({
        ...p,
        word: '',  // 不暴露词语
        role: 'unknown' as PlayerRole,
      })),
      wordPair: undefined,
    }))
  }
  
  joinRoom(roomId: string, playerId: string, playerName: string, password?: string): { success: boolean; room?: UndercoverRoom; error?: string } {
    const room = this.rooms.get(roomId)
    
    if (!room) return { success: false, error: '房间不存在' }
    
    // 优先检查是否已在房间（重连逻辑）
    if (room.players.some(p => p.id === playerId)) {
      return { success: true, room }
    }

    if (room.players.length >= room.maxPlayers) return { success: false, error: '房间已满' }
    if (room.status !== 'waiting') return { success: false, error: '游戏已开始' }
    
    if (room.hasPassword && room.passwordHash) {
      if (!password || simpleHash(password) !== room.passwordHash) {
        return { success: false, error: '密码错误' }
      }
    }
    
    // 分配座位
    const usedPositions = new Set(room.players.map(p => p.position))
    let position = 1
    while (usedPositions.has(position) && position <= 8) position++
    
    room.players.push({
      id: playerId,
      name: playerName,
      role: 'unknown',
      word: '',
      status: 'online',
      isReady: false,
      isAlive: true,
      description: '',
      position,
    })
    
    this.playerRooms.set(playerId, roomId)
    return { success: true, room }
  }
  
  leaveRoom(roomId: string, playerId: string): { deleted: boolean; room?: UndercoverRoom } {
    const room = this.rooms.get(roomId)
    if (!room) return { deleted: false }
    
    room.players = room.players.filter(p => p.id !== playerId)
    this.playerRooms.delete(playerId)
    
    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      return { deleted: true }
    }
    
    // 换房主
    if (room.hostId === playerId) {
      room.hostId = room.players[0].id
      room.hostName = room.players[0].name
    }
    
    // 游戏中有人离开，结束游戏
    if (room.status === 'playing') {
      this.endGame(roomId, 'draw')
    }
    
    return { deleted: false, room }
  }
  
  setPlayerReady(roomId: string, playerId: string, isReady: boolean): UndercoverRoom | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    
    const player = room.players.find(p => p.id === playerId)
    if (player) player.isReady = isReady
    
    return room
  }
  
  updateSettings(roomId: string, settings: { doubleUndercover?: boolean; describeTime?: number; voteTime?: number }): UndercoverRoom | undefined {
    const room = this.rooms.get(roomId)
    if (!room || room.status !== 'waiting') return undefined
    
    if (settings.doubleUndercover !== undefined) {
      room.doubleUndercover = settings.doubleUndercover && room.players.length >= 6
    }
    if (settings.describeTime) room.describeTime = Math.max(15, Math.min(60, settings.describeTime))
    if (settings.voteTime) room.voteTime = Math.max(10, Math.min(30, settings.voteTime))
    
    return room
  }
  
  canStartGame(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false
    return room.players.length >= room.minPlayers && room.players.every(p => p.isReady)
  }
  
  startGame(roomId: string): UndercoverRoom | undefined {
    const room = this.rooms.get(roomId)
    if (!room || room.players.length < room.minPlayers) return undefined
    
    // 获取词组
    const wordPair = getRandomWordPair()
    room.wordPair = wordPair
    room.status = 'playing'
    room.currentRound = 1
    room.noVoteRounds = 0
    room.voteHistory = []
    
    // 分配角色
    const playerCount = room.players.length
    const undercoverCount = room.doubleUndercover && playerCount >= 6 ? 2 : 1
    
    // 随机选择卧底
    const indices = room.players.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    
    const undercoverIndices = new Set(indices.slice(0, undercoverCount))
    
    room.players.forEach((player, index) => {
      if (undercoverIndices.has(index)) {
        player.role = 'undercover'
        player.word = wordPair.undercover
      } else {
        player.role = 'civilian'
        player.word = wordPair.civilian
      }
      player.isAlive = true
      player.status = 'online'
      player.description = ''
      player.votedFor = undefined
    })
    
    // 设置描述顺序(按座位号)
    room.describeOrder = room.players
      .filter(p => p.isAlive)
      .sort((a, b) => a.position - b.position)
      .map(p => p.id)
    
    room.describerIndex = 0
    room.descriptions = {}
    room.votes = {}
    
    // 进入描述阶段
    this.startDescribePhase(roomId)
    
    return room
  }
  
  private startDescribePhase(roomId: string) {
    const room = this.rooms.get(roomId)
    if (!room) return
    
    room.phase = 'describing'
    room.descriptions = {}
    room.describerIndex = 0
    
    // 更新描述顺序(只包含存活玩家)
    room.describeOrder = room.players
      .filter(p => p.isAlive)
      .sort((a, b) => a.position - b.position)
      .map(p => p.id)
    
    if (room.describeOrder.length > 0) {
      room.currentDescriber = room.describeOrder[0]
      const describer = room.players.find(p => p.id === room.currentDescriber)
      if (describer) describer.status = 'describing'
    }
    
    // 设置阶段结束时间
    room.phaseEndTime = Date.now() + room.describeTime * 1000
  }
  
  submitDescription(roomId: string, playerId: string, description: string): { success: boolean; room?: UndercoverRoom; allSubmitted?: boolean; error?: string } {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'describing') {
      return { success: false, error: '当前不是描述阶段' }
    }
    
    const player = room.players.find(p => p.id === playerId)
    if (!player || !player.isAlive) {
      return { success: false, error: '玩家不存在或已淘汰' }
    }
    
    // 检查描述是否包含词语中的字
    if (room.wordPair) {
      const word = player.word
      for (const char of word) {
        if (description.includes(char)) {
          return { success: false, error: `描述不能包含词语中的字"${char}"` }
        }
      }
    }
    
    // 保存描述
    room.descriptions[playerId] = description.trim()
    player.description = description.trim()
    player.status = 'voted'  // 标记已提交
    
    // 检查是否所有存活玩家都提交了
    const alivePlayers = room.players.filter(p => p.isAlive)
    const allSubmitted = alivePlayers.every(p => room.descriptions[p.id])
    
    return { success: true, room, allSubmitted }
  }
  
  startVotePhase(roomId: string): UndercoverRoom | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    
    room.phase = 'voting'
    room.votes = {}
    room.phaseEndTime = Date.now() + room.voteTime * 1000
    
    // 重置玩家状态
    room.players.forEach(p => {
      if (p.isAlive) {
        p.status = 'online'
        p.votedFor = undefined
      }
    })
    
    return room
  }
  
  submitVote(roomId: string, voterId: string, targetId: string): { success: boolean; room?: UndercoverRoom; allVoted?: boolean; error?: string } {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'voting') {
      return { success: false, error: '当前不是投票阶段' }
    }
    
    const voter = room.players.find(p => p.id === voterId)
    const target = room.players.find(p => p.id === targetId)
    
    if (!voter || !voter.isAlive) {
      return { success: false, error: '你已被淘汰' }
    }
    if (!target || !target.isAlive) {
      return { success: false, error: '目标玩家不存在或已淘汰' }
    }
    if (voterId === targetId) {
      return { success: false, error: '不能投自己' }
    }
    
    room.votes[voterId] = targetId
    voter.votedFor = targetId
    voter.status = 'voted'
    
    // 检查是否所有存活玩家都投票了
    const alivePlayers = room.players.filter(p => p.isAlive)
    const allVoted = alivePlayers.every(p => room.votes[p.id])
    
    return { success: true, room, allVoted }
  }
  
  processVoteResult(roomId: string): { room: UndercoverRoom; eliminated?: UndercoverPlayer; isTie: boolean; gameEnded: boolean; winner?: string } | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    
    // 统计票数
    const voteCounts: Record<string, number> = {}
    for (const targetId of Object.values(room.votes)) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1
    }
    
    // 找出最高票数
    let maxVotes = 0
    let maxVotedIds: string[] = []
    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count
        maxVotedIds = [playerId]
      } else if (count === maxVotes) {
        maxVotedIds.push(playerId)
      }
    }
    
    const isTie = maxVotedIds.length > 1 || maxVotes === 0
    let eliminated: UndercoverPlayer | undefined
    
    if (!isTie && maxVotedIds.length === 1) {
      const eliminatedId = maxVotedIds[0]
      eliminated = room.players.find(p => p.id === eliminatedId)
      if (eliminated) {
        eliminated.isAlive = false
        eliminated.status = 'eliminated'
      }
      room.noVoteRounds = 0
    } else {
      room.noVoteRounds++
    }
    
    // 记录投票历史
    room.voteHistory.push({
      round: room.currentRound,
      votes: { ...room.votes },
      result: {
        eliminatedId: eliminated?.id,
        eliminatedRole: eliminated?.role,
        isTie,
      },
    })
    
    // 检查游戏是否结束
    const gameEndResult = this.checkGameEnd(roomId)
    
    if (gameEndResult.ended) {
      room.phase = 'ended'
      room.status = 'finished'
      room.winner = gameEndResult.winner
      return { room, eliminated, isTie, gameEnded: true, winner: gameEndResult.winner }
    }
    
    // 进入结果展示阶段
    room.phase = 'result'
    
    return { room, eliminated, isTie, gameEnded: false }
  }
  
  private checkGameEnd(roomId: string): { ended: boolean; winner?: 'civilian' | 'undercover' | 'draw' } {
    const room = this.rooms.get(roomId)
    if (!room) return { ended: true, winner: 'draw' }
    
    const alivePlayers = room.players.filter(p => p.isAlive)
    const aliveUndercovers = alivePlayers.filter(p => p.role === 'undercover')
    const aliveCivilians = alivePlayers.filter(p => p.role === 'civilian')
    
    // 所有卧底被淘汰 -> 平民胜利
    if (aliveUndercovers.length === 0) {
      return { ended: true, winner: 'civilian' }
    }
    
    // 存活人数 <= 3（含卧底）-> 卧底胜利
    if (alivePlayers.length <= 3 && aliveUndercovers.length > 0) {
      return { ended: true, winner: 'undercover' }
    }
    
    // 连续2轮无人被投出 -> 平局
    if (room.noVoteRounds >= 2) {
      return { ended: true, winner: 'draw' }
    }
    
    return { ended: false }
  }
  
  nextRound(roomId: string): UndercoverRoom | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    
    room.currentRound++
    room.descriptions = {}
    room.votes = {}
    
    // 重置存活玩家状态
    room.players.forEach(p => {
      if (p.isAlive) {
        p.status = 'online'
        p.description = ''
        p.votedFor = undefined
      }
    })
    
    // 开始新的描述阶段
    this.startDescribePhase(roomId)
    
    return room
  }
  
  private endGame(roomId: string, winner: 'civilian' | 'undercover' | 'draw') {
    const room = this.rooms.get(roomId)
    if (!room) return
    
    room.phase = 'ended'
    room.status = 'finished'
    room.winner = winner
  }
  
  resetGame(roomId: string): UndercoverRoom | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    
    room.status = 'waiting'
    room.phase = 'waiting'
    room.currentRound = 0
    room.wordPair = undefined
    room.describeOrder = []
    room.currentDescriber = undefined
    room.describerIndex = 0
    room.descriptions = {}
    room.votes = {}
    room.voteHistory = []
    room.noVoteRounds = 0
    room.winner = undefined
    room.phaseEndTime = undefined
    
    room.players.forEach(p => {
      p.role = 'unknown'
      p.word = ''
      p.status = 'online'
      p.isReady = p.id === room.hostId
      p.isAlive = true
      p.description = ''
      p.votedFor = undefined
    })
    
    return room
  }
  
  getPlayerRoom(playerId: string): UndercoverRoom | undefined {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return undefined
    return this.rooms.get(roomId)
  }
  
  quickJoin(playerId: string, playerName: string): { success: boolean; room?: UndercoverRoom; error?: string } {
    for (const room of this.rooms.values()) {
      if (room.status === 'waiting' && room.players.length < room.maxPlayers && !room.hasPassword) {
        return this.joinRoom(room.id, playerId, playerName)
      }
    }
    
    const room = this.createRoom(playerId, playerName, `${playerName}的房间`)
    return { success: true, room }
  }
}

export const undercoverState = new UndercoverStateManager()
