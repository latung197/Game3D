import type { HubConnection } from '@microsoft/signalr'
import { account } from '../account/session'

export interface ArenaPlayer { accountId: string; characterId: string; name: string; element: string; x: number; z: number; health: number; maxHealth: number; pkEnabled: boolean }
export interface ArenaHit { attackerId: string; targetId: string; damage: number; health: number; killed: boolean; skill: boolean }
export interface ChatMessage { id: string; senderId: string; senderName: string; channel: string; scopeId: string; text: string; createdAt: string }

export class RealtimeClient {
  private connection: HubConnection | null = null
  players = new Map<string, ArenaPlayer>()
  targetId: string | null = null
  pkEnabled = false
  onPlayers: () => void = () => {}
  private playersListeners = new Set<() => void>()
  private notifyPlayers() { this.onPlayers(); for (const listener of this.playersListeners) listener() }
  listenPlayers(listener: () => void) { this.playersListeners.add(listener); return () => this.playersListeners.delete(listener) }
  onChat: (message: ChatMessage) => void = () => {}
  onHit: (hit: ArenaHit) => void = () => {}
  onArenaEntered: (state: ArenaPlayer) => void = () => {}
  onSelfState: (state: ArenaPlayer) => void = () => {}
  onControl: (rootSeconds: number, slowSeconds: number, hasteSeconds: number) => void = () => {}
  get connected() { return this.connection?.state === 'Connected' }

  async connect() {
    if (!account) return
    if (this.connected) { await this.enterArena(); return }
    const { HubConnectionBuilder } = await import('@microsoft/signalr')
    const connection = new HubConnectionBuilder().withUrl('/api/realtime').withAutomaticReconnect().build()
    connection.on('ArenaSnapshot', (states: ArenaPlayer[]) => {
      this.players = new Map(states.map(state => [state.accountId, state]))
      this.notifyPlayers()
    })
    connection.on('PlayerMoved', (state: ArenaPlayer) => {
      this.players.set(state.accountId, state)
      if (state.accountId === account?.id) this.onSelfState(state)
      this.notifyPlayers()
    })
    connection.on('ControlStatus', (root: number, slow: number, haste: number) => this.onControl(root, slow, haste))
    connection.on('PlayerLeft', (id: string) => {
      this.players.delete(id)
      this.notifyPlayers()
    })
    connection.on('PlayerHit', (hit: ArenaHit) => {
      const player = this.players.get(hit.targetId)
      if (player) this.players.set(hit.targetId, { ...player, health: hit.killed ? player.maxHealth : hit.health,
        x: hit.killed ? 0 : player.x, z: hit.killed ? 6.5 : player.z })
      this.onHit(hit)
      this.notifyPlayers()
    })
    connection.on('ChatMessage', (message: ChatMessage) => this.onChat(message))
    connection.onreconnected(async () => { await this.enterArena(); this.notifyPlayers() })
    connection.onclose(() => { this.players.clear(); this.notifyPlayers() })
    await connection.start()
    this.connection = connection
    await this.enterArena().catch(() => {})
  }
  async disconnect() {
    const connection = this.connection
    this.connection = null
    this.players.clear()
    this.notifyPlayers()
    if (connection) await connection.stop()
  }
  async enterArena() {
    if (!this.connected) return
    const state = await this.connection!.invoke<ArenaPlayer>('EnterArena', this.pkEnabled)
    this.onArenaEntered(state)
  }
  async refreshGroups() { if (this.connected) await this.connection!.invoke('RefreshGroups') }
  async sendChat(channel: string, target: string, text: string) {
    if (!this.connected) throw new Error('Chưa kết nối chat.')
    await this.connection!.invoke('SendChat', channel, target, text)
  }
  async move(x: number, z: number) { if (this.connected) await this.connection!.send('Move', x, z) }
  async guard() { if (this.connected) await this.connection!.send('Guard') }
  async attack(skill: boolean) { if (this.connected && this.targetId) await this.connection!.send('Attack', this.targetId, skill) }
  async setPk(enabled: boolean) {
    this.pkEnabled = enabled
    if (this.connected) await this.connection!.invoke('SetPk', enabled)
  }
}
