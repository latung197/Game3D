import { account, api } from '../account/session'
import { type ChatMessage, type RealtimeClient } from './realtime'

interface Party { id: string; code: string; leaderId: string; members: number }
interface Guild { id: string; name: string; leaderId: string; members: number }
interface War { id: string; guildA: string; guildB: string; scoreA: number; scoreB: number; endsAt: string }
type Tab = 'chat' | 'party' | 'guild' | 'pk'

export function mountSocialPanel(host: HTMLElement, realtime: RealtimeClient) {
  let tab: Tab = 'chat'
  const notice = document.createElement('p')
  notice.className = 'feature-notice'
  const body = document.createElement('div')
  const tabs = document.createElement('div')
  tabs.className = 'feature-tabs'
  host.replaceChildren(tabs, notice, body)
  const fail = (reason: unknown) => { notice.textContent = reason instanceof Error ? reason.message : String(reason) }
  async function render() {
    tabs.replaceChildren()
    for (const [key, label] of [['chat', 'Chat'], ['party', 'Nhóm'], ['guild', 'Bang hội'], ['pk', 'PK']] as const) {
      const button = document.createElement('button')
      button.textContent = label
      button.className = tab === key ? 'active' : ''
      button.onclick = () => { tab = key; void render() }
      tabs.append(button)
    }
    body.replaceChildren()
    if (!account) { body.textContent = 'Đăng nhập để dùng tính năng nhiều người chơi.'; return }
    try {
      if (tab === 'chat') await chat()
      if (tab === 'party') await party()
      if (tab === 'guild') await guild()
      if (tab === 'pk') await pk()
    } catch (e) { fail(e) }
  }
  async function chat() {
    let directScope = ''
    const select = document.createElement('select')
    for (const [value, label] of [['world', 'Thế giới'], ['party', 'Nhóm'], ['guild', 'Bang hội'], ['dm', 'Riêng']] as const) {
      const option = new Option(label, value)
      select.append(option)
    }
    const target = document.createElement('input')
    target.placeholder = 'Tên tài khoản nhận tin riêng'
    target.style.display = 'none'
    const messages = document.createElement('div')
    messages.className = 'chat-history'
    const form = document.createElement('form')
    form.className = 'feature-form chat-form'
    const input = document.createElement('input')
    input.placeholder = 'Nhập tin nhắn...'
    input.maxLength = 300
    input.required = true
    const send = document.createElement('button')
    send.type = 'submit'
    send.textContent = 'Gửi'
    form.append(input, send)
    body.append(select, target, messages, form)
    const add = (message: ChatMessage) => {
      if (message.channel !== select.value) return
      if (select.value === 'dm' && (!directScope || message.scopeId !== directScope)) return
      const row = document.createElement('p')
      const sender = document.createElement('b')
      sender.textContent = `${message.senderName}: `
      row.append(sender, document.createTextNode(message.text))
      messages.append(row)
      while (messages.children.length > 100) messages.firstElementChild?.remove()
      messages.scrollTop = messages.scrollHeight
    }
    const history = async () => {
      messages.replaceChildren()
      target.style.display = select.value === 'dm' ? '' : 'none'
      directScope = ''
      if (select.value === 'dm' && target.value.trim()) {
        const recipient = await api<{ id: string }>(`/social/players/${encodeURIComponent(target.value.trim())}`).catch(() => null)
        if (recipient) directScope = [account!.id, recipient.id].sort().join(':')
      }
      const query = select.value === 'dm' ? `?target=${encodeURIComponent(target.value.trim())}` : ''
      const items = await api<ChatMessage[]>(`/social/messages/${select.value}${query}`)
      items.forEach(add)
    }
    select.onchange = () => { void history().catch(fail) }
    target.onchange = () => { void history().catch(fail) }
    realtime.onChat = add
    form.onsubmit = event => {
      event.preventDefault()
      void realtime.sendChat(select.value, target.value, input.value).then(() => { input.value = '' }).catch(fail)
    }
    await history()
  }
  async function party() {
    const current = await api<Party | null>('/social/party')
    const title = document.createElement('p')
    title.textContent = current ? `Nhóm ${current.code} · ${current.members}/5 thành viên` : 'Bạn chưa ở trong nhóm.'
    body.append(title)
    if (current) {
      const leave = document.createElement('button')
      leave.textContent = 'Rời nhóm'
      leave.onclick = () => { void api('/social/party/leave', { method: 'POST' }).then(async () => { await realtime.refreshGroups(); await render() }).catch(fail) }
      body.append(leave)
    } else {
      const create = document.createElement('button')
      create.textContent = 'Lập nhóm'
      create.onclick = () => { void api('/social/party', { method: 'POST' }).then(async () => { await realtime.refreshGroups(); await render() }).catch(fail) }
      const form = document.createElement('form')
      form.className = 'feature-form'
      const code = document.createElement('input')
      code.placeholder = 'Mã mời 6 ký tự'
      code.maxLength = 6
      const join = document.createElement('button')
      join.textContent = 'Vào nhóm'
      form.append(code, join)
      form.onsubmit = event => { event.preventDefault(); void api('/social/party/join', { method: 'POST', body: JSON.stringify({ code: code.value }) }).then(async () => { await realtime.refreshGroups(); await render() }).catch(fail) }
      body.append(create, form)
    }
  }
  async function guild() {
    const [mine, guilds] = await Promise.all([api<Guild | null>('/guilds/mine'), api<Guild[]>('/guilds')])
    const title = document.createElement('p')
    title.textContent = mine ? `Bang ${mine.name} · ${mine.members} thành viên` : 'Bạn chưa có bang hội.'
    body.append(title)
    if (mine) {
      const leave = document.createElement('button')
      leave.textContent = 'Rời bang'
      leave.onclick = () => { void api('/guilds/leave', { method: 'POST' }).then(async () => { await realtime.refreshGroups(); await render() }).catch(fail) }
      body.append(leave)
      const wars = await api<War[]>('/guilds/wars')
      for (const war of wars) {
        const row = document.createElement('p')
        row.textContent = `Bang chiến: ${war.scoreA}–${war.scoreB} · Kết thúc ${new Date(war.endsAt).toLocaleTimeString('vi-VN')}`
        body.append(row)
      }
    } else {
      const form = document.createElement('form')
      form.className = 'feature-form'
      const name = document.createElement('input')
      name.placeholder = 'Tên bang hội'
      name.maxLength = 30
      const create = document.createElement('button')
      create.textContent = 'Lập bang'
      form.append(name, create)
      form.onsubmit = event => { event.preventDefault(); void api('/guilds', { method: 'POST', body: JSON.stringify({ name: name.value }) }).then(async () => { await realtime.refreshGroups(); await render() }).catch(fail) }
      body.append(form)
    }
    const list = document.createElement('div')
    list.className = 'feature-list'
    for (const guild of guilds) {
      const row = document.createElement('div')
      row.className = 'feature-row'
      const label = document.createElement('span')
      label.textContent = `${guild.name} · ${guild.members} người`
      row.append(label)
      if (!mine) {
        const join = document.createElement('button')
        join.textContent = 'Gia nhập'
        join.onclick = () => { void api('/guilds/join', { method: 'POST', body: JSON.stringify({ guildId: guild.id }) }).then(async () => { await realtime.refreshGroups(); await render() }).catch(fail) }
        row.append(join)
      } else if (mine.leaderId === account!.id && mine.id !== guild.id) {
        const war = document.createElement('button')
        war.textContent = 'Tuyên chiến'
        war.onclick = () => { void api('/guilds/wars', { method: 'POST', body: JSON.stringify({ targetGuildId: guild.id }) }).then(render).catch(fail) }
        row.append(war)
      }
      list.append(row)
    }
    body.append(list)
  }
  async function pk() {
    const toggle = document.createElement('button')
    toggle.textContent = realtime.pkEnabled ? 'Tắt PK tự do' : 'Bật PK tự do'
    toggle.onclick = () => { void realtime.setPk(!realtime.pkEnabled).then(render).catch(fail) }
    body.append(toggle)
    const hint = document.createElement('p')
    hint.textContent = 'Chọn mục tiêu rồi dùng Space hoặc E để đánh. Bang chiến cho phép đánh thành viên bang đối thủ trong 10 phút.'
    body.append(hint)
    const list = document.createElement('div')
    list.className = 'feature-list'
    for (const player of realtime.players.values()) {
      if (player.accountId === account!.id) continue
      const row = document.createElement('div')
      row.className = 'feature-row'
      const label = document.createElement('span')
      label.textContent = `${player.name} · ${player.health}/${player.maxHealth} HP ${player.pkEnabled ? '· PK' : ''}`
      const select = document.createElement('button')
      select.textContent = realtime.targetId === player.accountId ? 'Đang nhắm' : 'Nhắm'
      select.onclick = () => { realtime.targetId = player.accountId; void render() }
      row.append(label, select)
      list.append(row)
    }
    body.append(list)
  }
  const stop = realtime.listenPlayers(() => {
    if (!host.isConnected) { stop(); return }
    if (host.closest('#panel-backdrop')?.classList.contains('hidden')) return
    if (tab === 'pk') void render()
  })
  void render()
}
