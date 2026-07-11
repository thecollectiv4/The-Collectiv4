import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/* Story B — runs AFTER the runner flips `verified` on the test account
   (the same server mechanism admin_set_verified drives). The member enters
   the OS and — the P0 of this round — GETS BACK OUT. The founder-only
   NETWORK tab must NOT exist for them, and the RPC must refuse them. */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough'
const STATE_FILE = path.join(SHOTS, 'state.json')
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

// desktop: the trap Pato hit lives here (no bottom nav on /os desktop) —
// the walkthrough must prove the DESKTOP way out
test.use({ viewport: { width: 1280, height: 800 } })

test('B · a verified member enters the OS and gets back out', async ({ page }) => {
  const { email, password } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))

  // sign in
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign In' }).first().click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL('**/', { timeout: 20000 })

  // the OS tab appears for a verified member (server verdict)
  const osTab = page.getByRole('link', { name: 'OS' }).or(page.getByText('OS', { exact: true }))
  await expect(osTab.first()).toBeVisible({ timeout: 20000 })
  await shot(page, '13-os-tab-visible-for-verified')

  // enter the OS
  await page.goto('/os')
  await expect(page.getByText('TEAM OS').first()).toBeVisible({ timeout: 25000 })
  // founder-only tab must NOT exist for a plain verified member
  // (role-scoped: the header kicker "our network · internal" is prose, not a tab)
  await expect(page.getByRole('button', { name: /Network/ })).toHaveCount(0)
  await shot(page, '14-inside-os-no-network-tab')

  // the RPC refuses a non-owner AT THE SERVER (not just hidden UI)
  const verdict = await page.evaluate(async () => {
    const k = Object.keys(localStorage).find(x => x.startsWith('sb-') && x.endsWith('-auth-token'))
    const tok = k ? JSON.parse(localStorage.getItem(k))?.access_token : null
    const r = await fetch('https://tpjbyxbsgtiwqcxcpwyn.supabase.co/rest/v1/rpc/admin_list_users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K', Authorization: `Bearer ${tok}` },
      body: '{}',
    })
    return r.json()
  })
  expect(verdict?.ok).toBe(false)
  expect(verdict?.error).toBe('not_owner')

  // ---- P0: GET BACK OUT — the explicit door ----
  await page.getByRole('button', { name: 'Back to the app' }).first().click()
  await page.waitForURL('**/', { timeout: 15000 })
  await expect(page.getByText('GET YOUR TICKET').or(page.getByText("You're in"))).toBeVisible({ timeout: 20000 })
  await shot(page, '15-back-in-the-app')

  // and the second door: the brand mark itself
  await page.goto('/os')
  await page.getByRole('button', { name: 'Back to The Collectiv4 app' }).first().click()
  await page.waitForURL('**/', { timeout: 15000 })
  await shot(page, '16-brand-mark-also-exits')
})
