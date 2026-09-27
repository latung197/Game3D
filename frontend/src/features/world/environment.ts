import * as THREE from 'three'

const mat = (color: number, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true })
const grass = mat(0x6f9a68)
const darkGrass = mat(0x557a58)
const sand = mat(0xcbb990)
const wood = mat(0x77513c)
const redWood = mat(0x984c3d)
const roof = mat(0x344849)
const stone = mat(0x97a49a)
const leaf = mat(0x456f50)
const paleLeaf = mat(0x759765)
const water = new THREE.MeshStandardMaterial({ color: 0x6ca9a2, transparent: true, opacity: 0.86, roughness: 0.25 })
const gold = mat(0xd9ad61, 0.55)

function box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function cylinder(parent: THREE.Object3D, top: number, bottom: number, h: number, material: THREE.Material, x: number, y: number, z: number, sides = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, sides), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function createShrine(scene: THREE.Scene) {
  const shrine = new THREE.Group()
  shrine.position.set(10.7, 0, -6.9)
  scene.add(shrine)
  box(shrine, 7.2, 0.55, 5.2, stone, 0, 0.28, 0)
  box(shrine, 6.2, 0.22, 4.3, wood, 0, 0.68, 0)
  for (const x of [-2.5, 2.5]) for (const z of [-1.6, 1.6])
    cylinder(shrine, 0.16, 0.21, 3.3, redWood, x, 2.3, z)
  box(shrine, 6.7, 0.3, 4.6, roof, 0, 4, 0)
  const ridge = box(shrine, 7.3, 0.35, 1.7, roof, 0, 4.55, 0)
  ridge.rotation.z = -0.03
  box(shrine, 6.7, 0.25, 0.25, gold, 0, 3.7, 2.3)
  for (const x of [-3.05, 3.05]) {
    cylinder(shrine, 0.1, 0.14, 0.65, gold, x, 3.65, 2.2)
    box(shrine, 0.5, 0.42, 0.5, gold, x, 3.2, 2.2)
  }
  box(shrine, 1.7, 1.4, 0.5, darkGrass, 0, 1.45, -1.7)
  cylinder(shrine, 0.45, 0.55, 1.25, gold, 0, 1.48, 0.5)
  box(shrine, 1.6, 0.12, 1.6, wood, 0, 0.85, 0.5)
}

function createGate(scene: THREE.Scene) {
  const gate = new THREE.Group()
  gate.position.set(-9, 0, -6.7)
  scene.add(gate)
  for (const x of [-2.1, 2.1]) {
    cylinder(gate, 0.18, 0.23, 3.6, redWood, x, 1.8, 0)
    box(gate, 0.62, 0.22, 0.75, stone, x, 0.12, 0)
  }
  box(gate, 5.4, 0.32, 0.7, roof, 0, 3.7, 0)
  box(gate, 4.4, 0.29, 0.53, gold, 0, 3.15, 0)
  box(gate, 2.2, 0.68, 0.18, wood, 0, 2.6, 0)
}

export function createEnvironment(scene: THREE.Scene) {
  scene.background = new THREE.Color(0xa8c6ae)
  scene.fog = new THREE.Fog(0xa8c6ae, 24, 64)

  const ground = box(scene, 41, 1.5, 31, grass, 0, -0.78, 0)
  ground.receiveShadow = false
  box(scene, 41.5, 0.4, 31.5, darkGrass, 0, -1.67, 0)
  box(scene, 42, 1.0, 32, stone, 0, -2.35, 0)

  // The paths also show players where the first enemies and shrine are.
  box(scene, 5.2, 0.05, 26, sand, 0, 0.012, 0)
  box(scene, 27, 0.05, 4.4, sand, 0, 0.02, -5.8)
  for (let i = -11; i <= 11; i += 2.2) {
    const pebble = cylinder(scene, 0.35, 0.42, 0.06, stone, -0.9 + Math.sin(i) * 0.65, 0.07, i, 6)
    pebble.rotation.y = i
  }

  // Water and a tiny island make the scene readable even without textures.
  const pond = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), water)
  pond.rotation.x = -Math.PI / 2
  pond.scale.set(1.22, 0.72, 1)
  pond.position.set(-12.5, 0.045, 5.4)
  scene.add(pond)
  for (let i = 0; i < 6; i++) {
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.25 + i * 0.025, 7), paleLeaf)
    lily.rotation.x = -Math.PI / 2
    lily.position.set(-15.8 + (i % 3) * 2.1, 0.07, 3.5 + Math.floor(i / 3) * 2.2)
    scene.add(lily)
  }

  createShrine(scene)
  createGate(scene)

  const random = seededRandom(443)
  const bambooPositions: { x: number; z: number; height: number }[] = []
  for (let i = 0; i < 64; i++) {
    const x = (random() - 0.5) * 38
    const z = (random() - 0.5) * 28
    if ((Math.abs(x) < 4.5 && Math.abs(z) < 12) ||
        (x > 6.3 && x < 15 && z < -3.3) ||
        (x < -6 && x > -17.5 && z > 2) ||
        (Math.abs(z + 5.8) < 3 && Math.abs(x) < 15)) continue
    bambooPositions.push({ x, z, height: 2.8 + random() * 2.5 })
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.075, 0.12, 1, 5)
  const leafGeometry = new THREE.ConeGeometry(0.55, 1.35, 5)
  const trunks = new THREE.InstancedMesh(trunkGeometry, wood, bambooPositions.length)
  const leaves = new THREE.InstancedMesh(leafGeometry, leaf, bambooPositions.length)
  const leavesLow = new THREE.InstancedMesh(leafGeometry, paleLeaf, bambooPositions.length)
  const helper = new THREE.Object3D()
  bambooPositions.forEach(({ x, z, height }, i) => {
    helper.position.set(x, height / 2, z)
    helper.scale.set(1, height, 1)
    helper.updateMatrix()
    trunks.setMatrixAt(i, helper.matrix)
    helper.position.y = height - 0.2
    helper.scale.set(1, 1.35, 1)
    helper.updateMatrix()
    leaves.setMatrixAt(i, helper.matrix)
    helper.position.y = height - 0.8
    helper.scale.set(0.8, 1, 0.8)
    helper.updateMatrix()
    leavesLow.setMatrixAt(i, helper.matrix)
  })
  scene.add(trunks, leaves, leavesLow)

  const rockGeometry = new THREE.DodecahedronGeometry(0.45, 0)
  const rocks = new THREE.InstancedMesh(rockGeometry, stone, 24)
  for (let i = 0; i < 24; i++) {
    const side = i % 2 ? -1 : 1
    helper.position.set(side * (7 + random() * 12), 0.17, (random() - 0.5) * 25)
    const scale = 0.5 + random() * 1.3
    helper.scale.set(scale, scale * 0.55, scale * 0.8)
    helper.rotation.y = random() * 3
    helper.updateMatrix()
    rocks.setMatrixAt(i, helper.matrix)
  }
  scene.add(rocks)

  // Simple lamps anchor the route without costly dynamic lights.
  for (const [x, z] of [[-3, -2], [3, -2], [-3, 5], [3, 5]] as const) {
    cylinder(scene, 0.08, 0.1, 1.8, wood, x, 0.9, z)
    box(scene, 0.48, 0.54, 0.48, gold, x, 1.83, z)
    box(scene, 0.65, 0.12, 0.65, roof, x, 2.15, z)
  }
}
