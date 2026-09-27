import * as THREE from 'three'
import { elements, type ElementStyle } from './elements'

const toon = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.88 })
const robe = toon(0xe7dfc5)
const blue = toon(0x2d6268)
const navy = toon(0x253c43)
const red = toon(0xb65d46)
const skin = toon(0xe2b38b)
const hair = toon(0x202d31)
const steel = toon(0xc7e0d9)
const gold = toon(0xc9a263)
const slime = toon(0x74b99b)
const slimeTop = toon(0x4f917b)
const stone = toon(0x81958d)
const woodWeapon = toon(0x72513b)
const eye = toon(0x182c2d)
const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x183a31, transparent: true, opacity: 0.18, depthWrite: false })

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(x, y, z)
  parent.add(item)
  return item
}

function shadow(parent: THREE.Object3D, radius: number) {
  const disk = mesh(parent, new THREE.CircleGeometry(radius, 16), shadowMaterial, 0, 0.035, 0)
  disk.rotation.x = -Math.PI / 2
  return disk
}

export interface HeroVisual {
  root: THREE.Group
  body: THREE.Group
  swordPivot: THREE.Group
  halo: THREE.Mesh
}

export function createHero(scene: THREE.Scene): HeroVisual {
  const root = new THREE.Group()
  const body = new THREE.Group()
  scene.add(root)
  root.add(body)
  shadow(root, 0.62)

  mesh(body, new THREE.CylinderGeometry(0.37, 0.5, 1.08, 7), robe, 0, 1.08)
  mesh(body, new THREE.CylinderGeometry(0.44, 0.33, 0.22, 8), blue, 0, 0.83)
  mesh(body, new THREE.BoxGeometry(0.18, 0.22, 0.85), red, 0, 0.89, 0.32)
  mesh(body, new THREE.SphereGeometry(0.34, 9, 7), skin, 0, 1.91)
  mesh(body, new THREE.SphereGeometry(0.35, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.47), hair, 0, 2.05)
  mesh(body, new THREE.ConeGeometry(0.18, 0.43, 7), hair, 0, 2.43, -0.12)
  for (const x of [-0.23, 0.23]) {
    mesh(body, new THREE.BoxGeometry(0.2, 0.5, 0.23), navy, x, 0.35, 0)
    mesh(body, new THREE.SphereGeometry(0.045, 5, 5), eye, x * 0.55, 1.95, 0.31)
  }
  mesh(body, new THREE.CylinderGeometry(0.13, 0.16, 0.72, 6), robe, -0.48, 1.32, 0)
    .rotation.z = -0.24
  mesh(body, new THREE.CylinderGeometry(0.13, 0.16, 0.72, 6), robe, 0.48, 1.32, 0)
    .rotation.z = 0.24

  const swordPivot = new THREE.Group()
  swordPivot.position.set(0.58, 1.06, 0.2)
  body.add(swordPivot)
  swordPivot.rotation.z = -0.2

  const halo = mesh(root, new THREE.RingGeometry(0.72, 0.79, 32),
    new THREE.MeshBasicMaterial({ color: 0xe9cb7d, transparent: true, opacity: 0.75, side: THREE.DoubleSide }), 0, 0.055)
  halo.rotation.x = -Math.PI / 2
  const hero = { root, body, swordPivot, halo }
  setHeroElement(hero, elements.metal)
  return hero
}

export function setHeroElement(hero: HeroVisual, style: ElementStyle) {
  blue.color.setHex(style.colorHex)
  red.color.setHex(style.colorHex)
  steel.color.setHex(style.colorHex)
  for (const child of [...hero.swordPivot.children]) {
    if (child instanceof THREE.Mesh) child.geometry.dispose()
    hero.swordPivot.remove(child)
  }
  const weapon = hero.swordPivot
  if (style.id === 'wood') {
    mesh(weapon, new THREE.CylinderGeometry(0.07, 0.09, 1.75, 6), woodWeapon, 0, 0.98)
    mesh(weapon, new THREE.ConeGeometry(0.32, 0.65, 5), blue, 0, 1.92)
  } else if (style.id === 'water') {
    mesh(weapon, new THREE.CylinderGeometry(0.06, 0.07, 1.8, 6), navy, 0, 0.98)
    for (const x of [-0.2, 0, 0.2]) mesh(weapon, new THREE.ConeGeometry(0.08, 0.42, 5), steel, x, 2.02)
    mesh(weapon, new THREE.BoxGeometry(0.48, 0.08, 0.09), steel, 0, 1.72)
  } else if (style.id === 'earth') {
    mesh(weapon, new THREE.CylinderGeometry(0.07, 0.08, 1.4, 6), woodWeapon, 0, 0.78)
    mesh(weapon, new THREE.BoxGeometry(0.72, 0.42, 0.38), stone, 0, 1.55)
  } else if (style.id === 'qi') {
    mesh(weapon, new THREE.CylinderGeometry(0.06, 0.06, 1.75, 6), navy, 0, 0.95)
    mesh(weapon, new THREE.TorusGeometry(0.26, 0.075, 6, 10), blue, 0, 1.93)
  } else {
    mesh(weapon, new THREE.BoxGeometry(0.12, 0.4, 0.12), navy, 0, 0.14)
    mesh(weapon, new THREE.BoxGeometry(0.5, 0.1, 0.2), gold, 0, 0.38)
    mesh(weapon, new THREE.BoxGeometry(0.13, 1.2, 0.16), steel, 0, 1.02)
    mesh(weapon, new THREE.ConeGeometry(0.12, 0.36, 4), steel, 0, 1.79)
  }
  ;(hero.halo.material as THREE.MeshBasicMaterial).color.setHex(style.colorHex)
}

export interface EnemyVisual {
  root: THREE.Group
  body: THREE.Group
  healthBar: THREE.Mesh
  statusRing: THREE.Mesh
}

export function createEnemy(scene: THREE.Scene, type: string): EnemyVisual {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  scene.add(root)
  shadow(root, type === 'stone_guardian' ? 0.85 : 0.65)
  const statusRing = mesh(root, new THREE.RingGeometry(0.73, 0.79, 18),
    new THREE.MeshBasicMaterial({ color: 0x8bd5ea, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), 0, 0.04)
  statusRing.rotation.x = -Math.PI / 2
  statusRing.visible = false

  if (type === 'stone_guardian') {
    mesh(body, new THREE.DodecahedronGeometry(0.78, 0), stone, 0, 0.98)
    mesh(body, new THREE.DodecahedronGeometry(0.5, 0), stone, 0, 1.89)
    for (const x of [-0.64, 0.64]) {
      mesh(body, new THREE.DodecahedronGeometry(0.31, 0), stone, x, 1.2)
      mesh(body, new THREE.BoxGeometry(0.1, 0.11, 0.11), gold, x * 0.36, 1.94, 0.43)
    }
    mesh(body, new THREE.BoxGeometry(0.5, 0.1, 0.1), gold, 0, 0.95, 0.7)
  } else {
    const dome = mesh(body, new THREE.SphereGeometry(0.64, 10, 7), slime, 0, 0.65)
    dome.scale.set(1, 0.82, 0.87)
    mesh(body, new THREE.ConeGeometry(0.37, 0.62, 5), slimeTop, 0, 1.34)
    for (const x of [-0.22, 0.22]) {
      mesh(body, new THREE.SphereGeometry(0.07, 6, 5), eye, x, 0.76, 0.5)
    }
    mesh(body, new THREE.SphereGeometry(0.13, 6, 5), slimeTop, -0.49, 0.46, 0.3)
    mesh(body, new THREE.SphereGeometry(0.13, 6, 5), slimeTop, 0.49, 0.46, 0.3)
  }

  const barBack = mesh(root, new THREE.PlaneGeometry(0.96, 0.085),
    new THREE.MeshBasicMaterial({ color: 0x1d3b38, side: THREE.DoubleSide }),
    0, type === 'stone_guardian' ? 2.75 : 1.85)
  barBack.rotation.x = -0.45
  const healthBar = mesh(root, new THREE.PlaneGeometry(0.9, 0.055),
    new THREE.MeshBasicMaterial({ color: type === 'stone_guardian' ? 0xe7a66e : 0xa8e1bb, side: THREE.DoubleSide }),
    0, barBack.position.y, 0.006)
  healthBar.rotation.x = -0.45
  return { root, body, healthBar, statusRing }
}
