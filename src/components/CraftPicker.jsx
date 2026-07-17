import { useState, useEffect, useRef } from 'react'
import { Loader2, X, Search } from 'lucide-react'
import { searchCrafts, categoryMeta, recognitionLine } from '@/lib/crafts'

/* =========================================================================
   CraftPicker — the craft stops being a text field and becomes RECOGNITION
   (Ley 15: ser recibido en un universo, no llenar un formulario).

   Type "video edit" and the universe answers: Videographer lights up under
   PHOTO & VIDEO. Toggle several — you are many crafts at once. The first
   becomes your primary; tap any chosen chip to hand it the lead. Under the
   chips, the world names what it heard ("a sound world — your links will
   lead"). Search rides search_crafts (0020): 141 real oficios, accents and
   aliases already folded server-side.

   Controlled: `value` = [{id,name,slug,category}], `primaryId`, and
   onChange(nextValue, nextPrimaryId). No writes here — the parent commits
   (set_profile_crafts) on its own beat. Data real o vacío honesto: only
   crafts that exist in the taxonomy can ever be chosen.
   ========================================================================= */

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'

const MAX_CRAFTS = 12

export default function CraftPicker({ value = [], primaryId = null, onChange, seedQuery = '', autoFocus = false, maxHeight = '38vh' }) {
  const [q, setQ] = useState(seedQuery)
  const [groups, setGroups] = useState(null)     // null → first load in flight
  const [searching, setSearching] = useState(false)
  const seq = useRef(0)
  const debounce = useRef(null)

  // live search — debounced, ordered: a slow early answer must never
  // overwrite a fast later one (seq guard)
  useEffect(() => {
    const mySeq = ++seq.current
    setSearching(true)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      const res = await searchCrafts(q.trim() || null)
      if (seq.current !== mySeq) return
      setGroups(res)
      setSearching(false)
    }, q ? 180 : 0)
    return () => clearTimeout(debounce.current)
  }, [q])

  const chosen = new Set(value.map((c) => c.id))
  const primary = value.find((c) => c.id === primaryId) || value[0] || null

  const toggle = (craft) => {
    if (chosen.has(craft.id)) {
      const next = value.filter((c) => c.id !== craft.id)
      const nextPrimary = primaryId === craft.id ? (next[0]?.id || null) : primaryId
      onChange(next, nextPrimary)
    } else {
      if (value.length >= MAX_CRAFTS) return
      const next = [...value, { id: craft.id, name: craft.name, slug: craft.slug, category: craft.category }]
      onChange(next, primaryId || craft.id)
    }
  }
  const lead = (craft) => onChange(value, craft.id)
  const remove = (craft) => toggle(craft)

  const line = recognitionLine(value.map((c) => ({ ...c, isPrimary: c.id === (primary?.id || null) })))
  const totalMatches = (groups || []).reduce((n, g) => n + (g.crafts?.length || 0), 0)

  return (
    <div>
      {/* what you already are — the chips, primary leads (tap to hand the lead) */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '10px' }}>
          {value.map((c) => {
            const isP = c.id === (primary?.id || null)
            const meta = categoryMeta(c.category)
            return (
              <span key={c.id} data-testid={`craft-chip-${c.slug}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', borderRadius: '100px', padding: '6px 6px 6px 12px', background: isP ? `rgba(${meta.tint},.12)` : 'rgba(242,238,230,.04)', border: `1px solid ${isP ? `rgba(${meta.tint},.55)` : HAIR_HI}`, transition: 'background .25s ease, border-color .25s ease', boxShadow: isP ? `0 0 16px rgba(${meta.tint},.12)` : 'none' }}>
                <button onClick={() => lead(c)} title={isP ? 'your primary craft' : 'make this your lead'} aria-pressed={isP}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '10px', color: isP ? `rgb(${meta.tint})` : BONE_LOW }}>{isP ? '◆' : '◇'}</span>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '10.5px', letterSpacing: '.08em', textTransform: 'uppercase', color: isP ? BONE : BONE_MID }}>{c.name}</span>
                  {isP && <span style={{ fontFamily: 'DM Mono', fontSize: '7px', letterSpacing: '.2em', color: `rgba(${meta.tint},.85)`, textTransform: 'uppercase' }}>lead</span>}
                </button>
                <button onClick={() => remove(c)} aria-label={`Remove ${c.name}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '17px', height: '17px', borderRadius: '50%', background: 'rgba(242,238,230,.05)', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: 0 }}>
                  <X size={9} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* the recognition line — the universe names what it heard (Ley 15) */}
      {value.length > 0 && line && (
        <div data-testid="craft-recognition" style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: BONE_MID, letterSpacing: '.08em', marginBottom: '10px', animation: 'fadeIn .4s ease' }}>
          {line}
        </div>
      )}

      {/* the searcher */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: BONE_LOW }} />
        <input
          data-testid="craft-search"
          autoFocus={autoFocus}
          value={q}
          placeholder="what do you make? search every craft…"
          maxLength={40}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 36px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(199,201,209,.5)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = HAIR_HI }}
        />
        {searching && <Loader2 size={13} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', color: BONE_LOW, animation: 'spin 1s linear infinite' }} />}
      </div>

      {/* the constellation of possibilities — grouped, lit by temperature */}
      <div className="no-scrollbar" style={{ marginTop: '10px', maxHeight, overflowY: 'auto', border: `1px solid ${HAIR}`, borderRadius: '12px', background: 'rgba(242,238,230,.015)', padding: '4px 12px 12px' }}>
        {groups === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '26px 0' }}>
            <Loader2 size={15} style={{ color: BONE_LOW, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '20px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase' }}>◇ nothing by that name</div>
            <div style={{ fontFamily: 'DM Sans', fontSize: '12px', color: BONE_MID, marginTop: '8px', lineHeight: 1.5 }}>
              try another word — producer, painter, editor, stylist…
            </div>
          </div>
        ) : (
          <>
            {q.trim() && (
              <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', padding: '10px 2px 0' }}>
                the universe recognizes you · {String(totalMatches).padStart(2, '0')} {totalMatches === 1 ? 'craft' : 'crafts'}
              </div>
            )}
            {groups.map((g) => {
              const meta = categoryMeta(g.category)
              return (
                <div key={g.category} style={{ paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: `rgba(${meta.tint},.8)` }}>{meta.mark}</span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>{g.category}</span>
                    <span aria-hidden style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR}, transparent)` }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {(g.crafts || []).map((c) => {
                      const on = chosen.has(c.id)
                      return (
                        <button key={c.id} className="pressable" data-testid={`craft-opt-${c.slug}`} aria-pressed={on}
                          onClick={() => toggle({ ...c, category: g.category })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '100px', padding: '7px 13px', background: on ? `rgba(${meta.tint},.1)` : 'transparent', border: `1px solid ${on ? `rgba(${meta.tint},.5)` : HAIR_HI}`, color: on ? BONE : BONE_MID, fontFamily: 'DM Sans', fontSize: '12.5px', cursor: 'pointer', transition: 'background .2s ease, border-color .2s ease, color .2s ease, transform .2s ease', boxShadow: on ? `0 0 12px rgba(${meta.tint},.1)` : 'none' }}>
                          <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '9px', color: on ? `rgb(${meta.tint})` : BONE_LOW }}>{on ? '◆' : '◇'}</span>
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {value.length >= MAX_CRAFTS && (
        <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.08em', marginTop: '8px' }}>
          twelve is the wall — a person is many crafts, not fifty.
        </div>
      )}
    </div>
  )
}
