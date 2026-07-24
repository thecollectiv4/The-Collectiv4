// @ts-check
// Shots auxiliares del gate v17 — modo CLARO (móvil) + desktop dark.
// No es un gate: no afirma nada, sólo captura. Se corre una vez y se borra
// con la rama si estorba. Usa la cuenta B del walkthrough (account-v17-b.json).
import { test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SHOTS = process.env.SHOTS_DIR || '/tmp/c4-walkthrough-v17'
const PLAN = JSON.parse(fs.readFileSync(path.join(SHOTS, 'plan-v17.json'), 'utf8'))
const B = JSON.parse(fs.readFileSync(path.join(SHOTS, 'account-v17-b.json'), 'utf8'))
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })

test('shots · modo claro móvil', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/auth'); await page.waitForTimeout(2200); await shot(page, 'L01-auth-signin-light')
  await page.goto('/auth?mode=create'); await page.waitForTimeout(1800); await shot(page, 'L02-auth-create-light')
  await page.goto('/'); await page.waitForTimeout(2600); await shot(page, 'L03-events-rail-light')
  await page.goto(`/p/${PLAN.id}`); await page.waitForTimeout(2200); await shot(page, 'L04-plan-landing-light')
  await page.goto('/community'); await page.waitForTimeout(2600); await shot(page, 'L05-community-everyone-light')
  await ctx.close()
})

test('shots · desktop dark', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('/'); await page.waitForTimeout(2600); await shot(page, 'D01-events-rail-desktop')
  // la nav simétrica con CREATE al centro es un cambio de desktop — con sesión
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(B.email)
  await page.getByPlaceholder('Password').fill(B.password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
  await page.waitForURL('**/', { timeout: 25000 })
  await page.waitForTimeout(2000)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(2200); await shot(page, 'D02-nav-create-centro-desktop')
  await page.goto('/community'); await page.waitForTimeout(2600); await shot(page, 'D03-community-desktop')
  await page.goto('/messages'); await page.waitForTimeout(2600); await shot(page, 'D04-messages-una-lista-desktop')
  await ctx.close()
})
