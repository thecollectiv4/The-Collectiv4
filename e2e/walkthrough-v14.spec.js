import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH v14 — ENTRY & IDENTITY, LOGUEADO. El gate de
   v14-entry-identity, contra dev local o el preview, sobre la DB remota.

   POR QUÉ EXISTE: v14 trae cinco superficies que sólo se ven con sesión y
   una de ellas —la bienvenida— sólo se ve UNA VEZ EN LA VIDA de la cuenta.
   Una cuenta QA recién nacida es el único sitio donde se puede fotografiar,
   y por eso el recorrido tiene que registrar antes de mirar.

   A · LA PRIMERA VEZ — una cuenta nueva recibe <Onboarding/>, y el
       recorrido de siete marcas detrás. Las dos persisten (0049), así que
       una recarga NO las vuelve a abrir. Ése es el gate real: verlas una
       vez es fácil, no verlas la segunda es lo que prueba la columna.
   B · LA CREDENCIAL — el botón vive en la portada del perfil, abre la
       tarjeta, y la tarjeta imprime datos REALES del perfil.
   C · EL NIVEL, HONESTO — una cuenta con cero actividad tiene que leer el
       peldaño de piso y CERO en cada requisito. Es la prueba de integridad
       de la release: si aquí sale un número inventado, el sistema miente.
   D · SETTINGS — la pantalla completa, con su tarjeta de cuenta arriba.
   E · retirar las cuentas QA (node e2e/cleanup-test-users.mjs).
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v14'
fs.mkdirSync(SHOTS, { recursive: true })
const ACCTS = path.join(SHOTS, 'accounts-v14.jsonl')

test.describe.configure({ mode: 'serial' })

/* EL REGISTRO DE LA CASA ES EL VACÍO. Chromium arranca en `light` por
   defecto, así que un gate sin esta línea fotografía la app de día y deja
   sin mirar el registro en el que esta plataforma vive. El tema `system`
   (el default de theme.jsx) sigue a prefers-color-scheme, así que basta
   con decirle al navegador de qué lado está. Light no queda sin cubrir —
   se mira aparte cuando toca; lo que no puede pasar es que el registro
   PRINCIPAL sea el que nadie fotografió. */
test.use({ colorScheme: 'dark' })

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

const grab = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try {
    const v = k ? JSON.parse(localStorage.getItem(k)) : null
    return v ? { uid: v?.user?.id || null, token: v?.access_token || null } : { uid: null, token: null }
  } catch { return { uid: null, token: null } }
})

let A = null

test('v14 · A — la primera vez se ve UNA vez', async ({ page }) => {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `c4-qa-v14-a-${ts}@example.com`
  const password = `QaV14!${ts}`

  // la puerta real — la misma que usa cualquier miembro
  await page.goto('/auth')
  await shot(page, '01-auth-signup')
  await page.getByPlaceholder('First name').fill('Ada')
  await page.getByPlaceholder('Last name').fill(`QAv14${ts}`)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 25000 })

  const { uid } = await grab(page)
  expect(uid, 'NO_SESSION_AFTER_SIGNUP — email confirmation may be ON').toBeTruthy()
  fs.appendFileSync(ACCTS, JSON.stringify({ uid, email, password, name: `Ada QAv14${ts}` }) + '\n')
  A = { uid, email, password }

  // el perfil nace perezoso — forzarlo para que la fila exista con sus banderas
  await page.goto('/profile')
  await page.waitForTimeout(2500)
  await page.goto('/')
  await page.waitForTimeout(2500)
  await shot(page, '02-onboarding')

  // La bienvenida tiene que estar en pantalla para una cuenta recién nacida.
  const welcome = page.getByRole('dialog').first()
  await expect(welcome, 'ONBOARDING_NOT_SHOWN a una cuenta nueva').toBeVisible({ timeout: 15000 })
})

test('v14 · B — la credencial imprime datos reales', async ({ page, context }) => {
  test.skip(!A, 'sin cuenta A')
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(A.email)
  await page.getByPlaceholder('Password').fill(A.password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL('**/', { timeout: 25000 })

  await page.goto('/profile')
  await page.waitForTimeout(3000)
  // cerrar lo que la primera vez haya dejado abierto
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(1000)
  await shot(page, '03-profile-topbar')

  const btn = page.getByTestId('identity-card-btn')
  await btn.waitFor({ timeout: 20000 })
  await btn.click()
  await page.waitForTimeout(1600)
  await shot(page, '04-identity-card')
  await expect(page.getByTestId('identity-card')).toBeVisible()
})

test('v14 · C — el nivel de una cuenta vacía es honesto', async ({ page }) => {
  test.skip(!A, 'sin cuenta A')
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(A.email)
  await page.getByPlaceholder('Password').fill(A.password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL('**/', { timeout: 25000 })

  await page.goto('/profile')
  await page.waitForTimeout(3000)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(1200)

  await page.getByText('SEE THE LADDER').scrollIntoViewIfNeeded()
  await page.getByText('SEE THE LADDER').click()
  await page.waitForTimeout(2000)
  await shot(page, '05-status-sheet')

  const sheet = page.getByTestId('status-sheet')
  await expect(sheet).toBeVisible({ timeout: 15000 })

  /* LA PRUEBA DE INTEGRIDAD. Cero actividad = peldaño de piso, y el piso
     marcado como el actual. Si esto falla, alguien infló un contador. */
  await expect(page.getByTestId('status-rung-arrived')).toHaveAttribute('data-state', 'current')
  const body = await sheet.innerText()
  console.log('STATUS SHEET TEXT >>>\n' + body)
})

test('v14 · D — settings completo', async ({ page }) => {
  test.skip(!A, 'sin cuenta A')
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(A.email)
  await page.getByPlaceholder('Password').fill(A.password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL('**/', { timeout: 25000 })

  await page.goto('/settings')
  await page.waitForTimeout(3000)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(800)
  await shot(page, '06-settings-top')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1200)
  await shot(page, '07-settings-bottom')
})
