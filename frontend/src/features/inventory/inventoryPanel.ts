import { api } from '../account/session'

interface Item { id: string; name: string; slot: string; attackBonus: number; defenseBonus: number; healthBonus: number; icon: string }
interface Entry { id: string; itemId: string; quantity: number; equippedSlot: string | null }

export async function renderInventoryPanel(host: HTMLElement, onChanged: () => Promise<void> = async () => {}) {
  host.replaceChildren()
  const title = document.createElement('h2')
  title.textContent = 'Túi đồ & trang bị'
  const status = document.createElement('p')
  status.className = 'feature-notice'
  const list = document.createElement('div')
  list.className = 'feature-list'
  host.append(title, status, list)
  try {
    const [catalog, entries] = await Promise.all([api<Item[]>('/inventory/catalog'), api<Entry[]>('/inventory')])
    for (const entry of entries) {
      const item = catalog.find(value => value.id === entry.itemId)
      if (!item) continue
      const row = document.createElement('div')
      row.className = 'feature-row'
      const text = document.createElement('span')
      text.textContent = `${item.icon} ${item.name} ×${entry.quantity} · Công +${item.attackBonus} Thủ +${item.defenseBonus} HP +${item.healthBonus}`
      const button = document.createElement('button')
      button.textContent = entry.equippedSlot ? 'Tháo' : 'Trang bị'
      button.onclick = () => {
        const task = entry.equippedSlot
          ? api(`/inventory/unequip/${entry.equippedSlot}`, { method: 'POST' })
          : api('/inventory/equip', { method: 'POST', body: JSON.stringify({ entryId: entry.id }) })
        void task.then(async () => { await onChanged(); await renderInventoryPanel(host, onChanged) })
          .catch(error => { status.textContent = error.message })
      }
      row.append(text, button)
      list.append(row)
    }
    if (!entries.length) list.textContent = 'Túi đồ trống.'
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Không tải được túi đồ.' }
}
