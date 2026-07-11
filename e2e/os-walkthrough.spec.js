import { test, expect } from '@playwright/test'
import path from 'path'

/* Story B — the OS way OUT (the P0 of this round), walked on the DEV
   harness (/__os-harness mounts the real OSInstrument at desktop width —
   the exact surface where the trap lived: no bottom nav on desktop /os).

   Why the harness and not a verified preview session: `verified` can only
   be granted by a founder (is_owner JWT — by design, lock_verified), and
   this runner holds no founder credentials. The harness exercises the
   same Rail/exit code paths; the server-side gates are asserted with real
   anon calls against the live API below. The founder-session pass remains
   Pato's 30-second QA.

   Runs against the LOCAL dev server (PREVIEW_URL unset). */

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough'
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

test.use({ viewport: { width: 1280, height: 800 } })

test('B · the OS always has a way out (desktop, where the trap lived)', async ({ page }) => {
  // mount the real OS instrument
  await page.goto('/__os-harness')
  await expect(page.getByText('TEAM OS').first()).toBeVisible({ timeout: 20000 })

  // founder-only tab is absent when the server verdict isn't owner
  await expect(page.getByRole('button', { name: /Network/ })).toHaveCount(0)
  await shot(page, '13-os-desktop-no-network-tab')

  // ---- P0 exit 1: the explicit door ----
  await page.getByRole('button', { name: 'Back to the app' }).first().click()
  await page.waitForURL(/\/$/, { timeout: 15000 })
  await expect(page.getByText('GET YOUR TICKET')).toBeVisible({ timeout: 20000 })
  await shot(page, '14-back-in-the-app-explicit-door')

  // ---- P0 exit 2: the brand mark itself ----
  await page.goto('/__os-harness')
  await expect(page.getByText('TEAM OS').first()).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Back to The Collectiv4 app' }).first().click()
  await page.waitForURL(/\/$/, { timeout: 15000 })
  await shot(page, '15-brand-mark-also-exits')

  // ---- the server gates hold with NO session at all (live API, anon) ----
  const gates = await page.evaluate(async () => {
    const H = { 'Content-Type': 'application/json', apikey: 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K' }
    const base = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co/rest/v1/rpc'
    const [listUsers, setVerified, osIdent] = await Promise.all([
      fetch(`${base}/admin_list_users`, { method: 'POST', headers: H, body: '{}' }).then(r => r.json()),
      fetch(`${base}/admin_set_verified`, { method: 'POST', headers: H, body: JSON.stringify({ p_user: '00000000-0000-0000-0000-000000000000', p_verified: true }) }).then(r => r.json()),
      fetch(`${base}/my_os_identity`, { method: 'POST', headers: H, body: '{}' }).then(r => r.json()),
    ])
    return { listUsers, setVerified, osIdent }
  })
  expect(gates.listUsers?.error).toBe('not_owner')
  expect(gates.setVerified?.error).toBe('not_owner')
  expect(gates.osIdent?.member).toBe(false)
})
