// @ts-check
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/* =========================================================================
   v19 · THE TASTES GATE — proof of the fix for the dead curate button.
   Before v19: if the quiet-layer fetch (profile_tastes) failed, `tastes`
   stayed null (loading and error were the same null), the builder portal
   never mounted, and the curate button did NOTHING until a full reload.
   Now the failure is NAMED and the gate shows an honest error + working
   Retry. This test FORCES the failure (aborts the profile_tastes request)
   and asserts the retry surface — then that Retry actually recovers.

   REQUIRES: SUPABASE_SERVICE_KEY (create/delete the QA user), PREVIEW_URL.
   ========================================================================= */

const SUPA_URL = process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const EMAIL = `c4-qa-tastes-${RUN}@example.com`
const PASS = `QaTastes!${RUN}`
const admin = SERVICE_KEY ? createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null

test.describe('v19 · tastes fetch error → honest retry, never a dead button', () => {
  test.skip(!SERVICE_KEY, 'needs SUPABASE_SERVICE_KEY — skipping instead of faking a pass.')
  test.use({ colorScheme: 'dark' })
  let uid = null

  test.beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASS, email_confirm: true, user_metadata: { full_name: 'QA Tastes' },
    })
    expect(error, 'QA user creation must succeed').toBeFalsy()
    uid = data.user.id
  })

  test('a failed tastes fetch shows a retry, not a dead builder', async ({ page }) => {
    // FORCE the failure: abort the quiet layer's fetch every time it's asked.
    await page.route('**/rest/v1/profile_tastes*', (r) => r.abort())

    // sign in
    await page.goto('/auth')
    await page.getByPlaceholder('Email').fill(EMAIL)
    await page.getByPlaceholder('Password').fill(PASS)
    await page.getByRole('button', { name: 'Sign In' }).last().click()
    await page.waitForURL('**/', { timeout: 25000 })

    // the empty world auto-opens the builder; a stray onboarding coachmark is
    // cleared first so it can't mask the gate
    await page.goto('/profile')
    await page.waitForTimeout(1500)
    await page.keyboard.press('Escape').catch(() => {})

    // if the auto-open didn't fire, open it via the owner's build door
    const gate = page.getByRole('dialog', { name: "Couldn't load your world" })
    if (!(await gate.isVisible().catch(() => false))) {
      const build = page.getByRole('button', { name: /Build your world|Curate your world/i }).first()
      if (await build.isVisible().catch(() => false)) await build.click({ force: true })
    }

    // THE PROOF: an honest error with a working Retry — never the pre-v19 silence
    await expect(gate, 'a failed tastes fetch must show the honest error gate').toBeVisible({ timeout: 25000 })
    await expect(page.getByRole('button', { name: /Retry/i }), 'the failed gate must offer a working Retry').toBeVisible()

    // …and Retry RECOVERS: stop aborting, click Retry → the real builder mounts
    await page.unroute('**/rest/v1/profile_tastes*')
    await page.getByRole('button', { name: /Retry/i }).click()
    await expect(page.getByText('WHAT DO YOU MAKE?').first(), 'Retry must load tastes and open the real builder').toBeVisible({ timeout: 20000 })
  })

  test.afterAll(async () => {
    if (admin && uid) {
      await admin.from('profiles').delete().eq('id', uid)
      await admin.auth.admin.deleteUser(uid).catch(() => {})
    }
  })
})
