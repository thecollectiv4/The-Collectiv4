/* Guardrail 4 — static tripwire (El Mundo v10).
   Run: node scripts/guardrail4.test.mjs — exits non-zero on any failure.

   The law (founder's order): is_demo travels with the IDENTITY, not with
   the surface. If a payload transports a profile, it transports is_demo.
   The CI guards this — not anyone's memory.

   Three laws checked over src/:
   L1 · PAYLOAD LAW — every profiles select that carries identity columns
        (full_name / username / avatar_url) must also carry is_demo, or
        select('*'), or constitutionally exclude seed in the same chain
        (.eq('is_demo', false) — a payload that can never hold seed carries
        the flag implicitly false).
   L2 · SURFACE LAW — every registered profile-rendering surface imports
        the ONE shared pill (SeedMark). New surfaces that select identity
        must register here or import the pill (L3 catches copies).
   L3 · SINGLE SOURCE — the pill markup exists only in SeedMark.jsx:
        no duplicated 'seed-card-badge' or '◇ seed' literals anywhere else.
*/
import fs from 'fs'
import path from 'path'

let failures = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok — ${name}`)
  else { failures++; console.error(`  FAIL — ${name}${detail ? `\n         ${detail}` : ''}`) }
}

const SRC = new URL('../src', import.meta.url).pathname
const files = []
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p)
  }
}
walk(SRC)

// ---------------- L1 · payload law ----------------
const IDENTITY = /full_name|username|avatar_url/
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  const rel = path.relative(SRC, f)
  // every profiles select in the file, with up to 400 chars of its chain
  const re = /\.from\(\s*['"]profiles['"]\s*\)([\s\S]{0,400}?)\.select\(([\s\S]{0,200}?)\)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const chainAround = text.slice(m.index, Math.min(text.length, m.index + 700))
    const selectArg = m[2]
    if (!IDENTITY.test(selectArg)) continue           // no identity transported
    const carries = /is_demo/.test(selectArg) || /['"`]\s*\*\s*['"`]/.test(selectArg)
    const seedFree = /\.eq\(\s*['"]is_demo['"]\s*,\s*false\s*\)/.test(chainAround)
    check(
      `L1 payload carries is_demo — ${rel} (select @${m.index})`,
      carries || seedFree,
      `select(${selectArg.trim().slice(0, 90)}) transports identity without is_demo and without .eq('is_demo', false)`
    )
  }
}

// ---------------- L2 · surface law ----------------
const REGISTRY = [
  'pages/Community.jsx',
  'components/ForYou.jsx',
  'components/PeopleSearch.jsx',
  'pages/Messages.jsx',
  'components/ProfileMuseum.jsx',
]
for (const rel of REGISTRY) {
  const p = path.join(SRC, rel)
  const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
  check(`L2 surface imports the shared pill — ${rel}`,
    /from\s+['"]@\/components\/SeedMark['"]/.test(text),
    'a registered profile-rendering surface must import SeedMark (or be consciously removed from the registry with a reason)')
}

// ---------------- L3 · single source ----------------
for (const f of files) {
  const rel = path.relative(SRC, f)
  if (rel === 'components/SeedMark.jsx') continue
  const text = fs.readFileSync(f, 'utf8')
  check(`L3 no duplicated pill markup — ${rel}`,
    !text.includes('seed-card-badge') && !text.includes('◇ seed'),
    'the ◇ pill lives ONLY in components/SeedMark.jsx — render <SeedPill is_demo={…}/> instead')
}

console.log(failures ? `\n${failures} guardrail-4 violation(s)` : '\nguardrail 4 holds — is_demo travels with the identity')
process.exit(failures ? 1 : 0)
