import * as THREE from 'three'
import { createHero, createEnemy, setHeroElement, type EnemyVisual } from './actors'
import { createEnvironment } from './environment'
import { elements, getElement, type ElementId, type ElementStyle } from './elements'
import { assetsFor } from '../assets/assetManifest'

function disposeObject(root: THREE.Object3D) {
  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
      material.dispose()
    }
  })
}

export interface MoveInput { x: number; z: number }
type Enemy = {
  type: string
  visual: EnemyVisual
  spawn: THREE.Vector3
  health: number
  maxHealth: number
  damage: number
  alive: boolean
  attackAt: number
  respawnAt: number
  phase: number
  immobilizedUntil: number
  slowUntil: number
  burnUntil: number
  burnNextAt: number
  burnDamage: number
}

export interface WorldEvents {
  onHealth: (health: number) => void
  onKill: (type: string) => void
  onMessage: (message: string) => void
  onCooldown: (action: 'defense' | 'skill', seconds: number) => void
  onMove?: (x: number, z: number) => void
  onAction?: (action: 'attack' | 'defense' | 'skill') => void
}

export class GameWorld {
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera()
  private renderer: THREE.WebGLRenderer
  private hero = createHero(this.scene)
  private style: ElementStyle = elements.metal
  private enemies: Enemy[] = []
  private clock = new THREE.Clock()
  private input: MoveInput = { x: 0, z: 0 }
  private elapsed = 0
  private active = false
  private maxHealth = 100
  private health = 100
  private lastAttack = -10
  private lastDash = -10
  private lastSkill = -10
  private attackUntil = 0
  private dashUntil = 0
  private guardUntil = 0
  private hasteUntil = 0
  private healTickAt = 0
  private hitFlashUntil = 0
  private cameraTarget = new THREE.Vector3()
  private resizeObserver: ResizeObserver
  private remote = new Map<string, THREE.Group>()
  private remoteTargets = new Map<string, THREE.Vector3>()
  private lastSentAt = 0
  private lastSentX = NaN
  private lastSentZ = NaN
  private pvpRootUntil = 0
  private pvpSlowUntil = 0
  private pvpHasteUntil = 0
  private customModel: THREE.Object3D | null = null
  private skillImage: THREE.Mesh | null = null
  private skillImageUntil = 0
  private modelRequest = 0

  constructor(private host: HTMLElement, private events: WorldEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power', alpha: false })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 800 ? 1.25 : 1.5))
    this.host.appendChild(this.renderer.domElement)
    this.renderer.domElement.setAttribute('aria-label', 'Thế giới Trúc Lâm Bí Cảnh')

    this.scene.add(new THREE.HemisphereLight(0xe8f5dc, 0x7c907b, 2.4))
    const sun = new THREE.DirectionalLight(0xffe8bc, 2.2)
    sun.position.set(-8, 18, 8)
    this.scene.add(sun)
    createEnvironment(this.scene)
    this.hero.root.position.set(0, 0, 6.5)
    this.addEnemy('forest_slime', -2.8, 4.8, 0.5)
    this.addEnemy('forest_slime', 2.8, 4.4, 1.8)
    this.addEnemy('forest_slime', -5.3, -1.7, 2.5)
    this.addEnemy('forest_slime', 5.4, -5.1, 3.7)
    this.addEnemy('forest_slime', -7.2, -7.5, 4.4)
    this.addEnemy('stone_guardian', 7.5, -8, 5.5)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.host)
    this.resize()
    this.renderer.setAnimationLoop(() => this.update())
  }

  start(maxHealth: number, elementId: ElementId) {
    this.configureElement(elementId)
    this.pvpRootUntil = 0
    this.pvpSlowUntil = 0
    this.pvpHasteUntil = 0
    this.hero.root.position.set(0, 0, 6.5)
    this.active = true
    this.maxHealth = maxHealth
    this.health = maxHealth
    this.events.onHealth(this.health)
  }

  pause() { this.active = false }
  resume() { this.active = true }
  respawnAtShrine() {
    this.hero.root.position.set(0, 0, 6.5)
    this.pvpRootUntil = 0
    this.pvpSlowUntil = 0
    this.pvpHasteUntil = 0
  }
  setPlayerPosition(x: number, z: number) { this.hero.root.position.set(x, 0, z) }
  applyPvpControl(rootSeconds: number, slowSeconds: number, hasteSeconds: number) {
    this.pvpRootUntil = Math.max(this.pvpRootUntil, this.elapsed + rootSeconds)
    this.pvpSlowUntil = Math.max(this.pvpSlowUntil, this.elapsed + slowSeconds)
    this.pvpHasteUntil = Math.max(this.pvpHasteUntil, this.elapsed + hasteSeconds)
  }

  configureElement(elementId: ElementId) {
    this.style = getElement(elementId)
    setHeroElement(this.hero, this.style)
    void this.loadCharacterModel(elementId)
    if (this.skillImage) {
      this.hero.root.remove(this.skillImage)
      this.skillImage.geometry.dispose()
      const material = this.skillImage.material as THREE.MeshBasicMaterial
      material.map?.dispose()
      material.dispose()
      this.skillImage = null
    }
    const skillTexture = assetsFor(elementId).skillTexture
    const imageRequest = this.modelRequest
    if (skillTexture) new THREE.TextureLoader().load(skillTexture, texture => {
      if (imageRequest !== this.modelRequest) { texture.dispose(); return }
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, opacity: 0.8 })
      const image = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), material)
      image.rotation.x = -Math.PI / 2
      image.position.y = 0.09
      image.visible = false
      this.hero.root.add(image)
      this.skillImage = image
    })
    this.guardUntil = 0
    this.dashUntil = 0
    this.hasteUntil = 0
  }

  setMaxHealth(maxHealth: number) {
    const gained = maxHealth - this.maxHealth
    this.maxHealth = maxHealth
    this.health = Math.min(maxHealth, this.health + Math.max(0, gained))
    this.events.onHealth(this.health)
  }

  setMovement(input: MoveInput) { this.input = input }
  getPosition() { return { x: this.hero.root.position.x, z: this.hero.root.position.z } }

  setRemotePlayers(players: readonly { accountId: string; element: string; x: number; z: number }[], selfId: string) {
    const near = players.filter(p => p.accountId !== selfId &&
      (p.x - this.hero.root.position.x) ** 2 + (p.z - this.hero.root.position.z) ** 2 < 18 ** 2)
      .sort((a, b) =>
        (a.x - this.hero.root.position.x) ** 2 + (a.z - this.hero.root.position.z) ** 2 -
        (b.x - this.hero.root.position.x) ** 2 - (b.z - this.hero.root.position.z) ** 2).slice(0, 24)
    const visible = new Set(near.map(p => p.accountId))
    for (const [id, object] of this.remote) if (!visible.has(id)) {
      this.scene.remove(object)
      disposeObject(object)
      this.remote.delete(id)
      this.remoteTargets.delete(id)
    }
    for (const player of near) {
      let object = this.remote.get(player.accountId)
      if (!object) {
        object = new THREE.Group()
        const color = getElement(player.element as ElementId).colorHex
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.85, 3, 6),
          new THREE.MeshStandardMaterial({ color, flatShading: true }))
        body.position.y = 1.05
        object.add(body)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.57, 20),
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.05
        object.add(ring)
        this.scene.add(object)
        this.remote.set(player.accountId, object)
        object.position.set(player.x, 0, player.z)
      }
      this.remoteTargets.set(player.accountId, new THREE.Vector3(player.x, 0, player.z))
    }
  }

  private async loadCharacterModel(elementId: ElementId) {
    const request = ++this.modelRequest
    if (this.customModel) { this.hero.root.remove(this.customModel); disposeObject(this.customModel); this.customModel = null }
    this.hero.body.visible = true
    const path = assetsFor(elementId).characterModel
    if (!path) return
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
      const model = await new GLTFLoader().loadAsync(path)
      if (request !== this.modelRequest) { disposeObject(model.scene); return }
      this.customModel = model.scene
      this.hero.root.add(model.scene)
      this.hero.body.visible = false
    } catch { this.hero.body.visible = true }
  }

  attack() {
    if (!this.active || this.elapsed < this.pvpRootUntil || this.elapsed - this.lastAttack < this.style.attackMove.cooldown) return
    this.lastAttack = this.elapsed
    this.events.onAction?.('attack')
    this.attackUntil = this.elapsed + 0.25
    const move = this.style.attackMove
    const hits = this.hitEnemies(move.range, move.damage, true, 'attack')
    if (this.style.id === 'wood' && hits > 0) this.heal(3 * hits)
  }

  defend() {
    const move = this.style.defenseMove
    if (!this.active || this.elapsed < this.pvpRootUntil || this.elapsed - this.lastDash < move.cooldown) return
    this.lastDash = this.elapsed
    this.events.onAction?.('defense')
    this.guardUntil = this.elapsed + move.duration
    if (this.style.id === 'water' || this.style.id === 'qi')
      this.dashUntil = this.elapsed + (this.style.id === 'qi' ? 0.28 : 0.24)
    if (this.style.id === 'wood') { this.heal(12); this.healTickAt = this.elapsed + 0.6 }
    if (this.style.id === 'qi') this.hasteUntil = this.elapsed + 3
    this.events.onCooldown('defense', move.cooldown)
    this.events.onMessage(move.name)
  }

  skill() {
    const move = this.style.skillMove
    if (!this.active || this.elapsed < this.pvpRootUntil || this.elapsed - this.lastSkill < move.cooldown) return
    this.lastSkill = this.elapsed
    this.skillImageUntil = this.elapsed + 0.55
    this.events.onAction?.('skill')
    this.events.onCooldown('skill', move.cooldown)
    const hits = this.hitEnemies(move.range, move.damage, this.style.id === 'metal', 'skill')
    if (this.style.id === 'wood') this.heal(hits * 8)
    if (this.style.id === 'water') this.heal(hits * 6)
    if (this.style.id === 'qi') this.hasteUntil = this.elapsed + 3
    const ring = this.hero.halo.material as THREE.MeshBasicMaterial
    ring.color.setHex(0xffffff)
    this.hitFlashUntil = this.elapsed + 0.32
  }

  dispose() {
    this.modelRequest++
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    for (const object of this.remote.values()) { this.scene.remove(object); disposeObject(object) }
    this.remote.clear()
    this.remoteTargets.clear()
    if (this.customModel) { this.hero.root.remove(this.customModel); disposeObject(this.customModel); this.customModel = null }
    if (this.skillImage) {
      this.hero.root.remove(this.skillImage)
      disposeObject(this.skillImage)
      this.skillImage = null
    }
  }

  private addEnemy(type: string, x: number, z: number, phase: number) {
    const visual = createEnemy(this.scene, type)
    visual.root.position.set(x, 0, z)
    const maxHealth = type === 'stone_guardian' ? 80 : 42
    this.enemies.push({
      type, visual, spawn: new THREE.Vector3(x, 0, z), health: maxHealth,
      maxHealth, damage: type === 'stone_guardian' ? 13 : 8,
      alive: true, attackAt: 0, respawnAt: 0, phase,
      immobilizedUntil: 0, slowUntil: 0, burnUntil: 0, burnNextAt: 0, burnDamage: 0,
    })
  }

  private hitEnemies(radius: number, damage: number, directional: boolean, source: 'attack' | 'skill') {
    const facing = new THREE.Vector2(Math.sin(this.hero.root.rotation.y), Math.cos(this.hero.root.rotation.y))
    let hits = 0
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      const dx = enemy.visual.root.position.x - this.hero.root.position.x
      const dz = enemy.visual.root.position.z - this.hero.root.position.z
      const distance = Math.hypot(dx, dz)
      if (distance > radius) continue
      if (directional && distance > 0.6 && (dx * facing.x + dz * facing.y) / distance < 0.12) continue
      this.damageEnemy(enemy, damage)
      hits++
      if (enemy.alive) this.applyStatus(enemy, source)
    }
    if (hits === 0 && !directional) this.events.onMessage('Kỹ năng chưa chạm mục tiêu')
    return hits
  }

  private damageEnemy(enemy: Enemy, damage: number) {
    if (!enemy.alive) return
    enemy.health = Math.max(0, enemy.health - damage)
    enemy.visual.healthBar.scale.x = enemy.health / enemy.maxHealth
    enemy.visual.healthBar.position.x = -0.45 * (1 - enemy.health / enemy.maxHealth)
    enemy.visual.body.scale.setScalar(1.15)
    if (enemy.health === 0) {
      enemy.alive = false
      enemy.visual.root.visible = false
      enemy.respawnAt = this.elapsed + 7
      this.events.onKill(enemy.type)
    }
  }

  private applyStatus(enemy: Enemy, source: 'attack' | 'skill') {
    const strong = source === 'skill'
    switch (this.style.id) {
      case 'wood': if (strong) enemy.immobilizedUntil = this.elapsed + 3; break
      case 'water': enemy.slowUntil = this.elapsed + (strong ? 4 : 1.5); break
      case 'fire':
        enemy.burnUntil = this.elapsed + (strong ? 3 : 2)
        enemy.burnNextAt = this.elapsed + 1
        enemy.burnDamage = strong ? 8 : 4
        break
      case 'earth': enemy.immobilizedUntil = this.elapsed + (strong ? 2.4 : 0.35); break
      case 'ice':
        if (strong) enemy.immobilizedUntil = this.elapsed + 3
        else enemy.slowUntil = this.elapsed + 1.8
        break
      case 'qi':
        if (strong) {
          const direction = enemy.visual.root.position.clone().sub(this.hero.root.position).normalize()
          enemy.visual.root.position.addScaledVector(direction, 2.1)
        }
        break
    }
  }

  private heal(amount: number) {
    if (amount <= 0) return
    this.health = Math.min(this.maxHealth, this.health + amount)
    this.events.onHealth(Math.ceil(this.health))
  }

  private update() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.elapsed += dt
    if (this.active) this.updateActors(dt)
    if (this.active && this.elapsed - this.lastSentAt > 0.12 &&
        (Math.abs(this.hero.root.position.x - this.lastSentX) > 0.02 ||
         Math.abs(this.hero.root.position.z - this.lastSentZ) > 0.02 ||
         this.elapsed - this.lastSentAt > 2)) {
      this.lastSentAt = this.elapsed
      this.lastSentX = this.hero.root.position.x
      this.lastSentZ = this.hero.root.position.z
      this.events.onMove?.(this.hero.root.position.x, this.hero.root.position.z)
    }
    for (const [id, object] of this.remote) {
      const target = this.remoteTargets.get(id)
      if (target) object.position.lerp(target, 1 - Math.exp(-dt * 12))
    }

    const target = this.hero.root.position
    this.cameraTarget.lerp(target, 1 - Math.exp(-dt * 4))
    this.camera.position.set(this.cameraTarget.x, 18, this.cameraTarget.z + 21)
    this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z)
    this.hero.body.position.y = Math.sin(this.elapsed * 5) * 0.035
    this.hero.swordPivot.rotation.z = this.elapsed < this.attackUntil
      ? -1.8 + Math.sin((this.attackUntil - this.elapsed) * 16) * 1.1 : -0.2
    const halo = this.hero.halo.material as THREE.MeshBasicMaterial
    if (this.skillImage) {
      this.skillImage.visible = this.elapsed < this.skillImageUntil
      if (this.skillImage.visible) this.skillImage.scale.setScalar(0.6 + (this.skillImageUntil - this.elapsed) * 1.3)
    }
    if (this.elapsed > this.hitFlashUntil) halo.color.setHex(this.style.colorHex)
    this.hero.halo.scale.setScalar(this.elapsed < this.guardUntil ? 1.45 : 1)
    halo.opacity = this.elapsed < this.guardUntil ? 0.95 : 0.55 + Math.sin(this.elapsed * 3) * 0.15
    this.renderer.render(this.scene, this.camera)
  }

  private updateActors(dt: number) {
    if (this.style.id === 'wood' && this.elapsed < this.guardUntil && this.elapsed >= this.healTickAt) {
      this.heal(4)
      this.healTickAt = this.elapsed + 0.6
    }
    const length = Math.hypot(this.input.x, this.input.z)
    if (this.elapsed >= this.pvpRootUntil && (length > 0.05 || this.elapsed < this.dashUntil)) {
      const dx = length > 0.05 ? this.input.x / Math.max(1, length) : Math.sin(this.hero.root.rotation.y)
      const dz = length > 0.05 ? this.input.z / Math.max(1, length) : Math.cos(this.hero.root.rotation.y)
      if (length > 0.05) this.hero.root.rotation.y = Math.atan2(dx, dz)
      const baseSpeed = this.style.stats.speed *
        (this.elapsed < this.hasteUntil || this.elapsed < this.pvpHasteUntil ? 1.35 : 1) *
        (this.elapsed < this.pvpSlowUntil ? 0.55 : 1)
      const speed = this.elapsed < this.dashUntil ? (this.style.id === 'qi' ? 23 : 18) : baseSpeed
      this.hero.root.position.x = THREE.MathUtils.clamp(this.hero.root.position.x + dx * speed * dt, -18.8, 18.8)
      this.hero.root.position.z = THREE.MathUtils.clamp(this.hero.root.position.z + dz * speed * dt, -13.4, 13.4)
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        if (this.elapsed >= enemy.respawnAt) {
          enemy.alive = true
          enemy.health = enemy.maxHealth
          enemy.visual.root.position.copy(enemy.spawn)
          enemy.visual.root.visible = true
          enemy.visual.healthBar.scale.x = 1
          enemy.visual.healthBar.position.x = 0
          enemy.immobilizedUntil = 0
          enemy.slowUntil = 0
          enemy.burnUntil = 0
        }
        continue
      }
      if (this.elapsed < enemy.burnUntil && this.elapsed >= enemy.burnNextAt) {
        enemy.burnNextAt += 1
        this.damageEnemy(enemy, enemy.burnDamage)
        if (!enemy.alive) continue
      }
      const statusActive = this.elapsed < enemy.immobilizedUntil ||
        this.elapsed < enemy.slowUntil || this.elapsed < enemy.burnUntil
      enemy.visual.statusRing.visible = statusActive
      if (statusActive) {
        const color = this.elapsed < enemy.burnUntil ? 0xf49b60
          : this.elapsed < enemy.immobilizedUntil ? 0xa5dbf2 : 0x82d6e3
        ;(enemy.visual.statusRing.material as THREE.MeshBasicMaterial).color.setHex(color)
      }
      const position = enemy.visual.root.position
      const toHero = this.hero.root.position.clone().sub(position)
      const distance = toHero.length()
      if (distance < 6.4 && distance > 1.1 && this.elapsed >= enemy.immobilizedUntil) {
        toHero.normalize()
        const speed = (enemy.type === 'stone_guardian' ? 1.05 : 1.55) *
          (this.elapsed < enemy.slowUntil ? 0.45 : 1)
        position.addScaledVector(toHero, speed * dt)
      } else if (distance > 8 && position.distanceTo(enemy.spawn) > 0.8) {
        position.lerp(enemy.spawn, dt * 0.33)
      }
      enemy.visual.root.rotation.y = Math.atan2(toHero.x, toHero.z)
      enemy.visual.body.position.y = Math.sin(this.elapsed * 3.5 + enemy.phase) * 0.11
      enemy.visual.body.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 8)
      if (distance < 1.3 && this.elapsed >= enemy.attackAt && this.elapsed >= enemy.immobilizedUntil) {
        enemy.attackAt = this.elapsed + 1.4
        let damage = Math.max(1, enemy.damage - Math.round(this.style.stats.defense * 0.2))
        if (this.elapsed < this.guardUntil) {
          switch (this.style.id) {
            case 'metal': damage = Math.ceil(damage * 0.3); break
            case 'wood': damage = Math.ceil(damage * 0.75); break
            case 'water': damage = 0; break
            case 'fire': damage = Math.ceil(damage * 0.5); this.damageEnemy(enemy, 14); break
            case 'earth': damage = Math.ceil(damage * 0.2); break
            case 'ice': damage = Math.ceil(damage * 0.65); enemy.immobilizedUntil = this.elapsed + 1.5; break
            case 'qi': damage = 0; break
          }
        }
        this.health = Math.max(0, this.health - damage)
        this.events.onHealth(Math.ceil(this.health))
        if (this.health === 0) {
          this.health = this.maxHealth
          this.hero.root.position.set(0, 0, 6.5)
          this.events.onHealth(this.health)
          this.events.onMessage('Bạn đã hồi sinh tại lối vào bí cảnh')
        }
      }
    }
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    const aspect = width / height
    const halfHeight = aspect < 0.8 ? 12.5 : 8.2
    this.camera.left = -halfHeight * aspect
    this.camera.right = halfHeight * aspect
    this.camera.top = halfHeight
    this.camera.bottom = -halfHeight
    this.camera.near = 0.1
    this.camera.far = 100
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }
}
