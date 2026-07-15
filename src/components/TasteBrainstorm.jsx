import { useState, useEffect, useRef } from 'react'
import { Loader2, Search } from 'lucide-react'
import { searchTasteBank, TASTE_DOMAINS } from '@/lib/tastes'
import Mark from '@/components/Mark'

/* =========================================================================
   TasteBrainstorm — the taste stops being a survey and becomes a
   BRAINSTORM (Ley 15: ser recibido en un universo, no llenar un formulario).

   Three rails — MUSIC / FILM / ALIVE — one search, and the bank answers as
   a constellation of chips (0022's search_taste_bank, accents folded
   server-side). Tap and it lands in your set. Type something the bank has
   never heard and press Enter — it lands verbatim: the bank seeds the
   constellation, it never limits it.

   PRIVACY IS THE PRODUCT: every taste lands QUIET (is_public=false) — it
   feeds the matching invisibly, never displays. A per-chip SHOWN/QUIET
   toggle (word beside the mark, Ley 5) is the only way an item speaks.

   Controlled: `value` = [{domain,label,is_public}], order = display
   position. No writes here — the parent commits (set_profile_tastes) on
   its own beat, exactly like CraftPicker.
   ========================================================================= */

const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'

const MAX_PER_DOMAIN = 40
const MAX_TOTAL = 90
const SCATTER = 10                       // curated scatter when the query is empty

/* the placeholder speaks the active domain's language */
const PLACEHOLDER = {
  music: 'house? corridos? film scores?',
  film: 'interstellar? a24? cine de oro?',
  interest: 'fucho? vinyl? stoicism?',
}

/* fold accents + kebab — the testid alphabet (mirrors the bank's slugs) */
const kebab = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '')
const fold = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export default function TasteBrainstorm({ value = [], onChange, maxHeight = '24vh' }) {
  const [domain, setDomain] = useState('music')
  const [q, setQ] = useState('')
  const [items, setItems] = useState(null)       // null → first load in flight
  const [searching, setSearching] = useState(false)
  const seq = useRef(0)
  const debounce = useRef(null)

  // live search — debounced, ordered: a slow early answer must never
  // overwrite a fast later one (seq guard, the CraftPicker discipline)
  useEffect(() => {
    const mySeq = ++seq.current
    setSearching(true)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      const res = await searchTasteBank(q.trim() || null, domain)
      if (seq.current !== mySeq) return
      const group = (res || []).find((g) => g.domain === domain)
      setItems(group?.items || [])
      setSearching(false)
    }, q ? 180 : 0)
    return () => clearTimeout(debounce.current)
  }, [q, domain])

  const held = (d, label) => value.some((t) => t.domain === d && fold(t.label) === fold(label))
  const counts = {}
  value.forEach((t) => { counts[t.domain] = (counts[t.domain] || 0) + 1 })
  const atCap = value.length >= MAX_TOTAL || (counts[domain] || 0) >= MAX_PER_DOMAIN

  const add = (d, label) => {
    const clean = (label || '').trim().slice(0, 48)
    if (!clean || held(d, clean)) return
    if (value.length >= MAX_TOTAL || (counts[d] || 0) >= MAX_PER_DOMAIN) return
    onChange([...value, { domain: d, label: clean, is_public: false }])
  }
  const remove = (d, label) => onChange(value.filter((t) => !(t.domain === d && fold(t.label) === fold(label))))
  const toggle = (d, label) => { held(d, label) ? remove(d, label) : add(d, label) }
  const flip = (d, label) => onChange(value.map((t) => (t.domain === d && fold(t.label) === fold(label)) ? { ...t, is_public: !t.is_public } : t))

  // Enter — free text is first-class: an exact bank match lands with the
  // bank's own casing; anything else lands verbatim in the active domain
  const onEnter = () => {
    const text = q.trim()
    if (!text) return
    const hit = (items || []).find((it) => fold(it.label) === fold(text))
    add(domain, hit ? hit.label : text)
    setQ('')
  }

  const suggestions = items === null ? null : (q.trim() ? items : items.slice(0, SCATTER))
  const shownN = value.filter((t) => t.is_public).length
  const quietN = value.length - shownN

  return (
    <div>
      {/* the three rails — tap one, the constellation follows */}
      <div style={{ display: 'flex', gap: '7px', marginBottom: '10px' }}>
        {TASTE_DOMAINS.map((d) => {
          const on = domain === d.key
          const n = counts[d.key] || 0
          return (
            <button key={d.key} className="pressable" data-testid={`taste-domain-${d.key}`} aria-pressed={on}
              onClick={() => setDomain(d.key)}
              style={{ flex: 1, minHeight: '54px', background: on ? 'rgba(199,201,209,.07)' : 'transparent', border: `1px solid ${on ? 'rgba(199,201,209,.45)' : HAIR_HI}`, borderRadius: '10px', padding: '9px 6px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all .2s ease' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Mark type={d.mark} size={10} color={on ? BONE : BONE_LOW} />
                <span style={{ fontFamily: 'DM Mono', fontSize: '9.5px', letterSpacing: '.18em', textTransform: 'uppercase', color: on ? BONE : BONE_MID }}>{d.label}{n > 0 ? ` · ${n}` : ''}</span>
              </span>
              <span style={{ fontFamily: 'DM Mono', fontSize: '7px', letterSpacing: '.06em', color: BONE_LOW, textAlign: 'center', lineHeight: 1.35 }}>{d.kicker}</span>
            </button>
          )
        })}
      </div>

      {/* the searcher — Enter lands free text, the bank never limits */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: BONE_LOW }} />
        <input
          data-testid="taste-search"
          value={q}
          placeholder={PLACEHOLDER[domain]}
          maxLength={48}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter() } }}
          style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 36px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(199,201,209,.5)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = HAIR_HI }}
        />
        {searching && <Loader2 size={13} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: BONE_LOW, animation: 'spin 1s linear infinite' }} />}
      </div>

      {/* the suggestion constellation — never blank: empty query scatters
          the bank's first ten of the active domain */}
      <div className="no-scrollbar" style={{ marginTop: '10px', maxHeight, overflowY: 'auto', border: `1px solid ${HAIR}`, borderRadius: '12px', background: 'rgba(242,238,230,.015)', padding: '12px' }}>
        {suggestions === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '22px 0' }}>
            <Loader2 size={15} style={{ color: BONE_LOW, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: '14px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase' }}>◇ not in the bank</div>
            <div style={{ fontFamily: 'DM Sans', fontSize: '12px', color: BONE_MID, marginTop: '8px', lineHeight: 1.5 }}>
              press Enter — “{q.trim().slice(0, 32)}” lands as yours, word for word.
            </div>
          </div>
        ) : (
          <>
            {q.trim() && (
              <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', padding: '0 2px 10px' }}>
                the universe hears you · {String(suggestions.length).padStart(2, '0')} {suggestions.length === 1 ? 'match' : 'matches'} — or press Enter for your own words
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
              {suggestions.map((it) => {
                const on = held(domain, it.label)
                return (
                  <button key={it.id} className="pressable" data-testid={`taste-opt-${it.slug}`} aria-pressed={on}
                    onClick={() => toggle(domain, it.label)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px', borderRadius: '100px', padding: '8px 14px', background: on ? 'rgba(199,201,209,.1)' : 'transparent', border: `1px solid ${on ? 'rgba(199,201,209,.5)' : HAIR_HI}`, color: on ? BONE : BONE_MID, fontFamily: 'DM Sans', fontSize: '12.5px', cursor: 'pointer', transition: 'all .2s ease', boxShadow: on ? '0 0 12px rgba(199,201,209,.1)' : 'none' }}>
                    <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: on ? SILVER : BONE_LOW }}>{on ? '◆' : '◇'}</span>
                    {it.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* your set — grouped by domain; chip body removes, the word-toggle
          (SHOWN/QUIET, Ley 5) flips what your world speaks */}
      {value.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TASTE_DOMAINS.map((d) => {
            const mine = value.filter((t) => t.domain === d.key)
            if (!mine.length) return null
            return (
              <div key={d.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                  <Mark type={d.mark} size={9} color={SILVER} style={{ opacity: .8 }} />
                  <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>{d.label}</span>
                  <span aria-hidden style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR}, transparent)` }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {mine.map((t) => {
                    const kb = kebab(t.label)
                    const pub = !!t.is_public
                    return (
                      <span key={`${t.domain}:${kb}`} data-testid={`taste-chip-${t.domain}-${kb}`}
                        style={{ display: 'inline-flex', alignItems: 'stretch', borderRadius: '100px', border: `1px solid ${pub ? 'rgba(242,238,230,.45)' : HAIR_HI}`, background: pub ? 'rgba(242,238,230,.07)' : 'rgba(242,238,230,.02)', overflow: 'hidden', transition: 'all .25s ease' }}>
                        <button className="pressable" onClick={() => remove(t.domain, t.label)} aria-label={`Remove ${t.label}`} title="tap to remove"
                          style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', border: 'none', padding: '10px 6px 10px 13px', cursor: 'pointer', minHeight: '40px' }}>
                          <span style={{ fontFamily: 'DM Mono', fontSize: '10.5px', letterSpacing: '.06em', color: pub ? BONE : BONE_MID }}>{t.label}</span>
                        </button>
                        <button className="pressable" onClick={() => flip(t.domain, t.label)} data-testid={`taste-vis-${t.domain}-${kb}`} aria-pressed={pub}
                          aria-label={pub ? `${t.label} — shown in your world; tap to keep it quiet` : `${t.label} — quiet, only you; tap to show it in your world`}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: pub ? 'rgba(242,238,230,.04)' : 'transparent', border: 'none', borderLeft: `1px solid ${pub ? 'rgba(242,238,230,.3)' : HAIR}`, padding: '10px 12px 10px 10px', cursor: 'pointer', minWidth: '64px', minHeight: '40px' }}>
                          <Mark type={pub ? 'dot' : 'ring'} size={8} color={pub ? BONE : BONE_LOW} />
                          <span style={{ fontFamily: 'DM Mono', fontSize: '7px', letterSpacing: '.16em', textTransform: 'uppercase', color: pub ? BONE : BONE_LOW }}>{pub ? 'SHOWN' : 'QUIET'}</span>
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* the recognition line — the universe answers the hand (Ley 15) */}
      {value.length >= 3 && (
        <div data-testid="taste-recognition" style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_MID, letterSpacing: '.08em', marginTop: '10px', animation: 'fadeIn .4s ease' }}>
          {shownN > 0
            ? `◆ the universe is listening — ${value.length} tastes · ${quietN} quiet · ${shownN} shown`
            : `◆ the universe is listening — ${value.length} tastes held quiet`}
        </div>
      )}

      {/* the privacy line — always visible, the product promise in one breath */}
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', lineHeight: 1.6, marginTop: value.length >= 3 ? '6px' : '10px' }}>
        quiet by default — only you see these. the universe matches in silence.
        {shownN > 0 && <span style={{ color: BONE_MID }}> ● shown in your world · ○ quiet</span>}
      </div>

      {atCap && (
        <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', marginTop: '8px' }}>
          the wall — a brainstorm, not a database dump.
        </div>
      )}
    </div>
  )
}
