import { HubConnectionBuilder } from '@microsoft/signalr'

const base = process.env.GAME3D_TEST_BASE
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+\/api$/.test(base))
  throw new Error('Set GAME3D_TEST_BASE to a local API with an isolated test database.')
const stamp = Date.now()
const post = async (path, body, cookie = '') => {
  const response = await fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', Cookie: cookie },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return { data: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie }
}
const a = await post('/accounts/register', { email: `rta${stamp}@example.test`, displayName: `RTA${stamp}`, password: 'TestPassword123' })
const b = await post('/accounts/register', { email: `rtb${stamp}@example.test`, displayName: `RTB${stamp}`, password: 'TestPassword123' })
await post('/characters', { name: `MageA${stamp}`, element: 'fire' }, a.cookie)
await post('/characters', { name: `MageB${stamp}`, element: 'ice' }, b.cookie)
const inventory = await fetch(`${base}/inventory`, { headers: { Cookie: a.cookie } }).then(response => response.json())
const robe = inventory.find(item => item.itemId === 'traveler_robe')
const sword = inventory.find(item => item.itemId === 'bamboo_sword')
await post('/inventory/equip', { entryId: robe.id }, a.cookie)
await post('/inventory/equip', { entryId: sword.id }, a.cookie)
const first = new HubConnectionBuilder().withUrl(`${base}/realtime`, { headers: { Cookie: a.cookie } }).build()
const second = new HubConnectionBuilder().withUrl(`${base}/realtime`, { headers: { Cookie: b.cookie } }).build()
let replacement = null
await first.start()
await second.start()
try {
  let equippedHealth = 0
  first.on('PlayerMoved', state => { if (state.accountId === a.data.id) equippedHealth = state.maxHealth })
  await first.invoke('EnterArena', true)
  await second.invoke('EnterArena', true)
  const chat = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chat timeout')), 5000)
    second.on('ChatMessage', message => { clearTimeout(timeout); resolve(message) })
  })
  await first.invoke('SendChat', 'world', '', 'hello realtime')
  const message = await chat
  const hitPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('PK timeout')), 5000)
    second.on('PlayerHit', hit => { clearTimeout(timeout); resolve(hit) })
  })
  await first.invoke('Attack', b.data.id, false)
  const hit = await hitPromise
  if (equippedHealth !== 93 || hit.damage !== 21) throw new Error(`Equipment not applied: ${equippedHealth}/${hit.damage}`)
  await second.stop()
  replacement = new HubConnectionBuilder().withUrl(`${base}/realtime`, { headers: { Cookie: b.cookie } }).build()
  await replacement.start()
  const resumed = await replacement.invoke('EnterArena', true)
  if (resumed.health !== 74) throw new Error(`Reconnect reset PK health: ${resumed.health}`)
  const counterHits = []
  first.on('PlayerHit', value => counterHits.push(value))
  await first.invoke('Guard')
  await replacement.invoke('Attack', a.data.id, false)
  await new Promise(resolve => setTimeout(resolve, 100))
  const reflected = counterHits.find(value => value.attackerId === a.data.id && value.targetId === b.data.id && value.damage === 14)
  if (!reflected) throw new Error('Fire guard did not reflect damage')
  const controls = []
  const firePositions = []
  first.on('ControlStatus', (rootSeconds, slowSeconds, hasteSeconds) => controls.push({ rootSeconds, slowSeconds, hasteSeconds }))
  replacement.on('PlayerMoved', state => { if (state.accountId === a.data.id) firePositions.push(state.x) })
  await replacement.invoke('Attack', a.data.id, true)
  await new Promise(resolve => setTimeout(resolve, 150))
  await first.invoke('Move', 1, 6.5)
  await new Promise(resolve => setTimeout(resolve, 100))
  if (!controls.some(control => control.rootSeconds >= 2.5) || firePositions.some(x => x > .9))
    throw new Error('Ice skill did not freeze movement')
  await new Promise(resolve => setTimeout(resolve, 3000))
  await first.invoke('Move', 1, 6.5)
  await new Promise(resolve => setTimeout(resolve, 100))
  if (!firePositions.some(x => x > .9)) throw new Error('Movement stayed frozen after ice skill expired')
  console.log(JSON.stringify({ chat: message.text, channel: message.channel, damage: hit.damage,
    equippedHealth, resumedHealth: resumed.health, fireReflect: reflected.damage, iceFreeze: true }))
} finally {
  await first.stop()
  await second.stop()
  if (replacement) await replacement.stop()
}
