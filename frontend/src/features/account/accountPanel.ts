import { account, characters, importGuest, restoreSession, selectCharacter, selectedCharacter, signIn, signOut, type Character } from './session'
import type { Player } from '../characters/gameApi'

export async function renderAccountPanel(host: HTMLElement, onPlayer: (player: Player | null) => void, onLogout: () => void) {
  host.replaceChildren()
  const title = document.createElement('h2')
  title.textContent = account ? `Tài khoản ${account.displayName}` : 'Tài khoản'
  host.append(title)
  const notice = document.createElement('p')
  notice.className = 'feature-notice'
  host.append(notice)
  const error = (reason: unknown) => { notice.textContent = reason instanceof Error ? reason.message : String(reason) }
  if (!account) {
    const form = document.createElement('form')
    form.className = 'feature-form'
    form.innerHTML = `<label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Mật khẩu<input name="password" type="password" minlength="8" autocomplete="current-password" required></label>
      <label>Tên tài khoản (khi đăng ký)<input name="displayName" maxlength="24" autocomplete="nickname"></label>
      <label class="check-row"><input name="remember" type="checkbox" checked> Ghi nhớ đăng nhập</label>
      <button type="submit" name="mode" value="login">Đăng nhập</button>
      <button type="submit" name="mode" value="register">Đăng ký</button>`
    form.addEventListener('submit', async event => {
      event.preventDefault()
      const data = new FormData(form)
      const mode = (event.submitter as HTMLButtonElement)?.value === 'register' ? 'register' : 'login'
      try {
        await signIn(mode, String(data.get('email')), String(data.get('password')),
          String(data.get('displayName') || ''), data.has('remember'))
        await renderAccountPanel(host, onPlayer, onLogout)
        try { onPlayer(await selectedCharacter()) } catch { onPlayer(null) }
      } catch (e) { error(e) }
    })
    host.append(form)
    return
  }
  const logout = document.createElement('button')
  logout.textContent = 'Đăng xuất'
  logout.addEventListener('click', async () => {
    try { await signOut(); onLogout(); await renderAccountPanel(host, onPlayer, onLogout) } catch (e) { error(e) }
  })
  host.append(logout)
  const subtitle = document.createElement('h3')
  subtitle.textContent = 'Nhân vật (tối đa 3)'
  host.append(subtitle)
  const list = document.createElement('div')
  list.className = 'feature-list'
  host.append(list)
  const rows = await characters().catch(() => [] as Character[])
  for (const character of rows) {
    const row = document.createElement('div')
    row.className = 'feature-row'
    const label = document.createElement('span')
    label.textContent = `${character.name} · ${character.element} · Cấp ${character.level}`
    const button = document.createElement('button')
    button.textContent = character.id === account.selectedCharacterId ? 'Đang chọn' : 'Chọn'
    button.addEventListener('click', async () => {
      try {
        await selectCharacter(character.id)
        await restoreSession()
        onPlayer(await selectedCharacter())
        await renderAccountPanel(host, onPlayer, onLogout)
      } catch (e) { error(e) }
    })
    row.append(label, button)
    list.append(row)
  }
  if (rows.length < 3) {
    const guest = localStorage.getItem('truc-lam-player')
    if (guest) {
      const button = document.createElement('button')
      button.textContent = 'Nhập nhân vật chơi thử đã lưu'
      button.addEventListener('click', async () => {
        try {
          const saved = JSON.parse(guest) as Player
          onPlayer(await importGuest(saved.id))
          await restoreSession()
          await renderAccountPanel(host, onPlayer, onLogout)
        } catch (e) { error(e) }
      })
      host.append(button)
    }
    const hint = document.createElement('p')
    hint.textContent = 'Để tạo nhân vật mới, chọn hệ và nhập tên ở màn hình bắt đầu.'
    host.append(hint)
  }
}
