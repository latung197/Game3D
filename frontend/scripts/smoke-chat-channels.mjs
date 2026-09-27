import { HubConnectionBuilder } from '@microsoft/signalr'

const base = process.env.GAME3D_TEST_BASE
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+\/api$/.test(base))
  throw new Error('Set GAME3D_TEST_BASE to a local API with an isolated test database.')
const stamp = Date.now()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const post = async (path, body, cookie = '') => {
  const response = await fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', Cookie: cookie },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`)
  const text = await response.text()
  return { data: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie }
}
const a = await post('/accounts/register', { email: `cha${stamp}@example.test`, displayName: `CHA${stamp}`, password: 'TestPassword123' })
const b = await post('/accounts/register', { email: `chb${stamp}@example.test`, displayName: `CHB${stamp}`, password: 'TestPassword123' })
const first = new HubConnectionBuilder().withUrl(`${base}/realtime`, { headers: { Cookie: a.cookie } }).build()
const second = new HubConnectionBuilder().withUrl(`${base}/realtime`, { headers: { Cookie: b.cookie } }).build()
await first.start()
await second.start()
const received = []
second.on('ChatMessage', message => received.push(message))
const waitFor = async (channel, text) => {
  for (let i = 0; i < 30; i++) {
    if (received.some(message => message.channel === channel && message.text === text)) return
    await delay(100)
  }
  throw new Error(`No ${channel} message: ${text}`)
}
try {
  const party = await post('/social/party', {}, a.cookie)
  await post('/social/party/join', { code: party.data.code }, b.cookie)
  await first.invoke('SendChat', 'party', '', 'party message')
  await waitFor('party', 'party message')
  const guild = await post('/guilds', { name: `ChatGuild${stamp}` }, a.cookie)
  await post('/guilds/join', { guildId: guild.data.id }, b.cookie)
  await delay(750)
  await first.invoke('SendChat', 'guild', '', 'guild message')
  await waitFor('guild', 'guild message')
  await delay(750)
  await first.invoke('SendChat', 'dm', b.data.displayName, 'private message')
  await waitFor('dm', 'private message')
  await post('/social/party/leave', {}, b.cookie)
  await delay(750)
  await first.invoke('SendChat', 'party', '', 'after leave')
  await delay(300)
  if (received.some(message => message.text === 'after leave')) throw new Error('Former member still receives party chat')
  console.log(JSON.stringify({ channels: received.map(message => message.channel), removedAfterLeave: true }))
} finally {
  await first.stop()
  await second.stop()
}
