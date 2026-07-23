/* =========================================================================
   backfill-covers-v17 — baja las covers/avatars 12MP existentes a ~1920px.

   v17 fase 7: el downscale EN SUBIDA (worldStorage.downscaleImage) cubre lo
   que viene; esto cubre lo que YA está servido — las portadas de 3-6MB que
   For You decodifica 4-8s en red real. Corre UNA vez y se reporta.

   LAS LEYES QUE RESPETA (documentadas en worldStorage.js / recon v17):
   · replace-flow, nunca overwrite: objeto nuevo con timestamp → UPDATE de
     la fila → borrar el viejo. cacheControl 3600 + upsert:false hacen del
     overwrite in-place una portada rancia por una hora.
   · alcance por FILAS de profiles, jamás listando el bucket — los covers
     de eventos (event-*) comparten bucket y NO son de este script.
   · sólo URLs del bucket worlds (regex de worldPathFromUrl); data: y
     foráneas se saltan enteras.
   · sips (nativo de macOS) redimensiona: preserva metadata/orientación y
     no agrega ni una dependencia.

   USO (la llave NUNCA se escribe a disco):
     SUPABASE_SERVICE_KEY="$(supabase projects api-keys --project-ref \
       tpjbyxbsgtiwqcxcpwyn -o json | jq -r \
       '.[] | select(.name=="service_role") | .api_key')" \
     node scripts/backfill-covers-v17.mjs [--dry]
   ========================================================================= */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_KEY
const DRY = process.argv.includes('--dry')
const MAX_EDGE = 1920

if (!KEY) { console.error('✗ SUPABASE_SERVICE_KEY no está en el ambiente — ver el header del script.'); process.exit(1) }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const pathFromUrl = (url) => {
  const m = /\/storage\/v1\/object\/public\/worlds\/(.+?)(?:[?#]|$)/.exec(url || '')
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return null }
}
const fmt = (b) => b >= 1048576 ? (b / 1048576).toFixed(2) + 'MB' : Math.round(b / 1024) + 'KB'

const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,username,cover_url,avatar_url&or=(cover_url.not.is.null,avatar_url.not.is.null)`, { headers: H })
if (!res.ok) { console.error('✗ no pude leer profiles:', res.status, await res.text()); process.exit(1) }
const rows = await res.json()
console.log(`— ${rows.length} perfiles con imágenes\n`)

const tmp = mkdtempSync(join(tmpdir(), 'c4-backfill-'))
const report = []
let failures = 0

for (const row of rows) {
  for (const [col, prefix] of [['cover_url', 'cover'], ['avatar_url', 'avatar']]) {
    const url = row[col]
    const objPath = pathFromUrl(url)
    const who = `${row.username || row.id.slice(0, 8)} · ${col}`
    if (!url) continue
    if (!objPath) { report.push(`○ ${who}: URL fuera del bucket (data:/foránea) — intacta`); continue }

    const r = await fetch(url)
    if (!r.ok) { report.push(`✗ ${who}: descarga falló (${r.status})`); failures++; continue }
    const buf = Buffer.from(await r.arrayBuffer())
    const before = buf.length
    const inFile = join(tmp, 'in-' + objPath.replace(/\//g, '_'))
    writeFileSync(inFile, buf)

    const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', inFile]).toString()
    const w = +(/pixelWidth: (\d+)/.exec(dims)?.[1] || 0)
    const h = +(/pixelHeight: (\d+)/.exec(dims)?.[1] || 0)
    if (Math.max(w, h) <= MAX_EDGE) { report.push(`○ ${who}: ${w}×${h}, ${fmt(before)} — ya en tamaño, intacta`); continue }

    const outFile = join(tmp, 'out-' + objPath.replace(/\//g, '_').replace(/\.\w+$/, '.jpg'))
    execFileSync('sips', ['--resampleHeightWidthMax', String(MAX_EDGE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', inFile, '--out', outFile], { stdio: 'pipe' })
    const after = statSync(outFile).size
    if (after >= before) { report.push(`○ ${who}: el resample salió más pesado — intacta`); continue }

    if (DRY) { report.push(`◇ ${who}: ${w}×${h} · ${fmt(before)} → ${fmt(after)} (dry run, nada subido)`); continue }

    // replace-flow: subir nuevo → apuntar la fila → borrar el viejo
    const uid = objPath.split('/')[0]
    const newPath = `${uid}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/worlds/${newPath}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=3600', 'x-upsert': 'false' },
      body: readFileSync(outFile),
    })
    if (!up.ok) { report.push(`✗ ${who}: subida falló (${up.status}) — fila intacta`); failures++; continue }

    const newUrl = `${SUPABASE_URL}/storage/v1/object/public/worlds/${newPath}`
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ [col]: newUrl }),
    })
    if (!upd.ok) {
      // la fila no se movió: el objeto nuevo se recoge (disciplina Profile.jsx)
      await fetch(`${SUPABASE_URL}/storage/v1/object/worlds/${newPath}`, { method: 'DELETE', headers: H }).catch(() => {})
      report.push(`✗ ${who}: UPDATE falló (${upd.status}) — objeto nuevo retirado, fila intacta`)
      failures++; continue
    }
    // el viejo, best-effort — un huérfano no rompe nada
    await fetch(`${SUPABASE_URL}/storage/v1/object/worlds/${objPath}`, { method: 'DELETE', headers: H }).catch(() => {})
    report.push(`✓ ${who}: ${w}×${h} · ${fmt(before)} → ${fmt(after)} (−${Math.round((1 - after / before) * 100)}%)`)
  }
}

console.log(report.join('\n'))
console.log(`\n${failures ? '✗' : '✓'} backfill ${DRY ? '(dry) ' : ''}terminó — ${failures} fallas`)
process.exit(failures ? 1 : 0)
