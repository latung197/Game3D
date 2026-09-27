import './style.css'
import { GameWorld } from './features/world/GameWorld'
import { bindControls } from './features/world/controls'
import { changeElement, createPlayer, loadLeaderboard, loadPlayer, recordVictory, type Player } from './features/characters/gameApi'
import { elementList, getElement, type ElementId } from './features/world/elements'
import { account, createCharacter, restoreSession, selectedCharacter } from './features/account/session'
import { renderAccountPanel } from './features/account/accountPanel'
import { renderInventoryPanel } from './features/inventory/inventoryPanel'
import { RealtimeClient } from './features/social/realtime'
import { assetsFor } from './features/assets/assetManifest'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div id="world" class="world"></div>
  <div class="atmosphere" aria-hidden="true"></div>
  <div class="game-ui">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark"><span>竹</span></div>
        <div><span class="brand-eyebrow">TRUYỀN KỲ VÕ HIỆP</span><strong>TRÚC LÂM <em>BÍ CẢNH</em></strong></div>
      </div>
      <div class="topbar-actions">
        <button class="nav-button" id="account-button">Tài khoản</button>
        <button class="nav-button" id="inventory-button">Túi đồ</button>
        <button class="nav-button" id="social-button">Chat · Bang · PK</button>
        <span class="version-badge"><span class="status-dot"></span> BẢN CHƠI THỬ</span>
        <button class="icon-button" id="help-button" aria-label="Hướng dẫn">?</button>
      </div>
    </header>

    <section class="profile glass" aria-label="Thông tin nhân vật">
      <div class="avatar"><span id="avatar-glyph">俠</span><small id="avatar-level">01</small></div>
      <div class="profile-main">
        <div class="profile-title"><span id="player-name">Lữ khách</span><button id="element-button" class="class-name" title="Đổi hệ nhân vật">KIM · THIẾT KIẾM ↗</button></div>
        <div class="bar-row"><span class="bar-symbol heart">♥</span><div class="bar-track"><div id="health-fill" class="bar-fill health-fill"></div></div><span id="health-text">100/100</span></div>
        <div class="bar-row"><span class="bar-symbol star">✦</span><div class="bar-track xp-track"><div id="xp-fill" class="bar-fill xp-fill"></div></div><span id="xp-text">0/100</span></div>
      </div>
      <div class="profile-gold"><span class="coin-icon">✦</span><b id="gold-count">0</b></div>
    </section>

    <section class="quest glass" aria-label="Nhiệm vụ">
      <div class="card-heading"><span class="card-icon">✦</span> NHIỆM VỤ HIỆN TẠI <span class="quest-dots">···</span></div>
      <div class="quest-title">Thử thách nhập môn</div>
      <p>Đánh bại Mộc Linh trong rừng trúc để chứng tỏ bản lĩnh của mình.</p>
      <div class="quest-progress-row"><span id="quest-status">Tiến độ</span><b id="quest-count">0 / 5</b></div>
      <div class="quest-progress"><div id="quest-fill"></div></div>
      <div class="quest-reward">✧ <span>Khám phá bí cảnh · Nhận kinh nghiệm</span></div>
    </section>

    <aside class="zone glass">
      <div class="zone-top"><span class="zone-icon">⌖</span><div><small>KHU VỰC HIỆN TẠI</small><strong>Trúc Lâm Bí Cảnh</strong></div></div>
      <div class="zone-weather"><span class="sun">☀</span> Bình minh <span class="weather-divider">·</span> Cấp 1 – 5</div>
      <div class="mini-map"><div class="map-path"></div><span class="map-shrine">⌂</span><span class="map-player">◆</span><span class="map-enemy e1"></span><span class="map-enemy e2"></span><span class="map-enemy e3"></span></div>
      <button id="leaderboard-button" class="leaderboard-link">♜ &nbsp; Bảng anh hùng <span>↗</span></button>
    </aside>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <div class="desktop-guide"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Di chuyển</span><span><kbd>SPACE</kbd> Tấn công</span><span><kbd>SHIFT</kbd> Phòng thủ</span><span><kbd>E</kbd> Kỹ năng</span></div>

    <div class="mobile-joystick" id="joystick" aria-label="Điều khiển di chuyển"><div class="joystick-ring"><div class="joystick-thumb" id="joystick-thumb"></div></div></div>
    <div class="actions">
      <button class="ability ability-dash" id="dash-button" aria-label="Phòng thủ"><span class="ability-glyph">◇</span><small id="defense-label">CƯƠNG GIÁP</small><i>SHIFT</i></button>
      <button class="ability ability-skill" id="skill-button" aria-label="Kỹ năng"><span class="ability-glyph">✧</span><small id="skill-label">KIM QUANG</small><i>E</i></button>
      <button class="ability ability-attack" id="attack-button" aria-label="Tấn công"><span class="ability-glyph" id="attack-glyph">⚔</span><small id="attack-label">THIẾT KIẾM</small><i>SPACE</i></button>
    </div>
  </div>

  <div id="welcome" class="welcome-backdrop">
    <div class="welcome-card">
      <button type="button" id="welcome-close" class="welcome-close hidden" aria-label="Đóng chọn hệ">×</button>
      <div class="welcome-ornament">✦ &nbsp; 竹 林 秘 境 &nbsp; ✦</div>
      <div class="welcome-seal">竹</div>
      <p class="welcome-kicker">MỘT HÀNH TRÌNH MỚI ĐANG CHỜ ĐỢI</p>
      <h1>Trúc Lâm<br><em>Bí Cảnh</em></h1>
      <p class="welcome-description">Bước vào rừng trúc, rèn kiếm thuật và viết nên truyền kỳ của riêng bạn.</p>
      <div class="element-heading"><span>CHỌN HỆ NHÂN VẬT</span><small>Mỗi hệ có bộ chiêu và chỉ số riêng</small></div>
      <div id="element-grid" class="element-grid" role="group" aria-label="Chọn hệ nhân vật"></div>
      <div id="element-details" class="element-details" aria-live="polite"></div>
      <form id="start-form">
        <label for="character-name">TÊN NHÂN VẬT</label>
        <input id="character-name" name="name" maxlength="20" minlength="2" autocomplete="nickname" placeholder="Nhập danh xưng của bạn" required />
        <button type="submit" id="start-button">BẮT ĐẦU HÀNH TRÌNH <span>→</span></button>
      </form>
      <button type="button" id="welcome-account" class="welcome-account">Đăng nhập / Đăng ký tài khoản</button>
      <span class="welcome-footnote">Chơi trên máy tính & điện thoại · Tiến trình tự lưu</span>
    </div>
  </div>

  <div id="panel-backdrop" class="panel-backdrop hidden">
    <section id="info-panel" class="info-panel glass" role="dialog" aria-modal="true" aria-label="Thông tin">
      <button id="panel-close" class="panel-close" aria-label="Đóng">×</button>
      <div id="panel-content"></div>
    </section>
  </div>
`

const element = <T extends HTMLElement>(selector: string) => app.querySelector<T>(selector)!
let player: Player | null = null
let health = 100
let selectedElement: ElementId = 'metal'
let gameStarted = false
let rewardQueue = Promise.resolve()
let toastTimeout: number | undefined
const realtime = new RealtimeClient()

function showToast(message: string) {
  const toast = element<HTMLDivElement>('#toast')
  toast.textContent = message
  toast.classList.add('visible')
  window.clearTimeout(toastTimeout)
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 2600)
}

function renderProfile() {
  if (!player) return
  const style = getElement(player.element)
  element('#player-name').textContent = player.name
  element('#avatar-glyph').textContent = style.glyph
  element('#element-button').textContent = `${style.name.toUpperCase()} · ${style.title.toUpperCase()} ↗`
  element<HTMLElement>('.avatar').style.borderColor = style.color
  element<HTMLElement>('#element-button').style.color = style.color
  element('#avatar-level').textContent = String(player.level).padStart(2, '0')
  element('#gold-count').textContent = player.gold.toLocaleString('vi-VN')
  element('#health-text').textContent = `${health}/${player.maxHealth}`
  element<HTMLElement>('#health-fill').style.width = `${100 * health / player.maxHealth}%`
  const xpNeeded = 60 + player.level * 40
  element('#xp-text').textContent = `${player.experience}/${xpNeeded}`
  element<HTMLElement>('#xp-fill').style.width = `${100 * player.experience / xpNeeded}%`
  const count = Math.min(5, player.questKills)
  element('#quest-count').textContent = `${count} / 5`
  element<HTMLElement>('#quest-fill').style.width = `${count * 20}%`
  element('#quest-status').textContent = count === 5 ? 'Hoàn thành!' : 'Tiến độ'
  element('#defense-label').textContent = style.defenseMove.name.toUpperCase()
  element('#skill-label').textContent = style.skillMove.name.toUpperCase()
  element('#attack-label').textContent = style.attackMove.name.toUpperCase()
  element('#attack-glyph').textContent = style.glyph
  for (const [selector, label, description] of [
    ['#dash-button', style.defenseMove.name, style.defenseMove.description],
    ['#skill-button', style.skillMove.name, style.skillMove.description],
    ['#attack-button', style.attackMove.name, `Sát thương ${style.attackMove.damage}`],
  ]) {
    const button = element<HTMLButtonElement>(selector)
    button.title = `${label}: ${description}`
    button.setAttribute('aria-label', `${label}: ${description}`)
  }
  element<HTMLElement>('#attack-button').style.borderColor = style.color
  const assets = assetsFor(player.element)
  for (const [selector, icon] of [['#attack-button', assets.attackIcon], ['#dash-button', assets.defenseIcon], ['#skill-button', assets.skillIcon]] as const) {
    const button = element<HTMLButtonElement>(selector)
    button.style.backgroundImage = icon ? `linear-gradient(#173a3780,#173a3780), url("${icon}")` : ''
    button.style.backgroundSize = icon ? 'cover' : ''
  }
}

function renderElementPicker() {
  const grid = element('#element-grid')
  grid.replaceChildren()
  for (const style of elementList) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `element-card ${style.id === selectedElement ? 'selected' : ''}`
    button.style.setProperty('--element-color', style.color)
    button.setAttribute('aria-pressed', String(style.id === selectedElement))
    button.innerHTML = `<span class="element-glyph">${style.glyph}</span><strong>${style.name}</strong><small>${style.title}</small>`
    button.addEventListener('click', () => {
      selectedElement = style.id
      world.configureElement(style.id)
      renderElementPicker()
    })
    grid.append(button)
  }
  const style = getElement(selectedElement)
  element('#element-details').innerHTML = `
    <div class="element-detail-title" style="color:${style.color}"><b>${style.name.toUpperCase()} HỆ</b><span>${style.description}</span></div>
    <div class="element-stats"><span>SINH LỰC <b>${style.stats.health}</b></span><span>CÔNG <b>${style.stats.attack}</b></span><span>THỦ <b>${style.stats.defense}</b></span><span>TỐC <b>${style.stats.speed}</b></span></div>
    <div class="element-moves"><span><b>ĐÒN THƯỜNG</b>${style.attackMove.name}<small>${style.attackMove.damage} sát thương · tầm ${style.attackMove.range}</small></span><span><b>PHÒNG THỦ</b>${style.defenseMove.name}<small>${style.defenseMove.description}</small></span><span><b>KỸ NĂNG</b>${style.skillMove.name}<small>${style.skillMove.description}</small></span></div>
  `
}

function showCooldown(id: string, duration: number) {
  const button = element<HTMLButtonElement>(id)
  button.classList.add('cooldown')
  window.setTimeout(() => button.classList.remove('cooldown'), duration * 1000)
}

const world = new GameWorld(element('#world'), {
  onHealth: value => { health = value; renderProfile() },
  onKill: type => {
    showToast(type === 'stone_guardian' ? 'Đã hạ Thạch Vệ · +40 EXP · +15 vàng' : 'Đã hạ Mộc Linh · +25 EXP · +8 vàng')
    rewardQueue = rewardQueue.then(async () => {
      if (!player) return
      const oldLevel = player.level
      player = await recordVictory(player, type)
      world.setMaxHealth(player.maxHealth)
      renderProfile()
      if (player.level > oldLevel) showToast(`Thăng cấp! Bạn đã đạt cấp ${player.level}`)
      else if (player.questKills === 5 && type === 'forest_slime') showToast('Nhiệm vụ nhập môn hoàn thành!')
    }).catch(error => showToast(error instanceof Error ? error.message : 'Không lưu được phần thưởng'))
  },
  onMessage: showToast,
  onCooldown: (action, seconds) => showCooldown(action === 'defense' ? '#dash-button' : '#skill-button', seconds),
  onMove: (x, z) => {
    void realtime.move(x, z).catch(() => {})
    world.setRemotePlayers([...realtime.players.values()], account?.id ?? '')
  },
  onAction: action => {
    const task = action === 'defense' ? realtime.guard() : realtime.attack(action === 'skill')
    void task.catch(() => {})
  },
})
realtime.onPlayers = () => world.setRemotePlayers([...realtime.players.values()], account?.id ?? '')
realtime.onArenaEntered = state => world.setPlayerPosition(state.x, state.z)
realtime.onSelfState = state => world.setPlayerPosition(state.x, state.z)
realtime.onControl = (root, slow, haste) => world.applyPvpControl(root, slow, haste)
realtime.onHit = hit => {
  if (hit.targetId === account?.id) {
    if (hit.killed) world.respawnAtShrine()
    showToast(hit.killed ? 'Bạn đã bị hạ trong trận PK' : `Bạn nhận ${hit.damage} sát thương PK`)
  }
  else if (hit.attackerId === account?.id) showToast(hit.killed ? 'Hạ gục đối thủ!' : `Gây ${hit.damage} sát thương PK`)
}
bindControls(world, app)
renderElementPicker()

const form = element<HTMLFormElement>('#start-form')
const nameInput = element<HTMLInputElement>('#character-name')
const startButton = element<HTMLButtonElement>('#start-button')
startButton.disabled = true
form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!player && nameInput.value.trim().length < 2) {
    showToast('Tên nhân vật cần ít nhất 2 ký tự')
    return
  }
  startButton.disabled = true
  try {
    if (!player) {
      if (account) player = await createCharacter(nameInput.value.trim(), selectedElement)
      else {
        const result = await createPlayer(nameInput.value.trim(), selectedElement)
        player = result.player
        if (!result.online) showToast('Đang chơi ngoại tuyến · tiến trình lưu trên thiết bị')
      }
    } else if (player.element !== selectedElement) {
      player = await changeElement(player, selectedElement)
    }
    if (!gameStarted) health = player.maxHealth
    renderProfile()
    if (!gameStarted) {
      world.start(player.maxHealth, player.element)
      gameStarted = true
      element('#welcome-close').classList.remove('hidden')
    } else {
      world.configureElement(player.element)
      world.setMaxHealth(player.maxHealth)
      world.resume()
    }
    element('#welcome').classList.add('hidden')
    if (account) void realtime.connect().catch(() => showToast('Chưa kết nối được máy chủ nhiều người chơi'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Không tạo được nhân vật')
  } finally { startButton.disabled = false }
})

restoreSession().then(async () => account ? selectedCharacter().catch(() => null) : loadPlayer()).then(stored => {
  if (!stored) return
  player = stored
  selectedElement = stored.element
  nameInput.value = stored.name
  nameInput.readOnly = true
  startButton.innerHTML = 'TIẾP TỤC HÀNH TRÌNH <span>→</span>'
  renderProfile()
  renderElementPicker()
  world.configureElement(selectedElement)
}).finally(() => { startButton.disabled = false })

element('#element-button').addEventListener('click', () => {
  if (!player || !gameStarted) return
  world.pause()
  selectedElement = player.element
  renderElementPicker()
  startButton.innerHTML = 'CHỌN HỆ VÀ TIẾP TỤC <span>→</span>'
  element('#welcome').classList.remove('hidden')
})

element('#welcome-close').addEventListener('click', () => {
  if (!player || !gameStarted) return
  selectedElement = player.element
  world.configureElement(player.element)
  world.resume()
  element('#welcome').classList.add('hidden')
})

function openPanel(content: HTMLElement) {
  if (gameStarted) world.pause()
  const host = element('#panel-content')
  host.replaceChildren(content)
  element('#panel-backdrop').classList.remove('hidden')
}

function closePanel() {
  element('#panel-backdrop').classList.add('hidden')
  if (gameStarted && element('#welcome').classList.contains('hidden')) world.resume()
}

function useAccountPlayer(next: Player | null) {
  const sameCharacter = gameStarted && !!next && player?.id === next.id
  player = next
  if (!next) {
    world.pause()
    gameStarted = false
    nameInput.readOnly = false
    nameInput.value = ''
    element('#welcome').classList.remove('hidden')
    return
  }
  selectedElement = next.element
  nameInput.value = next.name
  nameInput.readOnly = true
  health = next.maxHealth
  renderProfile()
  renderElementPicker()
  if (sameCharacter) {
    world.configureElement(next.element)
    world.setMaxHealth(next.maxHealth)
    world.resume()
  } else world.start(next.maxHealth, next.element)
  gameStarted = true
  element('#welcome-close').classList.remove('hidden')
  element('#welcome').classList.add('hidden')
  closePanel()
  void realtime.connect().catch(() => showToast('Chưa kết nối được máy chủ nhiều người chơi'))
}

function showAccount() {
  const content = document.createElement('div')
  openPanel(content)
  void renderAccountPanel(content, useAccountPlayer, () => {
    void realtime.disconnect()
    useAccountPlayer(null)
  })
}
element('#account-button').addEventListener('click', showAccount)
element('#welcome-account').addEventListener('click', showAccount)
element('#inventory-button').addEventListener('click', () => {
  const content = document.createElement('div')
  openPanel(content)
  if (account) void renderInventoryPanel(content, () => realtime.enterArena())
  else content.textContent = 'Đăng nhập để xem túi đồ.'
})
element('#social-button').addEventListener('click', async () => {
  const content = document.createElement('div')
  openPanel(content)
  const { mountSocialPanel } = await import('./features/social/socialPanel')
  mountSocialPanel(content, realtime)
})

function panelTitle(kicker: string, title: string) {
  const wrapper = document.createElement('div')
  wrapper.className = 'panel-heading'
  const small = document.createElement('small')
  small.textContent = kicker
  const heading = document.createElement('h2')
  heading.textContent = title
  wrapper.append(small, heading)
  return wrapper
}

element('#help-button').addEventListener('click', () => {
  const content = document.createElement('div')
  content.append(panelTitle('HƯỚNG DẪN', 'Bước vào bí cảnh'))
  const guide = document.createElement('div')
  guide.className = 'guide-list'
  for (const [key, label] of [['W A S D', 'Di chuyển trong bản đồ'], ['SPACE', 'Đòn thường theo hệ'], ['SHIFT', 'Chiêu phòng thủ theo hệ'], ['E', 'Kỹ năng tấn công theo hệ']]) {
    const row = document.createElement('div')
    row.innerHTML = `<kbd>${key}</kbd><span>${label}</span>`
    guide.append(row)
  }
  content.append(guide)
  openPanel(content)
})

element('#leaderboard-button').addEventListener('click', async () => {
  const content = document.createElement('div')
  content.append(panelTitle('GIANG HỒ', 'Bảng anh hùng'))
  const list = document.createElement('div')
  list.className = 'leaderboard-list'
  list.textContent = 'Đang tải...'
  content.append(list)
  openPanel(content)
  const leaders = await loadLeaderboard()
  list.replaceChildren()
  if (leaders.length === 0) {
    list.textContent = 'Chưa có anh hùng nào trên bảng xếp hạng.'
    return
  }
  leaders.forEach((leader, index) => {
    const row = document.createElement('div')
    row.className = 'leaderboard-row'
    const rank = document.createElement('b')
    rank.textContent = String(index + 1).padStart(2, '0')
    const name = document.createElement('span')
    name.textContent = leader.name
    const score = document.createElement('small')
    score.textContent = `${getElement(leader.element).name} · Cấp ${leader.level} · ${leader.totalKills} hạ gục`
    row.append(rank, name, score)
    list.append(row)
  })
})

element('#panel-close').addEventListener('click', closePanel)
element('#panel-backdrop').addEventListener('click', event => {
  if (event.target === event.currentTarget) closePanel()
})
