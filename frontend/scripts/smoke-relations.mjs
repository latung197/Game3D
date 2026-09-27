const base = process.env.GAME3D_TEST_BASE
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+\/api$/.test(base))
  throw new Error('Set GAME3D_TEST_BASE to a local API with an isolated test database.')
const stamp = Date.now()
const call = async (path, method = 'GET', body, cookie = '') => {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : null,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie }
}
const account = await call('/accounts/register', 'POST',
  { email: `leave${stamp}@example.test`, displayName: `Leave${stamp}`, password: 'TestPassword123' })
const guild = await call('/guilds', 'POST', { name: `LeaveGuild${stamp}` }, account.cookie)
const leave = await call('/guilds/leave', 'POST', {}, account.cookie)
const mine = await call('/guilds/mine', 'GET', undefined, account.cookie)
if (account.status !== 200 || guild.status !== 200 || leave.status !== 204 || mine.data !== null)
  throw new Error(JSON.stringify({ account, guild, leave, mine }))
console.log(JSON.stringify({ register: account.status, guild: guild.status, leave: leave.status, mine: mine.data }))
