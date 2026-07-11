import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* =========================================================================
   THE WALKTHROUGH — the QA gate for feat/el-mundo, run against the Vercel
   preview AS A USER. Story A: a new member signs up, builds their world
   step by step (real image uploads included), and the world is publicly
   visible to an anonymous visitor; checkout starts from the landing.
   Story B (separate spec, after the runner flips `verified` on the test
   account): the member enters /os and — the P0 — GETS BACK OUT.

   State is shared through STATE_FILE so the runner can do the fixture
   flip and the final cleanup between specs.
   ========================================================================= */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough'
const STATE_FILE = path.join(SHOTS, 'state.json')
fs.mkdirSync(SHOTS, { recursive: true })

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
const state = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))

test.describe.configure({ mode: 'serial' })

test('A · a member signs up, builds their world, and the world is live', async ({ page, browser }) => {
  const ts = Date.now()
  const email = `c4-qa-${ts}@example.com`
  const password = `QaWorld!${ts}`

  // ---- 01 · the public landing breathes ----
  await page.goto('/')
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await shot(page, '01-landing')

  // ---- 02 · sign up ----
  await page.goto('/auth')
  await page.getByPlaceholder('Your name').fill('QA Walkthrough')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await shot(page, '02-signup')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL('**/', { timeout: 20000 })
  // session must exist (email confirmation off) — otherwise stop loudly
  const uid = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
    if (!k) return null
    try { return JSON.parse(localStorage.getItem(k))?.user?.id || null } catch { return null }
  })
  expect(uid, 'NO_SESSION_AFTER_SIGNUP — email confirmation may be ON').toBeTruthy()
  fs.writeFileSync(STATE_FILE, JSON.stringify({ uid, email, password }))

  // ---- 03 · a newborn world greets you with the guided build ----
  await page.goto('/profile')
  const sheet = page.getByRole('dialog', { name: 'Build your world' })
  await expect(sheet).toBeVisible({ timeout: 20000 })
  await expect(sheet.getByText('YOUR CRAFT')).toBeVisible()
  await page.waitForTimeout(900) // let the fixed layer paint (headless first-frame quirk)
  await shot(page, '03-wizard-opens-on-empty-world')

  // step 1 — craft + line (the museum above updates as we type)
  await sheet.getByPlaceholder('DJ · Painter · Photographer…').fill('Photographer · QA')
  await sheet.getByPlaceholder("One line, your voice — what you're on right now.").fill('testing worlds, live')
  await shot(page, '04-step1-craft')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // step 2 — the work: three REAL images to the wall
  await expect(sheet.getByText('THE WORK')).toBeVisible()
  const img = path.join(SHOTS, '01-landing.png') // a real PNG from this very run
  const fileInput = sheet.locator('input[type=file]')
  for (let i = 0; i < 3; i++) {
    await fileInput.setInputFiles(img)
    await expect(sheet.locator('img')).toHaveCount(i + 1, { timeout: 30000 })
  }
  await expect(sheet.getByText('03/03 on the wall')).toBeVisible()
  await shot(page, '05-step2-three-pieces')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // step 3 — the doors
  await expect(sheet.getByText('THE DOORS')).toBeVisible()
  await sheet.getByRole('button', { name: /Add a door/ }).click()
  await sheet.getByPlaceholder('IG').fill('IG')
  await sheet.getByPlaceholder('https://…').fill('https://instagram.com/thecollectiv4')
  await shot(page, '06-step3-doors')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // step 4 — the marquee (house line, already running above)
  await expect(sheet.getByText('THE MARQUEE')).toBeVisible()
  await shot(page, '07-step4-marquee')
  await sheet.getByRole('button', { name: /Next/ }).click()

  // step 5 — the skin → PUBLISH
  await expect(sheet.getByText('THE SKIN')).toBeVisible()
  await sheet.getByRole('button', { name: 'Outline' }).click()
  await shot(page, '08-step5-skin')
  await sheet.getByRole('button', { name: 'PUBLISH YOUR WORLD' }).click()

  // ---- the sober celebration ----
  const celebration = page.getByRole('dialog', { name: 'Your world is live' })
  await expect(celebration).toBeVisible({ timeout: 20000 })
  await expect(celebration.getByText('IS LIVE')).toBeVisible()
  await page.waitForTimeout(900) // fadeIn settles before the shot
  await shot(page, '09-published')
  await page.getByRole('button', { name: 'SEE IT AS THE WORLD SEES IT' }).click()
  await page.waitForURL(`**/user/${uid}`, { timeout: 15000 })
  await expect(page.getByText('WLCME 2 MY WRLD').first()).toBeVisible({ timeout: 15000 })
  await shot(page, '10-own-world-public-route')

  // ---- 11 · an ANONYMOUS visitor sees the world (the museum is public) ----
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const anonPage = await anon.newPage()
  await anonPage.goto(`/user/${uid}`)
  // the one-shot sign-in modal may fire on a fresh context — close it if so
  try { await anonPage.getByRole('button', { name: 'Close' }).click({ timeout: 5000 }) } catch { /* no modal — fine */ }
  await expect(anonPage.getByText('WLCME 2 MY WRLD').first()).toBeVisible({ timeout: 20000 })
  await expect(anonPage.getByText('GALLERY')).toBeVisible()
  await expect(anonPage.getByText('IG', { exact: true })).toBeVisible()
  // no edit affordances for a stranger
  await expect(anonPage.getByText('Build your world')).toHaveCount(0)
  await shot(anonPage, '11-anon-sees-the-world')
  await anon.close()

  // ---- 12 · checkout from the landing — exactly as far as the DATA allows ----
  // The live event's tiers may all be coming_soon (an admin decision, not a
  // bug). With a tier on sale we ride to Stripe; without one we prove the
  // surface is honest (inert tiers) AND the checkout function is alive.
  await page.goto('/')
  await page.getByText('GET YOUR TICKET').click()
  await expect(page.getByText(/^(\$\d+|AT DOOR)/).first()).toBeVisible({ timeout: 15000 })
  const hasAvailable = await page.evaluate(async () => {
    const r = await fetch('https://tpjbyxbsgtiwqcxcpwyn.supabase.co/rest/v1/events?select=tiers&status=eq.published&is_test=eq.false', { headers: { apikey: 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K' } })
    const evs = await r.json()
    return (evs[0]?.tiers || []).some(t => t.status === 'available')
  })
  if (hasAvailable) {
    const checkoutReq = page.waitForResponse(r => r.url().includes('/api/create-checkout-session'), { timeout: 30000 })
    await page.getByText(/^\$\d+$/).first().click({ timeout: 10000 })
    const resp = await checkoutReq
    expect(resp.status(), 'create-checkout-session must answer 200').toBe(200)
    const body = await resp.json()
    expect(body.url, 'checkout session must return a Stripe URL').toContain('checkout.stripe.com')
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 })
    await shot(page, '12-stripe-checkout-live')
  } else {
    // no tier on sale → a coming-soon tier click must do NOTHING (honest surface)
    await page.getByText(/^\$\d+$/).first().click()
    await page.waitForTimeout(1500)
    expect(page.url(), 'coming-soon tiers must be inert').not.toContain('stripe')
    // …and the checkout function itself is alive (400 on empty body, never 500)
    const api = await page.evaluate(async () => {
      const r = await fetch('/api/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      return { status: r.status, body: await r.json().catch(() => null) }
    })
    expect(api.status, 'checkout function must reject cleanly, not crash').toBe(400)
    await shot(page, '12-tiers-coming-soon-checkout-alive')
  }
})
