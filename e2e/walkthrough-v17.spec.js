// @ts-check
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/* =========================================================================
   THE WALKTHROUGH v17 — LA PUERTA ABIERTA. El gate de la rama
   v17-puerta-abierta: el camino que v17 abre, caminado como los humanos
   que el audit del 16 jul dijo que rebotaban. Dos cuentas QA efímeras
   (retirarlas después: node e2e/cleanup-test-users.mjs
   <SHOTS>/account-v17-a.json y account-v17-b.json).

   A · EL QUE ARMA EL PLAN — cuenta nueva entra por /auth?mode=create
       (la puerta de unirse ABRE en Create Account), crea un plan PÚBLICO
       desde CREATE (+) → ?new=plan, y ATERRIZA EN EL ROOM del plan, donde
       vive la tarjeta con el link de la puerta.

   B · EL EXTRAÑO CON EL LINK — el caso Beto: contexto limpio, sin cuenta,
       abre /p/:id (la landing pública), pica I'M IN, cae en /auth CON LA
       INTENCIÓN CORRECTA (mode=create → formulario Create Account), se
       registra, vuelve al plan, se une y cae al room. La campana del
       creador es cosa del server (0057) — aquí se verifica la puerta.

   C · EL NO-MAKER ENTRA — la misma cuenta B abre el builder: la 01 ya no
       es pared (skip visible + "I'm here for the people"). ACTUALIZADO v19:
       v18 reemplazó el flujo v17 (craft → brainstorm → ciudad) por LA
       ENTRADA EXPRÉS de TRES BEATS (craft → face+city → line → publish);
       el taste brainstorm se mudó a la curación (banda taste-invite del
       museo). Este test camina los tres beats por la puerta del no-maker.
       [NB v19: reescrito contra el código de WorldBuilder; falta una corrida
        verde en un preview para confiarlo del todo — ver handback.]

   D · LA CIUDAD EN EVENTS — el rail HAPPENING NEAR YOU enseña el plan
       público a una sesión ANÓNIMA (0057 abierta a anon con criterio),
       y su fila abre la landing /p/:id.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v17'
fs.mkdirSync(SHOTS, { recursive: true })

test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'dark' })

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

const grab = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try {
    const v = k ? JSON.parse(localStorage.getItem(k)) : null
    return v ? { uid: v?.user?.id || null } : { uid: null }
  } catch { return { uid: null } }
})

// la bienvenida de primera corrida se cierra si aparece — no es lo que
// este gate mide, y taparía los clicks de abajo
const dismissOnboarding = async (page) => {
  await page.waitForTimeout(1200)
  const dlg = page.getByRole('dialog').first()
  if (await dlg.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(600)
  }
}

let A = null
let B = null
let PLAN = null   // { id, threadId, url }

test('v17 · A — mode=create abre en crear, y el plan público nace con room y link', async ({ page }) => {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `c4-qa-v17-a-${ts}@example.com`
  const password = `QaV17!${ts}`

  // /auth SIN mode: la puerta abre en SIGN IN (el default global de v17)
  await page.goto('/auth')
  await expect(page.getByRole('button', { name: 'Sign In' }).last(), 'AUTH_NO_ABRE_EN_SIGN_IN — el default global murió').toBeVisible({ timeout: 15000 })
  // la fila del nombre colapsa por grid 0fr + opacity (Playwright la sigue
  // contando "visible" porque el input clipeado conserva su caja) — la
  // aserción honesta es el PRIMARIO: en signin no existe 'Create Account'
  await expect(page.getByRole('button', { name: 'Create Account' }), 'CREATE_FIRST_SIGUE_VIVO — /auth sin mode abre en crear').toHaveCount(0)
  await expect(page.locator('.row-collapse'), 'LA_FILA_DEL_NOMBRE_NO_COLAPSA en signin').toHaveAttribute('aria-hidden', 'true')
  await shot(page, '01-auth-default-signin')

  // /auth?mode=create: la puerta de unirse abre en CREATE ACCOUNT
  await page.goto('/auth?mode=create')
  await expect(page.getByPlaceholder('First name'), 'MODE_CREATE_NO_ABRE_EL_FORM_DE_CREAR').toBeVisible({ timeout: 15000 })
  await shot(page, '02-auth-mode-create')

  await page.getByPlaceholder('First name').fill('Beto')
  await page.getByPlaceholder('Last name').fill(`QAv17${ts}`)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 25000 })

  const { uid } = await grab(page)
  expect(uid, 'NO_SESSION_AFTER_SIGNUP').toBeTruthy()
  fs.writeFileSync(path.join(SHOTS, 'account-v17-a.json'), JSON.stringify({ uid, email, password, name: `Beto QAv17${ts}` }))
  A = { uid, email, password }

  // el perfil nace perezoso — forzar la fila
  await page.goto('/profile')
  await page.waitForTimeout(2500)
  await page.keyboard.press('Escape').catch(() => {})
  await page.goto('/')
  await dismissOnboarding(page)

  // CREATE (+) → MAKE A PLAN → ?new=plan abre el composer en Messages
  await page.locator('[data-c4-tour="create"]').first().click()
  await page.getByRole('button', { name: /MAKE A PLAN/ }).click()
  await page.waitForURL('**/messages**', { timeout: 15000 })
  await expect(page.getByPlaceholder('fucho on saturday'), 'EL_HANDSHAKE_NEW_PLAN_NO_ABRE_EL_COMPOSER').toBeVisible({ timeout: 15000 })

  await page.getByPlaceholder('fucho on saturday').fill('fucho del gate v17')
  await page.getByPlaceholder('the park on Eleanor, mi casa, tbd').fill('Moody Park')
  // WHEN cercano-futuro (review catch): los sin-fecha ordenan AL FINAL del
  // rail — con fecha, la presencia del plan en las primeras 8 filas del
  // test D es determinista, no suerte del tamaño del rail
  const soon = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  await page.locator('#plan-when').fill(`${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`)
  await page.getByPlaceholder('bring a ball. loser buys tacos.').fill('bring a ball. loser buys tacos.')
  await page.getByTestId('plan-vis-public').click()
  await shot(page, '03-plan-composer-publico')
  await page.getByRole('button', { name: 'MAKE IT REAL' }).click()

  // v17: crear el plan ATERRIZA EN SU ROOM
  await page.waitForURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20000 })
  const threadId = page.url().split('/messages/')[1].split('?')[0]

  // la tarjeta del plan vive en el room, con el link de la puerta
  const card = page.locator('[data-testid^="plan-card-"]').first()
  await expect(card, 'EL_ROOM_NO_CARGA_SU_PLANCARD').toBeVisible({ timeout: 20000 })
  const planId = (await card.getAttribute('data-testid')).replace('plan-card-', '')
  await expect(page.getByTestId('plan-copy-link'), 'EL_PLAN_PUBLICO_NO_OFRECE_SU_LINK').toBeVisible({ timeout: 10000 })
  await shot(page, '04-room-con-plancard')

  PLAN = { id: planId, threadId }
  fs.writeFileSync(path.join(SHOTS, 'plan-v17.json'), JSON.stringify(PLAN))
})

test('v17 · B — el link del plan abre sin cuenta, y unirse aterriza en el room', async ({ browser }) => {
  test.skip(!PLAN, 'sin plan del test A')

  // contexto LIMPIO: el vato del WhatsApp no tiene cuenta ni storage
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `c4-qa-v17-b-${ts}@example.com`
  const password = `QaV17!${ts}`

  await page.goto(`/p/${PLAN.id}`)
  await expect(page.getByText('fucho del gate v17').first(), 'LA_LANDING_NO_ABRE_PARA_ANON — 0057/anon o isPublicPath rotos').toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Moody Park').first(), 'LA_LANDING_NO_DICE_DONDE').toBeVisible()
  await shot(page, '05-landing-anon')

  // I'M IN → /auth con la intención correcta: CREATE ACCOUNT activo
  await page.getByTestId('plan-join').click()
  await page.waitForURL('**/auth**', { timeout: 15000 })
  expect(page.url(), 'EL_JOIN_ANON_NO_LLEVA_MODE_CREATE').toContain('mode=create')
  await expect(page.getByPlaceholder('First name'), 'LA_PUERTA_DE_UNIRSE_NO_ABRE_EN_CREAR').toBeVisible({ timeout: 15000 })
  await shot(page, '06-auth-desde-el-plan')

  await page.getByPlaceholder('First name').fill('Karen')
  await page.getByPlaceholder('Last name').fill(`QAv17${ts}`)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()

  // ?next devuelve al plan — la intención del comprador nunca se pierde
  await page.waitForURL(`**/p/${PLAN.id}`, { timeout: 25000 })
  const { uid } = await grab(page)
  expect(uid, 'NO_SESSION_AFTER_SIGNUP_B').toBeTruthy()
  fs.writeFileSync(path.join(SHOTS, 'account-v17-b.json'), JSON.stringify({ uid, email, password, name: `Karen QAv17${ts}` }))
  B = { uid, email, password }

  await page.goto('/profile')
  await page.waitForTimeout(2500)
  await page.keyboard.press('Escape').catch(() => {})
  await page.goto(`/p/${PLAN.id}`)
  await dismissOnboarding(page)

  // I'm in, ya con sesión → join_plan → EL ROOM
  await page.getByTestId('plan-join').click()
  await page.waitForURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20000 })
  expect(page.url(), 'EL_JOIN_NO_CAE_AL_ROOM_DEL_PLAN').toContain(PLAN.threadId)
  await expect(page.locator('[data-testid^="plan-card-"]').first(), 'EL_ROOM_DEL_JOINER_NO_CARGA_LA_TARJETA').toBeVisible({ timeout: 20000 })
  await shot(page, '07-join-aterriza-en-el-room')

  await ctx.close()
})

test('v17 · C — la pared cae: el no-maker entra por LA ENTRADA EXPRÉS (v18, 3 beats)', async ({ browser }) => {
  test.skip(!B, 'sin cuenta B')

  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(B.email)
  await page.getByPlaceholder('Password').fill(B.password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL('**/', { timeout: 25000 })
  await dismissOnboarding(page)

  // el mundo vacío de B abre LA ENTRADA EXPRÉS (isNew → stage 'express'). En un
  // contexto nuevo el builder auto-abre sobre un mundo recién nacido; si no,
  // la puerta BUILD/START lo abre.
  await page.goto('/profile')
  await page.waitForTimeout(3000)
  await page.keyboard.press('Escape').catch(() => {})
  const craftTitle = page.getByText('WHAT DO YOU MAKE?').first()
  if (!(await craftTitle.isVisible().catch(() => false))) {
    const buildDoor = page.getByRole('button', { name: /BUILD|START|Build your world/i }).first()
    if (await buildDoor.isVisible().catch(() => false)) await buildDoor.click()
  }

  // BEAT 01 · craft — la 01 ya no es pared: "I'm here for the people" y skip
  // son puertas de primera clase (la doctrina v17, viva dentro de la exprés)
  await expect(craftTitle, 'LA_01_EXPRES_NO_APARECE').toBeVisible({ timeout: 20000 })
  await expect(page.getByTestId('express-people-door'), 'NO_HAY_PUERTA_PARA_EL_NO_MAKER').toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/skip this one/).first(), 'LA_01_SIGUE_SIN_SKIP — required no murió').toBeVisible({ timeout: 10000 })
  await shot(page, '08-express-beat01-craft')

  // la puerta del no-maker avanza AL BEAT 02 (face + city) — NO al brainstorm.
  // El taste vive ahora en la curación (banda taste-invite del museo), fuera
  // de la puerta: esa cobertura le toca a un test de curación, no a la entrada.
  await page.getByTestId('express-people-door').click()
  await expect(page.getByText('YOUR FACE, YOUR CITY').first(), 'EL_BEAT_02_NO_APARECE').toBeVisible({ timeout: 15000 })
  await page.getByPlaceholder(/Houston · Valencia/).fill('Houston')
  await shot(page, '09-express-beat02-face-city')
  await page.getByTestId('express-next').click()

  // BEAT 03 · line — una frase, luego PUBLICAR
  await expect(page.getByText('YOUR LINE').first(), 'EL_BEAT_03_NO_APARECE').toBeVisible({ timeout: 15000 })
  await page.getByPlaceholder(/One line, your voice/).fill('here for the people')
  await shot(page, '10-express-beat03-line')
  await page.getByTestId('express-next').click()

  // la ceremonia sobria: el mundo exprés está vivo (mismo diálogo que /profile)
  const celebration = page.getByRole('dialog', { name: 'Your world is live' })
  await expect(celebration, 'LA_ENTRADA_EXPRES_NO_PUBLICA').toBeVisible({ timeout: 20000 })
  await expect(celebration.getByText('IS LIVE'), 'NO_HAY_CELEBRACION_DE_PUBLICADO').toBeVisible()
  await shot(page, '11-express-publicado')

  await ctx.close()
})

test('v17 · D — el rail de la ciudad abre para anon y lleva a la landing', async ({ browser }) => {
  test.skip(!PLAN, 'sin plan del test A')

  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto('/')
  await expect(page.getByText('HAPPENING IN THE CITY').first(), 'EL_RAIL_NO_EXISTE_PARA_ANON — 0057/anon roto').toBeVisible({ timeout: 20000 })
  const row = page.getByTestId(`city-plan-${PLAN.id}`)
  await expect(row, 'EL_PLAN_PUBLICO_NO_ESTA_EN_EL_RAIL').toBeVisible({ timeout: 10000 })
  await shot(page, '12-rail-anon')

  await row.click()
  await page.waitForURL(`**/p/${PLAN.id}`, { timeout: 15000 })
  await expect(page.getByText('fucho del gate v17').first(), 'LA_FILA_DEL_RAIL_NO_ABRE_LA_LANDING').toBeVisible({ timeout: 15000 })
  await shot(page, '13-landing-desde-el-rail')

  await ctx.close()

  // TEARDOWN (review catch): el plan del gate se CANCELA — cancel_plan es
  // del creador y public_plans/public_plan filtran status='live', así que
  // el rail de anon queda limpio al instante. Sin esto, cada corrida
  // plantaba un plan público eterno esperando el cleanup manual.
  const SUPA = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
  const ANON = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'
  const acct = JSON.parse(fs.readFileSync(path.join(SHOTS, 'account-v17-a.json'), 'utf8'))
  const tok = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acct.email, password: acct.password }),
  }).then((r) => r.json())
  const done = await fetch(`${SUPA}/rest/v1/rpc/cancel_plan`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_plan: PLAN.id }),
  }).then((r) => r.json()).catch(() => null)
  expect(done?.ok, 'EL_TEARDOWN_NO_CANCELO_EL_PLAN — retirarlo a mano').toBeTruthy()
})
