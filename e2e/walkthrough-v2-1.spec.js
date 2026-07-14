// v2.1 RECARGADA — the sale-blocker gate: legal pages + checkout/footer links.
// Anon, deterministic surfaces only (no member session, no Stripe call). The
// /os surfaces (DROPS, cover upload) and the paid-tier consent gate need a
// verified/owner session or a live on-sale tier, so they're QA'd by Pato —
// same as the v4 verified-host path. Runs against localhost (vite) or a
// PREVIEW_URL. Serial: one visitor's story.
import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const LEGAL = [
  { path: '/terms',   h1: 'TERMS OF SERVICE', needle: /license to attend/i },
  { path: '/privacy', h1: 'PRIVACY POLICY',   needle: /Stripe/ },
  { path: '/refunds', h1: 'REFUND POLICY',    needle: /all ticket sales are final/i },
]

for (const p of LEGAL) {
  test(`legal · ${p.path} renders, is honest, and never crashes`, async ({ page }) => {
    await page.goto(p.path)
    await expect(page.getByRole('heading', { name: p.h1 })).toBeVisible()
    await expect(page.getByText(p.needle).first()).toBeVisible()
    // the company + updated stamp (real facts, not a template)
    await expect(page.getByText(/THE COLLECTIV4 LLC/).first()).toBeVisible()
    // the crash boundary from main.jsx must NOT be showing
    await expect(page.getByText('SOMETHING BROKE')).toHaveCount(0)
    // the three cross-links are present (footer nav on every legal page)
    for (const label of ['Terms', 'Privacy', 'Refunds']) {
      await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible()
    }
  })
}

test('legal · cross-links navigate between the three pages', async ({ page }) => {
  await page.goto('/terms')
  await page.getByRole('link', { name: 'Refunds', exact: true }).first().click()
  await expect(page).toHaveURL(/\/refunds$/)
  await expect(page.getByRole('heading', { name: 'REFUND POLICY' })).toBeVisible()

  await page.getByRole('link', { name: 'Privacy', exact: true }).first().click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole('heading', { name: 'PRIVACY POLICY' })).toBeVisible()

  // "The Collectiv4" back-link returns to the app root
  await page.getByRole('link', { name: /The Collectiv4/i }).first().click()
  await expect(page).toHaveURL(/\/$/)
})

test('event room footer carries the legal links, and they resolve', async ({ page }) => {
  // rba-edition-2 is the published room the v4 gate uses; EventShow renders its footer.
  await page.goto('/e/rba-edition-2')
  const room = page.getByText("THIS ROOM ISN'T OPEN")
  if (await room.count()) test.skip(true, 'rba-edition-2 not published in this environment')

  const terms = page.getByRole('link', { name: 'Terms', exact: true })
  await terms.first().scrollIntoViewIfNeeded()
  await expect(terms.first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Privacy', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Refunds', exact: true }).first()).toBeVisible()

  await terms.first().click()
  await expect(page).toHaveURL(/\/terms$/)
  await expect(page.getByRole('heading', { name: 'TERMS OF SERVICE' })).toBeVisible()
})

test('routing regression — dissolved routes still redirect clean (no 404)', async ({ page }) => {
  await page.goto('/discover')
  await expect(page).toHaveURL(/\/community$/)
  await page.goto('/chat')
  await expect(page).toHaveURL(/\/messages$/)
})
