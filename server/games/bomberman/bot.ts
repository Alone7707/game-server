// 炸弹人 AI 机器人逻辑

import type { Room, Player, Position, Direction, Bomb } from './types'
import { bombermanState } from './state'

// AI 难度配置
const DIFFICULTY_CONFIG = {
  easy: {
    reactionTime: 400,    // 反应时间（毫秒）
    bombChance: 0.4,      // 放炸弹基础概率
    bombChanceNearTarget: 0.7,  // 靠近目标时放炸弹概率
    smartEscape: 0.5,     // 智能逃跑概率（否则随机）
    chasePlayer: false,   // 是否追击玩家
  },
  normal: {
    reactionTime: 250,
    bombChance: 0.5,
    bombChanceNearTarget: 0.85,
    smartEscape: 0.8,
    chasePlayer: true,
  },
  hard: {
    reactionTime: 150,
    bombChance: 0.6,
    bombChanceNearTarget: 0.95,
    smartEscape: 1.0,
    chasePlayer: true,
  },
}

type Difficulty = keyof typeof DIFFICULTY_CONFIG

// AI 管理器
class BotManager {
  private botIntervals: Map<string, NodeJS.Timeout> = new Map()  // roomId -> interval
  private lastActions: Map<string, number> = new Map()  // botId -> timestamp

  // 启动房间的 AI
  startBots(roomId: string, onAction: (botId: string, action: BotAction) => void) {
    // 先停止旧的
    this.stopBots(roomId)

    const interval = setInterval(() => {
      const room = bombermanState.getRoom(roomId)
      if (!room || room.phase !== 'playing') {
        this.stopBots(roomId)
        return
      }

      // 处理每个机器人
      for (const player of room.players) {
        if (!player.isBot || !player.isAlive || player.isDying) continue

        const difficulty = this.getBotDifficulty(player.name)
        const config = DIFFICULTY_CONFIG[difficulty]

        // 检查反应时间
        const lastAction = this.lastActions.get(player.id) || 0
        if (Date.now() - lastAction < config.reactionTime) continue

        // 决定行动
        const action = this.decideBotAction(room, player, difficulty)
        if (action) {
          this.lastActions.set(player.id, Date.now())
          onAction(player.id, action)
        }
      }
    }, 100)  // 每100ms检查一次

    this.botIntervals.set(roomId, interval)
  }

  // 停止房间的 AI
  stopBots(roomId: string) {
    const interval = this.botIntervals.get(roomId)
    if (interval) {
      clearInterval(interval)
      this.botIntervals.delete(roomId)
    }
  }

  // 从机器人名字解析难度
  private getBotDifficulty(name: string): Difficulty {
    if (name.includes('[简单]')) return 'easy'
    if (name.includes('[困难]')) return 'hard'
    return 'normal'
  }

  // AI 决策
  private decideBotAction(room: Room, bot: Player, difficulty: Difficulty): BotAction | null {
    const config = DIFFICULTY_CONFIG[difficulty]
    
    // 调试日志
    console.log(`[BOT] ${bot.name} 决策中... bombCount=${bot.bombCount}, pos=(${bot.position.x},${bot.position.y})`)
    
    // 1. 最高优先级：检查是否在危险区域，需要逃跑
    const dangerPositions = this.getDangerPositions(room)
    const isInDanger = dangerPositions.some(p => p.x === bot.position.x && p.y === bot.position.y)

    if (isInDanger) {
      console.log(`[BOT] ${bot.name} 在危险区域，尝试逃跑`)
      // 逃跑！
      const escapeDir = this.findEscapeDirection(room, bot, dangerPositions, config.smartEscape)
      if (escapeDir) {
        return { type: 'move', direction: escapeDir }
      }
      // 无路可逃，随便动
      const anyDir = this.getRandomSafeDirection(room, bot)
      if (anyDir) {
        return { type: 'move', direction: anyDir }
      }
      return null
    }

    // 2. 检查是否应该放炸弹（优先级高于追击）
    if (bot.bombCount > 0) {
      const hasTarget = this.hasTargetNearby(room, bot)
      const canEscape = this.canEscapeAfterBomb(room, bot)
      // 靠近目标时用更高的概率放炸弹
      const bombChance = hasTarget ? config.bombChanceNearTarget : config.bombChance
      const roll = Math.random()
      
      
      if (hasTarget && canEscape && roll < bombChance) {
        return { type: 'bomb' }
      }
    } else {
    }

    // 3. 追击玩家或者走向道具
    if (config.chasePlayer) {
      const targetDir = this.findTargetDirection(room, bot, dangerPositions)
      if (targetDir) {
        return { type: 'move', direction: targetDir }
      }
    }

    // 4. 没目标时也随机放炸弹炸砖块
    if (bot.bombCount > 0 && Math.random() < config.bombChance * 0.5) {
      if (this.canEscapeAfterBomb(room, bot) && this.hasBrickNearby(room, bot)) {
        return { type: 'bomb' }
      }
    }

    // 5. 随机移动（避免站着不动）
    if (Math.random() < 0.5) {
      const randomDir = this.getRandomSafeDirection(room, bot, dangerPositions)
      if (randomDir) {
        return { type: 'move', direction: randomDir }
      }
    }

    return null
  }

  // 获取所有危险位置（炸弹爆炸范围）
  private getDangerPositions(room: Room): Position[] {
    const danger: Position[] = []
    if (!room.map) return danger

    for (const bomb of room.bombs) {
      // 炸弹本身位置
      danger.push({ ...bomb.position })
      
      // 四个方向的爆炸范围
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ]

      for (const dir of directions) {
        for (let i = 1; i <= bomb.range; i++) {
          const pos = {
            x: bomb.position.x + dir.dx * i,
            y: bomb.position.y + dir.dy * i,
          }

          // 边界检查
          if (pos.x < 0 || pos.x >= room.map.width || pos.y < 0 || pos.y >= room.map.height) {
            break
          }

          const cell = room.map.cells[pos.y][pos.x]
          if (cell.type === 'wall') break

          danger.push(pos)

          if (cell.type === 'brick') break
        }
      }
    }

    // 添加当前爆炸中的位置
    for (const explosion of room.explosions) {
      danger.push(...explosion.positions)
    }

    return danger
  }

  // 找逃跑方向
  private findEscapeDirection(room: Room, bot: Player, dangerPositions: Position[], smartChance: number): Direction | null {
    if (Math.random() > smartChance) {
      return this.getRandomSafeDirection(room, bot, dangerPositions)
    }

    const directions: Direction[] = ['up', 'down', 'left', 'right']
    const safeDirections: Direction[] = []

    for (const dir of directions) {
      const newPos = this.getNewPosition(bot.position, dir)
      
      // 检查是否可以移动到
      if (!this.canMoveTo(room, newPos)) continue

      // 检查新位置是否安全
      const isSafe = !dangerPositions.some(p => p.x === newPos.x && p.y === newPos.y)
      if (isSafe) {
        safeDirections.push(dir)
      }
    }

    // 优先选择能继续逃跑的方向（有更多出路）
    let bestDir: Direction | null = null
    let bestExits = -1

    for (const dir of safeDirections) {
      const newPos = this.getNewPosition(bot.position, dir)
      let exits = 0

      for (const d of directions) {
        const nextPos = this.getNewPosition(newPos, d)
        if (this.canMoveTo(room, nextPos) && !dangerPositions.some(p => p.x === nextPos.x && p.y === nextPos.y)) {
          exits++
        }
      }

      if (exits > bestExits) {
        bestExits = exits
        bestDir = dir
      }
    }

    return bestDir || safeDirections[0] || null
  }

  // 获取随机安全方向
  private getRandomSafeDirection(room: Room, bot: Player, dangerPositions?: Position[]): Direction | null {
    const directions: Direction[] = ['up', 'down', 'left', 'right']
    const shuffled = directions.sort(() => Math.random() - 0.5)

    for (const dir of shuffled) {
      const newPos = this.getNewPosition(bot.position, dir)
      if (!this.canMoveTo(room, newPos)) continue

      if (dangerPositions && dangerPositions.some(p => p.x === newPos.x && p.y === newPos.y)) {
        continue
      }

      return dir
    }

    return null
  }

  // 检查放炸弹后是否能逃跑
  // 简化逻辑：只要有一个方向可以移动就行（有3秒时间跑）
  private canEscapeAfterBomb(room: Room, bot: Player): boolean {
    if (!room.map) return false

    const directions: Direction[] = ['up', 'down', 'left', 'right']
    
    // 只要有一个方向可以移动，就认为可以逃跑
    for (const dir of directions) {
      const pos = this.getNewPosition(bot.position, dir)
      if (this.canMoveTo(room, pos)) {
        return true
      }
    }

    return false
  }

  // 检查附近是否有目标（敌人或砖块）
  private hasTargetNearby(room: Room, bot: Player): boolean {
    if (!room.map) return false

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ]

    for (const dir of directions) {
      for (let i = 1; i <= bot.bombRange; i++) {
        const pos = {
          x: bot.position.x + dir.dx * i,
          y: bot.position.y + dir.dy * i,
        }

        if (pos.x < 0 || pos.x >= room.map.width || pos.y < 0 || pos.y >= room.map.height) {
          break
        }

        const cell = room.map.cells[pos.y][pos.x]
        if (cell.type === 'wall') break

        // 有砖块可以炸
        if (cell.type === 'brick') return true

        // 有敌人可以炸（排除队友）
        const hasEnemy = room.players.some(p => 
          p.id !== bot.id && 
          p.isAlive && 
          !p.isDying &&
          p.team !== bot.team &&
          p.position.x === pos.x && 
          p.position.y === pos.y
        )
        if (hasEnemy) return true
      }
    }

    return false
  }

  // 检查附近是否有砖块（用于主动炸开道路）
  private hasBrickNearby(room: Room, bot: Player): boolean {
    if (!room.map) return false

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ]

    for (const dir of directions) {
      for (let i = 1; i <= bot.bombRange; i++) {
        const pos = {
          x: bot.position.x + dir.dx * i,
          y: bot.position.y + dir.dy * i,
        }

        if (pos.x < 0 || pos.x >= room.map.width || pos.y < 0 || pos.y >= room.map.height) {
          break
        }

        const cell = room.map.cells[pos.y][pos.x]
        if (cell.type === 'wall') break
        if (cell.type === 'brick') return true
      }
    }

    return false
  }

  // 找目标方向（追击敌人或捡道具）
  private findTargetDirection(room: Room, bot: Player, dangerPositions: Position[]): Direction | null {
    if (!room.map) return null

    // 先找道具
    let nearestPowerUp: Position | null = null
    let nearestPowerUpDist = Infinity

    for (const powerUp of room.powerUps) {
      const dist = Math.abs(powerUp.position.x - bot.position.x) + Math.abs(powerUp.position.y - bot.position.y)
      if (dist < nearestPowerUpDist) {
        nearestPowerUpDist = dist
        nearestPowerUp = powerUp.position
      }
    }

    // 再找敌人
    let nearestEnemy: Position | null = null
    let nearestEnemyDist = Infinity

    for (const player of room.players) {
      if (player.id === bot.id || !player.isAlive || player.isDying) continue
      if (bot.team && player.team === bot.team) continue  // 跳过队友

      const dist = Math.abs(player.position.x - bot.position.x) + Math.abs(player.position.y - bot.position.y)
      if (dist < nearestEnemyDist) {
        nearestEnemyDist = dist
        nearestEnemy = player.position
      }
    }

    // 优先捡近的道具，否则追敌人
    const target = (nearestPowerUpDist < 5 && nearestPowerUp) ? nearestPowerUp : nearestEnemy

    if (!target) return null

    // 简单寻路：往目标方向走
    const directions: { dir: Direction; pos: Position }[] = []
    
    if (target.x < bot.position.x) directions.push({ dir: 'left', pos: this.getNewPosition(bot.position, 'left') })
    if (target.x > bot.position.x) directions.push({ dir: 'right', pos: this.getNewPosition(bot.position, 'right') })
    if (target.y < bot.position.y) directions.push({ dir: 'up', pos: this.getNewPosition(bot.position, 'up') })
    if (target.y > bot.position.y) directions.push({ dir: 'down', pos: this.getNewPosition(bot.position, 'down') })

    // 随机打乱同等优先级的方向
    directions.sort(() => Math.random() - 0.5)

    for (const { dir, pos } of directions) {
      if (!this.canMoveTo(room, pos)) continue
      if (dangerPositions.some(p => p.x === pos.x && p.y === pos.y)) continue
      return dir
    }

    return null
  }

  // 获取移动后的新位置
  private getNewPosition(pos: Position, dir: Direction): Position {
    switch (dir) {
      case 'up': return { x: pos.x, y: pos.y - 1 }
      case 'down': return { x: pos.x, y: pos.y + 1 }
      case 'left': return { x: pos.x - 1, y: pos.y }
      case 'right': return { x: pos.x + 1, y: pos.y }
    }
  }

  // 检查是否可以移动到指定位置
  private canMoveTo(room: Room, pos: Position): boolean {
    if (!room.map) return false
    const { width, height, cells } = room.map

    if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) {
      return false
    }

    const cell = cells[pos.y][pos.x]
    if (cell.type === 'wall' || cell.type === 'brick' || cell.type === 'fence') {
      return false
    }

    // 不能走到炸弹上
    if (room.bombs.some(b => b.position.x === pos.x && b.position.y === pos.y)) {
      return false
    }

    return true
  }
}

// Bot 动作类型
export interface BotAction {
  type: 'move' | 'bomb'
  direction?: Direction
}

// 导出单例
export const botManager = new BotManager()
