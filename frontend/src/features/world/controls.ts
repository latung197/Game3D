import type { GameWorld, MoveInput } from './GameWorld'

export function bindControls(world: GameWorld, root: HTMLElement) {
  const keys = new Set<string>()
  const joystick = root.querySelector<HTMLElement>('#joystick')!
  const thumb = root.querySelector<HTMLElement>('#joystick-thumb')!
  let touch: MoveInput = { x: 0, z: 0 }
  let pointerId: number | null = null

  const updateMovement = () => {
    const x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'))
    const z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'))
    world.setMovement({ x: Math.max(-1, Math.min(1, x + touch.x)), z: Math.max(-1, Math.min(1, z + touch.z)) })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!root.querySelector('#panel-backdrop')?.classList.contains('hidden')) return
    if (event.target instanceof HTMLElement &&
        (event.target.matches('input,select,textarea,button') || event.target.isContentEditable)) return
    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'e'].includes(key))
      event.preventDefault()
    keys.add(key)
    updateMovement()
    if (event.repeat) return
    if (key === ' ') world.attack()
    if (key === 'shift') world.defend()
    if (key === 'e') world.skill()
  }
  const onKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.key.toLowerCase())
    updateMovement()
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  const moveJoystick = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return
    const rect = joystick.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const radius = rect.width * 0.32
    const length = Math.max(1, Math.hypot(dx, dy))
    const factor = Math.min(1, radius / length)
    thumb.style.transform = `translate(${dx * factor}px, ${dy * factor}px)`
    touch = { x: (dx * factor) / radius, z: (dy * factor) / radius }
    updateMovement()
  }
  const stopJoystick = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return
    pointerId = null
    thumb.style.transform = ''
    touch = { x: 0, z: 0 }
    updateMovement()
  }
  joystick.addEventListener('pointerdown', event => {
    pointerId = event.pointerId
    joystick.setPointerCapture(pointerId)
    moveJoystick(event)
  })
  joystick.addEventListener('pointermove', moveJoystick)
  joystick.addEventListener('pointerup', stopJoystick)
  joystick.addEventListener('pointercancel', stopJoystick)

  root.querySelector('#attack-button')?.addEventListener('pointerdown', event => { event.preventDefault(); world.attack() })
  root.querySelector('#dash-button')?.addEventListener('pointerdown', event => { event.preventDefault(); world.defend() })
  root.querySelector('#skill-button')?.addEventListener('pointerdown', event => { event.preventDefault(); world.skill() })

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }
}
