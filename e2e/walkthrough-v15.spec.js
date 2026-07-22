// @ts-check
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/* =========================================================================
   THE WALKTHROUGH v15 — ENTRY & POSTING, LOGUEADO. El gate de la rama
   feat/entry-and-posting, corrido contra un preview real con una cuenta QA
   efímera (retirarla después: node e2e/cleanup-test-users.mjs
   <SHOTS>/account-v15.json — UN objeto JSON por archivo, es lo que el
   script parsea).

   A · EL RECORRIDO ESTÁ APAGADO — una cuenta nueva ve la bienvenida,
       la termina con "Begin", y NO recibe el tour de siete pasos
       (TUTORIAL_ENABLED=false, firstRun.js). En v14, "Begin" montaba
       <Tutorial/> inmediatamente — esa es exactamente la aserción.
       Y Settings ya no ofrece "Replay the walkthrough" (ley de Settings:
       un control que relanza un recorrido apagado es un control muerto).

   B · POSTEO REDONDO — la misma cuenta publica un momento (solo la línea),
       lo ve colgado en su museo, REESCRIBE la línea (edit v15), y la
       escalera muestra "Days active" con un número real del servidor
       (my_days_active, 0052) — nunca el sello "Not readable".
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v15'
fs.mkdirSync(SHOTS, { recursive: true })
const ACCT_FILE = path.join(SHOTS, 'account-v15.json')

test.describe.configure({ mode: 'serial' })

// el registro de la casa es el vacío (misma nota que v14)
test.use({ colorScheme: 'dark' })

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

const grab = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('sb-') && x.endsWith('-auth-token'))
  try {
    const v = k ? JSON.parse(localStorage.getItem(k)) : null
    return v ? { uid: v?.user?.id || null } : { uid: null }
  } catch { return { uid: null } }
})

let A = null

test('v15 · A — Begin ya no abre ningún tour, y Settings no lo ofrece', async ({ page }) => {
  const ts = Date.now() + Math.floor(Math.random() * 1000)
  const email = `c4-qa-v15-a-${ts}@example.com`
  const password = `QaV15!${ts}`

  await page.goto('/auth')
  await page.getByPlaceholder('First name').fill('Lina')
  await page.getByPlaceholder('Last name').fill(`QAv15${ts}`)
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 25000 })

  const { uid } = await grab(page)
  expect(uid, 'NO_SESSION_AFTER_SIGNUP — email confirmation may be ON').toBeTruthy()
  fs.writeFileSync(ACCT_FILE, JSON.stringify({ uid, email, password, name: `Lina QAv15${ts}` }))
  A = { uid, email, password }

  // el perfil nace perezoso — forzarlo para que la fila exista con sus banderas
  await page.goto('/profile')
  await page.waitForTimeout(2500)
  await page.goto('/')

  // la bienvenida abre para una cuenta recién nacida…
  const welcome = page.getByRole('dialog').first()
  await expect(welcome, 'ONBOARDING_NOT_SHOWN a una cuenta nueva').toBeVisible({ timeout: 15000 })
  await shot(page, '01-onboarding')

  // …se recorre entera hasta "Begin" — la ruta que en v14 encadenaba el tour
  for (let i = 0; i < 6; i++) {
    const begin = page.getByRole('button', { name: 'Begin' })
    if (await begin.isVisible().catch(() => false)) break
    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForTimeout(400)
  }
  await page.getByRole('button', { name: 'Begin' }).click()

  // TUTORIAL_ENABLED=false: después de Begin no puede montar NINGÚN diálogo.
  await page.waitForTimeout(5000)
  await expect(page.getByRole('dialog'), 'EL_TOUR_APARECIO — TUTORIAL_ENABLED no está apagando el recorrido').toHaveCount(0)
  await shot(page, '02-no-tour-after-begin')

  // y la fila de Settings desapareció con el mismo flag
  await page.goto('/settings')
  await page.waitForTimeout(2500)
  await expect(page.getByText('Replay the walkthrough'), 'SETTINGS_OFRECE_UN_TOUR_APAGADO').toHaveCount(0)
  await expect(page.getByText('Edit your world').first(), 'SETTINGS_NO_RENDERIZO — la sección entera falta, no sólo la fila').toBeVisible({ timeout: 10000 })
  await shot(page, '03-settings-sin-replay')
})

test('v15 · B — postear, reescribir la línea, y un Days active de verdad', async ({ page }) => {
  test.skip(!A, 'sin cuenta A')

  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(A.email)
  await page.getByPlaceholder('Password').fill(A.password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL('**/', { timeout: 25000 })
  await page.waitForTimeout(2000)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(600)

  // el + → POST TO YOUR WORLD → sólo la línea → POST IT
  await page.locator('[data-c4-tour="create"]').first().click()
  await page.getByRole('button', { name: /POST TO YOUR WORLD/ }).click()
  const LINE_1 = 'primera línea, colgada por el gate v15'
  await page.getByPlaceholder('What is this moment? Your voice, one breath.').fill(LINE_1)
  await shot(page, '04-composer')
  await page.getByRole('button', { name: 'POST IT' }).click()
  await page.waitForTimeout(3000)

  // el momento cuelga en el museo del autor
  await page.goto('/profile')
  await page.waitForTimeout(3000)
  await page.keyboard.press('Escape').catch(() => {})
  await expect(page.getByText(LINE_1), 'EL_POST_NO_CUELGA en MOMENTS').toBeVisible({ timeout: 15000 })
  await shot(page, '05-momento-colgado')

  // la línea se reescribe (edit v15) y el museo muestra la verdad del server
  const LINE_2 = 'la línea, reescrita — edit v15'
  await page.getByLabel("Edit this moment's line").click()
  await page.getByLabel('The line under this moment').fill(LINE_2)
  await page.getByRole('button', { name: 'save' }).click()
  await expect(page.getByText(LINE_2), 'LA_EDICION_NO_SE_VE').toBeVisible({ timeout: 15000 })
  await expect(page.getByText(LINE_1), 'LA_LINEA_VIEJA_SIGUE_AHI').toHaveCount(0)
  await shot(page, '06-linea-editada')

  // la escalera: Days active con número real, nunca el sello
  await page.getByText('SEE THE LADDER').scrollIntoViewIfNeeded()
  await page.getByText('SEE THE LADDER').click()
  await page.waitForTimeout(2500)
  const daysRow = page.getByTestId('status-days-active')
  await daysRow.scrollIntoViewIfNeeded().catch(() => {})
  await expect(daysRow, 'DAYS_ACTIVE_NO_LEIBLE — ¿0052 no está en este entorno?').toBeVisible({ timeout: 10000 })
  await expect(daysRow, 'DAYS_ACTIVE_SIN_NUMERO').toContainText(/[1-9]\d* days?/)
  await expect(page.getByTestId('status-pending-daysActive'), 'EL_SELLO_Y_EL_NUMERO_A_LA_VEZ').toHaveCount(0)
  await shot(page, '07-days-active-real')
})
