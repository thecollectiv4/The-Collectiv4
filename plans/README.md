# Animation plans — audit of 2026-07-16 (commit 2e47930)

Full 8-category motion audit of the platform (skill: improve-animations). Direction source of truth: CLAUDE.md (Cosmos, locked), src/lib/cosmos.js tokens, src/index.css conventions — editorial, museum register; the house curve `cubic-bezier(.2,.7,.2,1)`; "an editorial settle, never a toy bounce"; the Atmosphere anti-corny law. **No bounce, no confetti, no springs.**

Each plan is self-contained: an executor needs zero context beyond the plan file. Execute with `improve-animations execute plans/NNN-*.md` or hand to any agent.

## Plans

| # | Plan | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| 001 | [Motion tokens](001-motion-tokens.md) | HIGH | Cohesion | DONE |
| 002 | [Overlay entrance grammar](002-overlay-entrance-grammar.md) | HIGH | Physicality + Opportunity | DONE |
| 003 | [Route transitions](003-route-transitions.md) | HIGH | Frequency + Easing + A11y | DONE |
| 004 | [OS replay choreography](004-os-replay-choreography.md) | HIGH | Frequency + Interruptibility | DONE |
| 005 | [Celebration moments](005-celebration-moments.md) | HIGH | Opportunity | DONE |
| 006 | [WorldBuilder beats](006-worldbuilder-beats.md) | HIGH | Opportunity | DONE |
| 007 | [Museum framer hygiene](007-museum-framer-hygiene.md) | MEDIUM | Perf + A11y | DONE |
| 008 | [Hover & paint hygiene](008-hover-perf-hygiene.md) | MEDIUM | Perf + A11y + Interrupt | DONE |
| 009 | [Consumer pulse](009-consumer-pulse.md) | MEDIUM | Opportunity + Cohesion | DONE |
| 010 | [Press feedback](010-press-feedback.md) | LOW | Physicality | DONE |

## Execution order & dependencies

**001 goes first** — every other plan consumes its tokens (`--ease-house`, `--dur-*`, `EASE_HOUSE_ARR`).

Then, by leverage:

1. **002 → 003 → 004** — the daily-feel fixes (overlays, routes, OS). Independent of each other after 001.
2. **005 → 006** — the "surprise" ceremonies. 006 reuses 005's `.rise` grammar (run 005 first, or copy its CEREMONY block).
3. **007, 008** — hygiene sweeps, independent. Note: 008 skips the Btn transform if 010 hasn't run; they touch adjacent lines in index.css:172 — run 008 before 010 to avoid conflicts, or rebase 010's excerpt.
4. **009** — depends on 004 (`.msg-in`, retimed `.os-slide-in-*`).
5. **010** — last; tiny.

One branch per plan (or 001+003 together, 005+006 together) → Vercel preview → Pato taste-QA → merge, per the house flow. **Plans do not touch `verified`, prices, or any data path.**

## Audited and left alone (don't re-flag)

- **Atmosphere.jsx** — the galaxy layer is exemplary: DPR≤2, rAF paused when hidden, 30fps touch, reduced-motion fully static. The motion identity is right.
- `.temp-warm` / `.temp-electric` (Ley 14 temperature registers), the `.world-ticker` marquee, `.os-reveal`'s .95s first-mount cinematic, the `.8s` salon lean-in — deliberate, documented, kept.
- The NO-`forwards` containing-block law (index.css:92-97) — respected by every plan.
- No `ease-in` and no `scale(0)` anywhere in src/ — clean.
- 54 `spin` spinner uses — comprehension feedback, correctly exempt from reduced-motion.
- DoorScanner verdict flip — deliberately NOT animated beyond ~150ms budget (door staff trigger it dozens of times a night).

## Known LOWs not planned (noise-level; fold into adjacent work if touched)

- `fadeIn` over `backdrop-filter` overlays (CreateCentral.jsx:90, Messages.jsx:694) — blur re-resolves during a 250ms fade; brief.
- os/Drops.jsx:75-79 — hover-translate on a backdrop-filtered pill; move blur to a wrapper if ever touched.
- `.os-card` drag ghost opacity snap (index.css:165-167) — add `opacity .15s` to its transition list.
- `.disc-card` 500ms hover response (index.css:226) — over the hover budget on paper; the slow lean-in may be intentional editorial pace. **Taste call for Pato**: try `.25s` on a preview.


---

## Aditivas — lote feat/motion-aditivas (011–041)

Las 31 oportunidades aditivas del audit de Fase 3 (2026-07-18, main 4cca6e8),
escritas y **ejecutadas** en la rama `feat/motion-aditivas` para preview en vivo.
Sólo AGREGAN movimiento donde faltaba; las 107 correctivas NO se tocaron en esta pasada.

| # | ID | Sev | Plan | Archivo |
| --- | --- | --- | --- | --- |
| 011 | A-01 | HIGH | [foryou-empty](011-foryou-empty.md) | `components/ForYou.jsx` |
| 012 | A-02 | HIGH | [museum-published](012-museum-published.md) | `components/ProfileMuseum.jsx` |
| 013 | A-03 | HIGH | [experience-press](013-experience-press.md) | `pages/ExperienceDetail.jsx` |
| 014 | A-04 | HIGH | [c4-chapters](014-c4-chapters.md) | `pages/HouseWorld.jsx` |
| 015 | A-05 | HIGH | [plan-card-in](015-plan-card-in.md) | `pages/Messages.jsx` |
| 016 | A-06 | MEDIUM | [auth-name-collapse](016-auth-name-collapse.md) | `components/AuthModal.jsx` |
| 017 | A-07 | MEDIUM | [foryou-feed](017-foryou-feed.md) | `components/ForYou.jsx` |
| 018 | A-08 | MEDIUM | [bell-badge](018-bell-badge.md) | `components/Layout.jsx` |
| 019 | A-09 | MEDIUM | [bond-in](019-bond-in.md) | `components/PeopleSearch.jsx` |
| 020 | A-10 | MEDIUM | [offer-sold-fade](020-offer-sold-fade.md) | `components/WorldOffer.jsx` |
| 021 | A-11 | MEDIUM | [content-settle](021-content-settle.md) | `components/os/ContentEngine.jsx` |
| 022 | A-12 | MEDIUM | [events-view-slide](022-events-view-slide.md) | `components/os/Events.jsx` |
| 023 | A-13 | MEDIUM | [moderation-refilter](023-moderation-refilter.md) | `components/os/Moderation.jsx` |
| 024 | A-14 | MEDIUM | [events-empty](024-events-empty.md) | `pages/Events.jsx` |
| 025 | A-15 | MEDIUM | [c4-hero](025-c4-hero.md) | `pages/HouseWorld.jsx` |
| 026 | A-16 | MEDIUM | [mark-read](026-mark-read.md) | `pages/Messages.jsx` |
| 027 | A-17 | MEDIUM | [close-star](027-close-star.md) | `pages/Messages.jsx` |
| 028 | A-18 | MEDIUM | [os-notice](028-os-notice.md) | `pages/OS.jsx` |
| 029 | A-19 | MEDIUM | [pasteditions-back](029-pasteditions-back.md) | `pages/PastEditions.jsx` |
| 030 | A-20 | LOW | [craftpicker-chip](030-craftpicker-chip.md) | `components/CraftPicker.jsx` |
| 031 | A-21 | LOW | [craftpicker-press](031-craftpicker-press.md) | `components/CraftPicker.jsx` |
| 032 | A-22 | LOW | [related-worlds](032-related-worlds.md) | `components/RelatedWorlds.jsx` |
| 033 | A-23 | LOW | [taste-chip](033-taste-chip.md) | `components/TasteBrainstorm.jsx` |
| 034 | A-24 | LOW | [cohorts-reveal](034-cohorts-reveal.md) | `components/os/Cohorts.jsx` |
| 035 | A-25 | LOW | [brief-expand](035-brief-expand.md) | `components/os/ContentEngine.jsx` |
| 036 | A-26 | LOW | [events-publish-settle](036-events-publish-settle.md) | `components/os/Events.jsx` |
| 037 | A-27 | LOW | [network-verify](037-network-verify.md) | `components/os/Network.jsx` |
| 038 | A-28 | LOW | [roadmap-draw](038-roadmap-draw.md) | `components/os/RoadmapStrip.jsx` |
| 039 | A-29 | LOW | [community-toggle](039-community-toggle.md) | `pages/Community.jsx` |
| 040 | A-30 | LOW | [eventlanding-vis](040-eventlanding-vis.md) | `pages/EventLanding.jsx` |
| 041 | A-31 | LOW | [featured-room](041-featured-room.md) | `pages/Events.jsx` |
