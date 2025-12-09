// 炸弹人预设地图
// W = 墙 (wall)
// B = 砖块 (brick)
// . = 空地 (empty)
// S = 出生点 (spawn, 会被清理为空地)
// F = 铁丝网 (fence, 炸弹可穿过，人不可穿过)
// T = 地刺 (spike, 炸弹碰到立即爆炸)

import type { Cell, GameMap } from './types'

export interface PresetMap {
  id: string
  name: string
  icon: string
  width: number
  height: number
  layout: string[]
  maxPlayers: number
  dropRate: number      // 道具掉落概率 0-1
  initialBombs: number  // 初始炸弹数量
  initialRange: number  // 初始炸弹威力
}

// 地图定义 - 统一尺寸 17x13
export const PRESET_MAPS: PresetMap[] = [
  {
    id: 'classic',
    name: '经典',
    icon: '🏛️',
    width: 17,
    height: 13,
    maxPlayers: 4,
    dropRate: 0.5,
    initialBombs: 1,
    initialRange: 2,
    layout: [
      'WWWWWWWWWWWWWWWWW',
      'WS.BB.B.B.B.BBS.W',
      'W.W.W.W.W.W.W.W.W',
      'WBB.BBB.B.BBB.BBW',
      'W.W.W.W.W.W.W.W.W',
      'WBBB.B.....B.BBBW',
      'W.W.W.W...W.W.W.W',
      'WBBB.B.....B.BBBW',
      'W.W.W.W.W.W.W.W.W',
      'WBB.BBB.B.BBB.BBW',
      'W.W.W.W.W.W.W.W.W',
      'WS.BB.B.B.B.BBS.W',
      'WWWWWWWWWWWWWWWWW',
    ],
  },
  {
    id: 'arena',
    name: '竞技场',
    icon: '🏟️',
    width: 17,
    height: 13,
    maxPlayers: 4,
    dropRate: 1,
    initialBombs: 2,
    initialRange: 3,
    layout: [
      'WWWWWWWWWWWWWWWWW',
      'WS.............SW',
      'W.W.W.W.W.W.W.W.W',
      'W...BB.BBB.BB...W',
      'W.W.W.W.W.W.W.W.W',
      'W.BB.........BB.W',
      'W.W.W.......W.W.W',
      'W.BB.........BB.W',
      'W.W.W.W.W.W.W.W.W',
      'W...BB.BBB.BB...W',
      'W.W.W.W.W.W.W.W.W',
      'WS.............SW',
      'WWWWWWWWWWWWWWWWW',
    ],
  },
  {
    id: 'maze',
    name: '迷宫',
    icon: '🌀',
    width: 17,
    height: 13,
    maxPlayers: 4,
    dropRate: 0.5,
    initialBombs: 1,
    initialRange: 2,
    layout: [
      'WWWWWWWWWWWWWWWWW',
      'WS.B.B.B.B.B.B.SW',
      'W.WBWBWBWBWBWBW.W',
      'WB.B.B.B.B.B.B.BW',
      'WBWBWBWBWBWBWBWBW',
      'WB.B.B.B.B.B.B.BW',
      'WBWBWBW...WBWBWBW',
      'WB.B.B.B.B.B.B.BW',
      'WBWBWBWBWBWBWBWBW',
      'WB.B.B.B.B.B.B.BW',
      'W.WBWBWBWBWBWBW.W',
      'WS.B.B.B.B.B.B.SW',
      'WWWWWWWWWWWWWWWWW',
    ],
  },
  {
    id: 'cross',
    name: '十字',
    icon: '✝️',
    width: 17,
    height: 13,
    maxPlayers: 4,
    dropRate: 0.55,
    initialBombs: 1,
    initialRange: 3,
    layout: [
      'WWWWWWWWWWWWWWWWW',
      'WS.BBBB...BBBB.SW',
      'W.W.W.WB.BW.W.W.W',
      'WBBB.BB...BB.BBBW',
      'WBW.W.W.W.W.W.WBW',
      'WBB...........BBW',
      'W.W.W.W...W.W.W.W',
      'WBB...........BBW',
      'WBW.W.W.W.W.W.WBW',
      'WBBB.BB...BB.BBBW',
      'W.W.W.WB.BW.W.W.W',
      'WS.BBBB...BBBB.SW',
      'WWWWWWWWWWWWWWWWW',
    ],
  },
  {
    id: 'six_player',
    name: '六人混战',
    icon: '👥',
    width: 17,
    height: 13,
    maxPlayers: 6,
    dropRate: 0.5,
    initialBombs: 2,
    initialRange: 2,
    layout: [
      'WWWWWWWWWWWWWWWWW',
      'WS.BB..S..BB..S.W',
      'W.W.W.W.W.W.W.W.W',
      'WBB.BBB.B.BBB.BBW',
      'W.W.W.W.W.W.W.W.W',
      'WBBB.B.....B.BBBW',
      'W.W.W.W...W.W.W.W',
      'WBBB.B.....B.BBBW',
      'W.W.W.W.W.W.W.W.W',
      'WBB.BBB.B.BBB.BBW',
      'W.W.W.W.W.W.W.W.W',
      'WS.BB..S..BB..S.W',
      'WWWWWWWWWWWWWWWWW',
    ],
  },
  {
    id: 'treasure',
    name: '藏宝图',
    icon: '💎',
    width: 17,
    height: 13,
    maxPlayers: 4,
    dropRate: 0.5,
    initialBombs: 1,
    initialRange: 2,
    layout: [
      'WWWWWWWWWWWWWWWWW',
      'WS..BB.....BB..SW',
      'W.W.W.WBWBW.W.W.W',
      'W..BBBBBBBBBBB..W',
      'WBW.W.W.W.W.W.WBW',
      'W.BBBB.....BBBB.W',
      'W.W.WB.BBB.BW.W.W',
      'W.BBBB.....BBBB.W',
      'WBW.W.W.W.W.W.WBW',
      'W..BBBBBBBBBBB..W',
      'W.W.W.WBWBW.W.W.W',
      'WS..BB.....BB..SW',
      'WWWWWWWWWWWWWWWWW',
    ],
  },
  // 踢炸弹对战模式 - AB队对抗
  {
    id: 'kick_battle',
    name: '踢弹大战',
    icon: '⚔️',
    width: 17,
    height: 13,
    maxPlayers: 6,
    dropRate: 0.3,
    initialBombs: 3,
    initialRange: 3,
    layout: [
      'WWWWWWWWWWWWWWWWW',
      'WS.....S....T..SW',
      'W...............W',
      'W.....T.........W',
      'W...............W',
      'W...............W',
      'FFFFFFFFFFFFFFFFF',
      'W...............W',
      'W...............W',
      'W.........T.....W',
      'W...............W',
      'WS..T..S.......SW',
      'WWWWWWWWWWWWWWWWW',
    ],
  },
]

// 根据布局字符串生成地图
export function generateMapFromPreset(preset: PresetMap): GameMap {
  const cells: Cell[][] = []

  for (let y = 0; y < preset.height; y++) {
    cells[y] = []
    for (let x = 0; x < preset.width; x++) {
      const char = preset.layout[y]?.[x] || 'W'
      switch (char) {
        case 'W':
          cells[y][x] = { type: 'wall' }
          break
        case 'B':
          cells[y][x] = { type: 'brick' }
          break
        case 'F':
          cells[y][x] = { type: 'fence' }
          break
        case 'T':
          cells[y][x] = { type: 'spike' }
          break
        case 'S':
        case '.':
        default:
          cells[y][x] = { type: 'empty' }
          break
      }
    }
  }

  return {
    width: preset.width,
    height: preset.height,
    cells,
  }
}

// 根据地图ID获取地图
export function getPresetMap(mapId: string): PresetMap | undefined {
  return PRESET_MAPS.find(m => m.id === mapId)
}
