# CLAUDE.md — The Collectiv4 Platform

The platform behind The Collectiv4 (Houston creative movement, co-founded by Pato Durán Chacón + Diego Villaseñor). This is the **one codebase** — EXTEND it, never rebuild, never spin up a second deployment.

Stack: **Vite + React + Supabase (Postgres/RLS/Auth) + Stripe Checkout + Resend**, deployed on Vercel. Serverless functions live in `api/` (`create-checkout-session.js`, `webhook.js`). App code in `src/` (`pages/`, `components/`, `lib/`, `api/supabase.js`). DB migrations in `supabase/migrations/` (currently through `0007`).

Flow for feature work: **branch → Vercel preview → founder QA → merge to `main`.** One piece at a time, each with an acceptance criterion. Prod shows only the polished; unfinished layers hide behind feature flags. Prices are stored in **cents**. Recon table/field names before writing SQL — never assume schema.

---

## 1. Design system — Cosmos (locked)

Every UI surface is the same universe as the room and the pitch deck. Cosmos is the locked visual direction — **there is no warm palette, ever.** (The old cream/rust palette is superseded.)

- **Palette:** void `#0A0A0D` / `#07080E` · bone `#F2EEE6` (the only warmth, text only) · cold-grey labels/muted · hairlines `rgba(242,238,230,0.12)`.
- **Liquid chrome** (brushed-metal gradient clipped to text): **display type only, one accent per view, with restraint.** Never on body, never more than one chrome moment per screen.
- **Type:** Bebas Neue (display) · DM Mono (labels/data/kickers, wide tracking) · DM Sans (body).
- **Motifs:** subtle film grain over surfaces · star-chart geometric marks (`●  ○  ✕  △  ◇`) as section markers/separators · catalog numbering (01, 02, 03) · generous negative space, high contrast, editorial.
- **Forbidden:** neon, purple/periwinkle, warm/floral tones, color gradients, soft SaaS shadows, heavily rounded corners (max 8–10px, prefer 0–4px), per-profile accent colors.
- Live reference implementations already in this system: the profile museum, `/discover`, `/claim`.

**Full spec lives in the vault** (Pato's Obsidian vault, `~/Documents/TheCollectiv4/`):
`04 — Brand & Identity/Artifact Design System.md` + `04 — Brand & Identity/Brand Foundation.md` (Cosmos System section). Read those before any significant visual work.

---

## 2. Infrastructure — run it yourself

- **Supabase CLI is linked** to this repo (`supabase/config.toml`, project ref `tpjbyxbsgtiwqcxcpwyn`). Run migrations yourself (`supabase db push`, or `psql` for reads) — **never hand raw SQL to the founder to paste into the dashboard.** Manual SQL is dead here.
- **Vercel CLI** — not linked yet as of this writing. The moment it is, the same rule applies: drive deploys/env yourself, don't hand the founder manual dashboard steps.
- **Automate on the second occurrence.** A manual step done twice gets scripted or CLI-driven the second time — don't let recurring friction on the critical path persist.

---

## 3. Standing gates

- **Recon before touching.** Read the files/tables/policies you're about to change. No assumed field names.
- **Adversarial self-review before every push.** Try to refute your own change — this caught the RLS hole and the silent profile-insert failure pre-launch. Default to skeptical.
- **Prod merges are gated on explicit founder approval.** Preview + QA first; `main` merges only when a founder says so — and **either founder authorizes independently**: Pato or Diego, same weight, no second signature needed. The gate is the *approval*, not whose it is. It is still per-merge: one green light covers that merge and nothing after it, and "a founder approved something similar last week" is not approval. (This docs-only file was explicitly authorized for a direct-to-`main` commit — that authorization does not generalize.)
- **Pause and surface when the plan diverges from reality.** If recon shows the world isn't what the send-off assumed (e.g. code already hand-merged, data looks seeded/fake), stop and report before building on top of it.
- **Never touch `verified`, `lock_verified`, or prices** without explicit instruction. The DB trigger blocks self-granted `verified` by design — respect it.

---

## 4. Integrity by code, not memory

Public paths never show fake data. Seed/demo data is fine for building, but honesty is **enforced in code**, not remembered: demo profiles carry an `is_demo` flag and every public view filters `is_demo = false` server-side. An owner/preview mode (env- or owner-gated, never a public URL param) reveals them for the team. At launch: zero bots, enforced by code. Any new public surface inherits this pattern.

Retention-gated: no monetization layers (storefront, Connect, bookings) until Houston-first retention is proven. Discipline before scale.

---

## 5. Current state — read the vault, don't assume

Live platform state (what's shipped, in-flight, and next) lives in Pato's vault:
`~/Documents/TheCollectiv4/02 — Startup & Product/Platform — Build Roadmap (El Mapa de Código).md`

Send-offs carry the context a task needs — but they can lag reality. When a send-off's assumptions don't match what you find, **recon wins, and you surface the gap.**

---

## 6. Two founders, one repo

Both founders drive this repo from the same company account. Claude Code greets whoever is at the keyboard as "Pato," and Recents mixes both sessions — the account cannot tell the founders apart, so the protocol has to.

1. **Push from the first commit. Always.** A local branch is invisible to the other founder and to every Claude surface — total loss if the machine dies, and it collides blind. Push is backup and visibility, not publishing. Live only changes with merge + deploy.
2. **The remote is the board.** Not pushed = doesn't exist for the other founder.
3. **Declare the driver at session start.** The shared company account says "Pato" regardless of who is operating. Default Pato unless stated.
4. **Check the base at session start.** What is `main` right now?
5. **Merge order is readiness, not seniority.** Whoever is PR'd and gated goes first; the other rebases on top. Never merge two branches touching the same file without one rebasing.
6. **The repo is the truth about the repo — never a briefing's memory of it.** Verify file/line claims against the code before acting on them.

_17 jul 2026 — two branches over the same files in parallel, invisible to each other; one lived a full day with no backup._
