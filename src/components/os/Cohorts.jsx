import { useState, useEffect } from 'react'
import { Loader2, ShieldCheck, TrendingUp } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, CARD, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, chromeText } from '@/lib/cosmos'

/* =========================================================================
   Cohorts — RETENCIÓN INSTRUMENTADA (D4). The number the company hangs on:
   on July 26 you open this and see, honestly, how many REAL people came back.
   If the answer is "más o menos", it isn't ready.

   Per event: distinct real buyers, how many built a world, how many returned
   within 1/7/30 days of their buy, how many bought the next event, and gross.
   Honest by code (os_cohort_by_event, 0028): demo + purged buyers and is_test
   events are excluded server-side. If it's 0, it says 0. No estimate, ever.

   OWNER-ONLY: os_cohort_by_event re-checks is_owner(); retention_activity is
   deny-all and read only in aggregate, here.
   ========================================================================= */

const fmtDate = (d) => { try { return d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—' } catch { return '—' } }
const money = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

export default function Cohorts() {
  const [loading, setLoading] = useState(true)
  const [cohorts, setCohorts] = useState([])
  const [denied, setDenied] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setLoadErr(''); setDenied(false)
      const { data, error } = await supabase.rpc('os_cohort_by_event')
      if (!alive) return
      if (error) { setLoadErr(error.message || 'Could not reach retention.'); setLoading(false); return }
      if (!data?.ok) { setDenied(true); setLoading(false); return }
      setCohorts(Array.isArray(data.cohorts) ? data.cohorts : [])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [reload])

  if (loading) return <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></div>

  if (denied) return (
    <div style={{ padding: '50px 0', textAlign: 'center' }}>
      <ShieldCheck size={22} style={{ color: BONE_LOW }} />
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '12px' }}>Owners only</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, marginTop: '8px', lineHeight: 1.6 }}>Retention is a founder read — never public, never network-wide.</div>
    </div>
  )

  if (loadErr) return (
    <div style={{ padding: '50px 0', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase' }}>couldn't load retention</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, marginTop: '8px' }}>{loadErr}</div>
      <button onClick={() => setReload(n => n + 1)} style={{ marginTop: '16px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '8px 16px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', cursor: 'pointer' }}>↻ Retry</button>
    </div>
  )

  const totalBuyers = cohorts.reduce((s, c) => s + (c.buyers || 0), 0)
  const totalReturned = cohorts.reduce((s, c) => s + (c.returned_30d || 0), 0)

  return (
    <div style={{ maxWidth: '820px' }}>
      <div className="os-reveal-fast" style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', margin: '2px 0 14px', display: 'flex', alignItems: 'center', gap: '9px' }}>
        <span>{String(totalBuyers).padStart(2, '0')} real buyers · {String(totalReturned).padStart(2, '0')} came back (30d)</span>
        <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR_HI},transparent)` }} />
      </div>

      {cohorts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <TrendingUp size={22} style={{ color: BONE_LOW }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '12px' }}>no cohorts yet</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, marginTop: '8px', lineHeight: 1.6 }}>The first real ticket sold on our own platform starts the count.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cohorts.map((c, i) => (
            <div key={c.event_id} className="os-reveal-fast" style={{ border: `1px solid ${HAIR}`, borderRadius: '14px', background: CARD, padding: '16px 18px', animationDelay: `${i * 45}ms` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: '20px', ...chromeText, letterSpacing: '.02em' }}>{c.title || c.slug}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '2px' }}>{fmtDate(c.event_date)} · {money(c.gross_cents)} gross</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: '10px' }}>
                <Stat n={c.buyers} label="buyers" hero />
                <Stat n={c.created_world} of={c.buyers} label="built a world" />
                <Stat n={c.returned_1d} of={c.buyers} label="back · 1d" />
                <Stat n={c.returned_7d} of={c.buyers} label="back · 7d" />
                <Stat n={c.returned_30d} of={c.buyers} label="back · 30d" />
                <Stat n={c.bought_next} of={c.buyers} label="bought next" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '16px', fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.06em', lineHeight: 1.7 }}>
        Buyers = distinct real accounts (the frozen webhook writes one row per order, so this is orders, not head-count). Demo, purged, and test events are excluded by code.
      </div>
    </div>
  )
}

function Stat({ n, of, label, hero }) {
  return (
    <div style={{ border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '10px 12px', background: 'rgba(var(--ink-rgb),.02)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: hero ? '26px' : '22px', color: hero ? STAR : BONE, lineHeight: 1 }}>{n ?? 0}</span>
        {of != null && <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT }}>/ {of ?? 0}</span>}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '5px' }}>{label}</div>
    </div>
  )
}
