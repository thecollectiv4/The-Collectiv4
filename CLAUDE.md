# CLAUDE.md — The Collectiv4 Platform

The platform behind The Collectiv4 (Houston creative movement, co-founded by Pato Durán Chacón + Diego Villaseñor). This is the **one codebase** — EXTEND it, never rebuild, never spin up a second deployment.

Stack: **Vite + React + Supabase (Postgres/RLS/Auth) + Stripe Checkout + Resend**, deployed on Vercel. Serverless functions live in `api/` (`create-checkout-session.js`, `webhook.js`). App code in `src/` (`pages/`, `components/`, `lib/`, `api/supabase.js`). DB migrations in `supabase/migrations/` (currently through `0058`). **Never assume the next number from this file — list the directory and check the remote ledger before naming a migration.** A numbering collision already cost us `0046_la_puerta`, which exists on disk but never reached the remote; the invite gate it carried is therefore not live.

Flow for feature work: **branch → Vercel preview → founder QA → merge to `main`.** One piece at a time, each with an acceptance criterion. Prod shows only the polished; unfinished layers hide behind feature flags. Prices are stored in **cents**. Recon table/field names before writing SQL — never assume schema.

---

## 1. Design system — Cosmos (locked)

Every UI surface is the same universe as the room and the pitch deck. Cosmos is the locked visual direction — **there is no warm palette, ever.** (The old cream/rust palette is superseded.)

- **Palette:** void `#0A0A0D` / `#07080E` · bone `#F2EEE6` (the only warmth, text only) · cold-grey labels/muted · hairlines `rgba(242,238,230,0.12)`.
- **Liquid chrome** (brushed-metal gradient clipped to text): **display type only, one accent per view, with restraint.** Never on body, never more than one chrome moment per screen.
- **Type:** Bebas Neue (display) · DM Mono (labels/data/kickers, wide tracking) · DM Sans (body).
- **Motifs:** subtle film grain over surfaces · star-chart geometric marks (`●  ○  ✕  △  ◇`) as section markers/separators · catalog numbering (01, 02, 03) · generous negative space, high contrast, editorial.
- **Forbidden:** neon, purple/periwinkle, warm/floral tones, color gradients, soft SaaS shadows, heavily rounded corners (max 8–10px, prefer 0–4px), per-profile accent colors.
- **Cosmos is the brief.** Any design skill (frontend-design, taste-skill, or future ones) defers to Cosmos. Where they conflict, Cosmos wins.
- Live reference implementations already in this system: the profile museum, `/discover`, `/claim`.

**Full spec lives in the vault** (Pato's Obsidian vault, `/Users/pato/TheCollectiv4/`):
`04 — Brand & Identity/Artifact Design System.md` + `04 — Brand & Identity/Brand Foundation.md` (Cosmos System section). Read those before any significant visual work.

---

## 2. Infrastructure — run it yourself

- **Supabase CLI is linked** to this repo (`supabase/config.toml`, project ref `tpjbyxbsgtiwqcxcpwyn`). Run migrations yourself (`supabase db push`, or `psql` for reads) — **never hand raw SQL to the founder to paste into the dashboard.** Manual SQL is dead here.
- **Vercel CLI is linked** (as of 21 jul 2026). Same rule as Supabase: drive env vars and preview inspection yourself — don't hand the founder manual dashboard steps.
- **Production deploys are automated and deterministic — never run `vercel --prod` by hand.** Every push to `main` triggers `.github/workflows/deploy-production.yml`, which is the SOLE producer of production deploys (it builds, deploys, and turns the job RED if the build fails, the deploy never reaches Ready, or the live site doesn't answer 200). `vercel.json` sets `git.deploymentEnabled.main = false` so Vercel's own git integration never auto-deploys `main` and never races the Action over the production alias. A manual `vercel --prod` recreates exactly that race — it is a break-glass fallback for when the Action itself is unavailable, never a routine step. Vercel still builds PREVIEWS for feature branches (branch → preview → QA), untouched. The last step of any merge is: merge to `main`, then WATCH the Action go green — that, not the merge, is how a production deploy is confirmed.
- **Supabase Edge Functions** are the home for any new serverless endpoint. `api/` is frozen by tree hash (§7), and in this Vite layout Vercel only serves functions from `api/` — so a new Vercel function is not deployable without breaking the freeze. Edge Functions deploy without Docker (`--use-api`).
- **Automate on the second occurrence.** A manual step done twice gets scripted or CLI-driven the second time — don't let recurring friction on the critical path persist.
- **Neither founder writes code.** Both direct the work in plain language. Never hand a founder a git command, a file path to inspect, or a doc section to read as a task — those are Claude Code's job. Founder-facing steps are only physical dashboard actions.

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

**Sequenced, not gated** (21 jul 2026 — supersedes the earlier "no monetization until retention is proven" rule). The platform opens outward in layers. Booking payments are live: they are infrastructure for creatives to charge *their own* clients — money that originates outside the platform, not monetization of the community. What stays gated is anything that charges C4's own users, or that fakes liquidity: no storefront and no Connect payouts built against seeded data. Integrity by code (above) is the real gate, not a retention milestone.

---

## 5. Current state — read the vault, don't assume

Live platform state (what's shipped, in-flight, and next) lives in Pato's vault:
`/Users/pato/TheCollectiv4/02 — Startup & Product/Platform — Build Roadmap (El Mapa de Código).md`

Orientation only (not a ledger — the roadmap above is the source of truth and moves faster than this file): as of **v17 (23 jul 2026)** the shipped baseline includes full-screen `/auth` with intent-driven modes (`?mode=create` opens Create Account, `?next=` returns the user to where they were), the bell + **The Bell** notification panel, the **glass** control system, a single unified **Messages** list, and **public plans** with a shareable `/p/:id` landing that opens for anonymous visitors. Migrations run through `0058`.

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

---

## 7. Anti-regression — the five rules

Almost nothing here has broken because a problem was hard. It broke because a change was bigger than its task, or because "done" was never actually checked. These five apply to every task in this repo, no exceptions.

1. **No silent assumptions.** Never assume a field name, a prop, a route, a policy, or "how it probably works" — open the file and confirm it. When a briefing, a send-off, or your own recollection disagrees with the code, **the code wins** (§5, §6.6). When the task itself is ambiguous, **stop and ask** — one question is cheaper than a wrong guess shipped. Say what you verified and where (`src/pages/Profile.jsx:120`), not "verified."

2. **Minimum change that solves it.** A 50-line fix does not become a 500-line refactor. No rewriting what already works, no cleanup of code you happened to pass through, no abstraction invented for a second case that doesn't exist yet. If the right answer genuinely is a rewrite, **say so and get approval first** — never smuggle one inside a fix.

3. **No orthogonal changes.** Touch only what the task names. If the task is the profile, the nav is off-limits — even if it looks wrong; log it instead and move on. Shared files (`src/lib/cosmos.js`, `src/index.css`, shared components) are the blast radius: editing one to fix one surface silently edits every surface, and that is where regressions actually come from. Before you call anything finished, run `git diff --stat` and defend **every** file on that list against the task. A file you can't justify gets reverted, not explained.

4. **"Done" means verified, not written.** Never report success from re-reading your own diff. Verified = the build is green **and** the change was exercised on a real surface. Floor for any change: `npm run build` plus `node scripts/guardrail4.test.mjs`, then the change actually seen working — dev server (`npm run dev`) or the walkthrough against a preview (`PREVIEW_URL=<url> npx playwright test e2e/walkthrough-v17.spec.js` — the current gate; earlier `walkthrough-v*` specs are historical and drift as the UI moves). Report the commands you ran and what they printed. "Should work" is not a report, and a task verified only in part is reported as **partly verified** — never rounded up.

5. **The hard rules don't bend for convenience.** Restated because these are the ones a helpful agent talks itself past:
   - **`api/` is the payment machine** (checkout, webhook, ticket email). Unless the task *is* the payment flow, its tree hash is identical before and after: `git rev-parse HEAD:api` → `1bfb81a1f0f59434ea76ed9ee9cba62d3ab0919e` on current `main`. One command covers the whole folder — that is proof, where "I didn't touch those files" is only a claim.
   - **Guardrail 4 green before any merge** — `node scripts/guardrail4.test.mjs`. `is_demo` travels with the identity (§4), enforced by that test and never by memory.
   - **Never touch `verified`, `lock_verified`, or prices** without explicit instruction (§3). Prices stay in cents.
   - **No merge to `main` without founder approval and a green gate** (§3, §6.5).

_20 jul 2026 — written after the recurring shape of our failures: a fix lands, something adjacent breaks, and it surfaces sessions later. Each rule above is one of those failures, made checkable._
