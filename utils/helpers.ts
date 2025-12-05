// Generate unique ID
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`
}

// Generate room code (6 characters)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Format player count
export function formatPlayerCount(current: number, max: number): string {
  return `${current}/${max}`
}

// Get random avatar
export function getRandomAvatar(): string {
  const avatars = ['🎮', '🎲', '🃏', '🎰', '🏆', '⭐', '🎯', '🎪']
  return avatars[Math.floor(Math.random() * avatars.length)]
}

// Delay utility
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Clamp number between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Get room status text
export function getRoomStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'waiting': '等待中',
    'bidding': '叫地主',
    'playing': '游戏中',
    'finished': '已结束'
  }
  return statusMap[status] || status
}

// Get room status color class
export function getRoomStatusClass(status: string): string {
  const classMap: Record<string, string> = {
    'waiting': 'text-casino-gold',
    'bidding': 'text-orange-400',
    'playing': 'text-casino-red',
    'finished': 'text-gray-500'
  }
  return classMap[status] || 'text-gray-400'
}

// Simple hash for password
export function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// Validate room password
export function validatePassword(input: string, hashed: string): boolean {
  return simpleHash(input) === hashed
}
