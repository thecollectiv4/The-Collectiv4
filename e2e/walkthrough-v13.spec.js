import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v13 — EL FLUJO SOCIAL, LOGUEADO. The gate for
   v13-polish, run against local dev or the preview, on the LIVE remote DB.

   POR QUÉ EXISTE: v13 (campanas de follow, Connect Design Max, close
   friends, /connections) se ve completo SÓLO logueado — y no había ni un
   gate que lo recorriera con sesión. Un visitante anónimo no toca nada de
   esto, así que ninguno de los walkthroughs anteriores lo cubría.

   A · LA CAMPANA DE FOLLOW (0048) — A sigue a B → B oye 'follow', con A
       como actor, y el badge lo cuenta. Dejar de seguir NO suena.
   B · CONNECT DESIGN MAX DESDE EL PERFIL — el menú de intenciones abre
       en /user/:id (no sólo en Community), manda el vínculo Y el primer
       mensaje, y aterriza en el hilo. El estado queda 'out' (REQUESTED),
       no 'connected': el handshake se confirma del otro lado.
   C · EL HANDSHAKE SE CIERRA EN /connections — la campana friend_request
       aterriza en el segmento REQUESTS (no en una bandeja genérica), B
       acepta ahí, y A oye friend_accept.
   D · CLOSE FRIENDS ES PRIVADO — B mete a A a su círculo; my_close_friends
       de B lo trae, el de A no, y un select directo a close_friends desde
       la sesión de A devuelve CERO filas de B (la RLS, no la UI).
   E · EL BADGE DICE LA VERDAD — cuenta, marca leído, y baja a cero.
   F · retirar las cuentas QA.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v13'
fs.mkdirSync(SHOTS, { recursive: true })
const ACCTS = path.join(SHOTS, 'accounts-v13.jsonl')

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const ANON_KEY = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'

test.describe.configure({ mode: 'serial' })

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

async function rpc(request, fn, args, token) {
  const res = await request.fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token || ANON_KEY}`, 'Content-Type': 'application/json' },
    data: args || {},
  })
  try { return await res.json() } catch { return null }
}

async function rest(request, pathname, token) {
  const res = await request.fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token || ANON_KEY}` },
  })
  try { return await res.json() } catch { return null }
}

const grab = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try {
    const v = k ? JSON.parse(localStorage.getItem(k)) : null
    return v ? { uid: v?.user?.id || null, token: v?.access_token || null } : { uid: null, token: null }
  } catch { return { uid: null, token: null } }
})

/* una cuenta QA nueva por la puerta real de Auth. Se registra para el retiro. */
async function signup(page, tag) {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const first = tag === 'a' ? 'Ada' : 'Beto'
  const last = `QAv13${ts}`
  const email = `c4-qa-v13-${tag}-${ts}@example.com`
  const password = `QaV13!${ts}`
  await page.goto('/auth')
  await page.getByPlaceholder('First name').fill(first)
  await page.getByPlaceholder('Last name').fill(last)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 25000 })
  const { uid, token } = await grab(page)
  expect(uid, 'NO_SESSION_AFTER_SIGNUP — email confirmation may be ON').toBeTruthy()
  fs.appendFileSync(ACCTS, JSON.stringify({ uid, email, password, name: `${first} ${last}` }) + '\n')
  // el perfil nace perezoso en la primera visita a /profile — forzarlo aquí
  // hace que las aristas sociales (FK a profiles) tengan a dónde apuntar
  await page.goto('/profile')
  await page.waitForTimeout(1200)
  return { uid, token, email, password, name: `${first} ${last}`, page }
}

let A = null
let B = null

test('v13 · A — la campana de follow suena, y sólo al seguir', async ({ browser, request }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  A = await signup(await ctxA.newPage(), 'a')
  B = await signup(await ctxB.newPage(), 'b')

  // A entra al mundo de B y lo sigue
  await A.page.goto(`/user/${B.uid}`)
  await A.page.getByTestId('follow-btn').waitFor({ timeout: 20000 })
  await A.page.getByTestId('follow-btn').click()
  await A.page.waitForTimeout(1500)

  // B oye la campana — server-side, no la pantalla
  const bells = await rpc(request, 'my_signals', { p_limit: 20 }, B.token)
  expect(bells?.ok, 'my_signals debe responder ok para B').toBe(true)
  const follow = (bells.signals || []).find((s) => s.kind === 'follow')
  expect(follow, 'B debe tener una campana kind=follow (0048)').toBeTruthy()
  expect(follow.actor?.id, 'el actor de la campana es A').toBe(A.uid)
  expect(bells.unread, 'la campana llega sin leer').toBeGreaterThan(0)

  // dejar de seguir NO suena (sólo INSERT dispara — 0048)
  const before = (await rpc(request, 'signals_unread_count', {}, B.token))?.count
  await A.page.getByTestId('follow-btn').click()
  await A.page.waitForTimeout(1500)
  const after = (await rpc(request, 'signals_unread_count', {}, B.token))?.count
  expect(after, 'un unfollow no puede sumar campanas').toBe(before)

  // se vuelve a seguir para el resto de la historia
  await A.page.getByTestId('follow-btn').click()
  await A.page.waitForTimeout(1200)
  await shot(A.page, 'A1-follow')
})

test('v13 · B — Connect Design Max abre EN EL PERFIL y manda intención + vínculo', async ({ request }) => {
  await A.page.goto(`/user/${B.uid}`)
  const connect = A.page.getByTestId('friend-btn')
  await connect.waitFor({ timeout: 20000 })
  await connect.click()

  // el menú premium: cuatro intenciones, no un request pelón
  const sheet = A.page.getByTestId('connect-sheet')
  await expect(sheet, 'CONNECT en el perfil debe abrir el menú de intenciones (v13)').toBeVisible({ timeout: 8000 })
  await expect(A.page.getByTestId('connect-intent-collab')).toBeVisible()
  await expect(A.page.getByTestId('connect-intent-booking')).toBeVisible()
  await expect(A.page.getByTestId('connect-intent-invite')).toBeVisible()
  await expect(A.page.getByTestId('connect-intent-connect')).toBeVisible()
  await shot(A.page, 'B1-connect-sheet')

  await A.page.getByTestId('connect-intent-booking').click()
  await A.page.getByTestId('connect-send').click()

  // aterriza en el hilo, con la intención adentro
  await A.page.waitForURL('**/messages/**', { timeout: 20000 })
  await expect(A.page.getByText('I want to book you / propose working together.')).toBeVisible({ timeout: 10000 })
  await shot(A.page, 'B2-thread')

  // el vínculo quedó PEDIDO, no cerrado — el handshake lo cierra el otro lado
  const circleA = await rpc(request, 'my_circle', {}, A.token)
  expect(circleA?.pending_out?.some((p) => p.id === B.uid), 'A debe tener a B en pending_out').toBe(true)
  expect(circleA?.friends?.some((p) => p.id === B.uid), 'todavía NO son connected').toBe(false)

  const circleB = await rpc(request, 'my_circle', {}, B.token)
  expect(circleB?.pending_in?.some((p) => p.id === A.uid), 'B debe tener a A en pending_in').toBe(true)
})

test('v13 · C — la campana de connect aterriza en REQUESTS y ahí se cierra el handshake', async ({ request }) => {
  // B tiene la campana friend_request
  const bells = await rpc(request, 'my_signals', { p_limit: 20 }, B.token)
  const req = (bells.signals || []).find((s) => s.kind === 'friend_request')
  expect(req, 'B debe oír friend_request').toBeTruthy()

  // la campana cumple su promesa: abre /connections en el segmento REQUESTS
  await B.page.goto('/messages')
  const row = B.page.getByTestId('bell-row-friend_request').first()
  await row.waitFor({ timeout: 20000 })
  await row.click()
  await B.page.waitForURL('**/connections**', { timeout: 15000 })
  expect(new URL(B.page.url()).searchParams.get('seg'), 'debe abrir el segmento requests').toBe('requests')
  await expect(B.page.getByTestId(`conn-accept-${A.uid}`)).toBeVisible({ timeout: 10000 })
  await shot(B.page, 'C1-requests')

  // B acepta ahí mismo
  await B.page.getByTestId(`conn-accept-${A.uid}`).click()
  await B.page.waitForTimeout(2000)

  const circleB = await rpc(request, 'my_circle', {}, B.token)
  expect(circleB?.friends?.some((p) => p.id === A.uid), 'ahora sí son connected').toBe(true)
  expect(circleB?.pending_in?.some((p) => p.id === A.uid), 'ya no está pendiente').toBe(false)

  // y A oye friend_accept
  const bellsA = await rpc(request, 'my_signals', { p_limit: 20 }, A.token)
  expect((bellsA.signals || []).some((s) => s.kind === 'friend_accept' && s.actor?.id === B.uid),
    'A debe oír friend_accept con B como actor').toBe(true)
})

test('v13 · D — close friends funciona y es PRIVADO (la RLS, no la UI)', async ({ request }) => {
  await B.page.goto('/connections')
  await B.page.getByTestId('conn-seg-connected').click()
  const star = B.page.getByTestId(`conn-close-${A.uid}`)
  await star.waitFor({ timeout: 15000 })
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await star.click()
  await B.page.waitForTimeout(1800)
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await shot(B.page, 'D1-close-friends')

  // el dueño lo ve
  const closeB = await rpc(request, 'my_close_friends', {}, B.token)
  expect(closeB?.close?.some((p) => p.id === A.uid), 'B ve a A en su círculo íntimo').toBe(true)

  // A NO ve la lista de B — ni por la door…
  const closeA = await rpc(request, 'my_close_friends', {}, A.token)
  expect(closeA?.close?.some((p) => p.id === A.uid || p.id === B.uid),
    'la lista de A es de A: la de B no se le aparece').toBe(false)

  // …ni por un select directo a la tabla (close_friends_owner_read, 0029)
  const rowsAsA = await rest(request, `close_friends?select=owner_id,friend_id&owner_id=eq.${B.uid}`, A.token)
  expect(Array.isArray(rowsAsA) ? rowsAsA.length : 0,
    'un select directo a la lista de B desde la sesión de A debe traer CERO').toBe(0)

  // y anon tampoco
  const rowsAnon = await rest(request, 'close_friends?select=owner_id,friend_id', null)
  expect(Array.isArray(rowsAnon) ? rowsAnon.length : 0, 'anon no lee close_friends').toBe(0)
})

test('v13 · E — el badge cuenta, marca leído, y baja a cero', async ({ request }) => {
  await B.page.goto('/')
  const badge = B.page.getByTestId('bell-badge')
  await expect(badge, 'el badge debe verse con campanas sin leer').toBeVisible({ timeout: 15000 })
  const shown = Number((await badge.textContent()).trim())
  const real = (await rpc(request, 'signals_unread_count', {}, B.token))?.count
  expect(shown, 'el badge muestra el conteo REAL del servidor').toBe(Math.min(real, 9))
  await shot(B.page, 'E1-badge')

  await B.page.goto('/messages')
  await B.page.getByTestId('bell-mark-all').waitFor({ timeout: 15000 })
  await B.page.getByTestId('bell-mark-all').click()
  await B.page.waitForTimeout(2000)

  const after = (await rpc(request, 'signals_unread_count', {}, B.token))?.count
  expect(after, 'marcar todo leído deja el conteo en cero').toBe(0)
  await expect(B.page.getByTestId('bell-badge')).toHaveCount(0, { timeout: 10000 })
  await shot(B.page, 'E2-marked-read')
})

test('v13 · F — las tabs se leen en móvil y en desktop', async () => {
  await B.page.setViewportSize({ width: 390, height: 844 })
  await B.page.goto('/')
  await B.page.waitForTimeout(1200)
  await shot(B.page, 'F1-tabs-mobile')

  await B.page.setViewportSize({ width: 1440, height: 900 })
  await B.page.goto('/')
  await B.page.waitForTimeout(1200)
  await shot(B.page, 'F2-tabs-desktop')

  await B.page.goto('/connections')
  await B.page.waitForTimeout(1200)
  await shot(B.page, 'F3-connections-desktop')
})

test('v13 · retirar las cuentas QA', async () => {
  // el retiro real lo hace e2e/cleanup-test-users.mjs con accounts-v13.jsonl;
  // aquí sólo se deja constancia de dónde quedaron
  expect(fs.existsSync(ACCTS), 'las credenciales QA quedaron registradas para el retiro').toBe(true)
  console.log(`\n  cuentas QA para retirar → ${ACCTS}\n`)
})
