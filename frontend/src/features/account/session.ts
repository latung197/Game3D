import type { ElementId } from '../world/elements'
import type { Player } from '../characters/gameApi'

export interface Account { id: string; email: string; displayName: string; selectedCharacterId: string | null }
export interface Character { id: string; accountId: string; name: string; element: ElementId; level: number; experience: number; gold: number; maxHealth: number; totalKills: number; questKills: number }
export let account: Account | null = null

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...options.headers },
  })
  if (!response.ok) {
    let message = `Lỗi ${response.status}`
    try { message = (await response.json()).error || message } catch { /* empty response */ }
    throw new Error(message)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
export async function restoreSession() {
  try { account = await api<Account>('/accounts/me') } catch { account = null }
  return account
}
export async function signIn(mode: 'login' | 'register', email: string, password: string, displayName: string, rememberMe: boolean) {
  account = await api<Account>(`/accounts/${mode}`, { method: 'POST', body: JSON.stringify({ email, password, displayName, rememberMe }) })
  return account
}
export async function signOut() {
  await api('/accounts/logout', { method: 'POST' })
  account = null
}
export const characters = () => api<Character[]>('/characters')
export const selectedCharacter = () => api<Player>('/characters/selected')
export const createCharacter = (name: string, element: ElementId) => api<Player>('/characters', { method: 'POST', body: JSON.stringify({ name, element }) })
export const selectCharacter = (id: string) => api<void>(`/characters/${id}/select`, { method: 'POST' })
export const importGuest = (legacyId: string) => api<Player>('/characters/import-guest', { method: 'POST', body: JSON.stringify({ legacyId }) })
