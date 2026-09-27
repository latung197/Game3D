import { getElement, type ElementId } from '../world/elements'
import { account, api } from '../account/session'

export interface Player {
  id: string
  name: string
  level: number
  experience: number
  gold: number
  health: number
  maxHealth: number
  totalKills: number
  questKills: number
  element: ElementId
}

export type LeaderboardEntry = Pick<Player, 'name' | 'level' | 'totalKills' | 'experience' | 'element'>

const key = 'truc-lam-player'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...options?.headers },
  })
  if (!response.ok) throw new Error(`API ${response.status}`)
  return response.json() as Promise<T>
}

export async function loadPlayer(): Promise<Player | null> {
  const stored = localStorage.getItem(key)
  if (!stored) return null
  const player = JSON.parse(stored) as Player
  player.element = getElement(player.element).id
  const expectedMaxHealth = getElement(player.element).stats.health + Math.max(0, player.level - 1) * 15
  const difference = expectedMaxHealth - player.maxHealth
  if (difference !== 0) {
    player.maxHealth = expectedMaxHealth
    player.health = Math.max(1, Math.min(expectedMaxHealth, player.health + difference))
    localStorage.setItem(key, JSON.stringify(player))
  }
  try {
    const fresh = await request<Player>(`/players/${player.id}`)
    localStorage.setItem(key, JSON.stringify(fresh))
    return fresh
  } catch {
    return player
  }
}

export async function createPlayer(name: string, element: ElementId): Promise<{ player: Player; online: boolean }> {
  try {
    const player = await request<Player>('/players', {
      method: 'POST', body: JSON.stringify({ name, element }),
    })
    localStorage.setItem(key, JSON.stringify(player))
    return { player, online: true }
  } catch {
    const player: Player = {
      id: crypto.randomUUID(), name, level: 1, experience: 0, gold: 0,
      health: getElement(element).stats.health, maxHealth: getElement(element).stats.health,
      totalKills: 0, questKills: 0, element,
    }
    localStorage.setItem(key, JSON.stringify(player))
    return { player, online: false }
  }
}

export async function changeElement(player: Player, element: ElementId): Promise<Player> {
  if (account) return api<Player>(`/characters/${player.id}/element`, { method: 'PUT', body: JSON.stringify({ element }) })
  try {
    const updated = await request<Player>(`/players/${player.id}/element`, {
      method: 'PUT', body: JSON.stringify({ element }),
    })
    localStorage.setItem(key, JSON.stringify(updated))
    return updated
  } catch {
    const maxHealth = getElement(element).stats.health + Math.max(0, player.level - 1) * 15
    const difference = maxHealth - player.maxHealth
    const updated: Player = {
      ...player, element, maxHealth,
      health: Math.max(1, Math.min(maxHealth, player.health + difference)),
    }
    localStorage.setItem(key, JSON.stringify(updated))
    return updated
  }
}

export async function recordVictory(player: Player, enemyId: string): Promise<Player> {
  if (account) return api<Player>(`/characters/${player.id}/victories`, { method: 'POST', body: JSON.stringify({ enemyId }) })
  try {
    const updated = await request<Player>(`/players/${player.id}/victories`, {
      method: 'POST', body: JSON.stringify({ enemyId }),
    })
    localStorage.setItem(key, JSON.stringify(updated))
    return updated
  } catch {
    const xp = enemyId === 'stone_guardian' ? 40 : 25
    const gold = enemyId === 'stone_guardian' ? 15 : 8
    let experience = player.experience + xp
    let level = player.level
    while (experience >= 60 + level * 40) {
      experience -= 60 + level * 40
      level++
    }
    const updated = {
      ...player, level, experience, gold: player.gold + gold,
      maxHealth: player.maxHealth + (level - player.level) * 15,
      totalKills: player.totalKills + 1,
      questKills: player.questKills + (enemyId === 'forest_slime' ? 1 : 0),
    }
    localStorage.setItem(key, JSON.stringify(updated))
    return updated
  }
}

export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  try { return await request<LeaderboardEntry[]>('/leaderboard') }
  catch { return [] }
}
