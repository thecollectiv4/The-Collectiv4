import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useWide } from '@/lib/useIsDesktop'
import { categoryMeta } from '@/lib/crafts'

/* =========================================================================
   RelatedWorlds — the matching column's first public face (D2).
   Under a person's museum: real worlds that SHARE their craft, ranked by
   how much craft they share. The craft spine (0020) is what makes this
   possible — free text never matched anyone.

   Honest by code: only real, public, non-demo worlds (the profile_crafts
   read policy already hides retired demo personas); zero matches renders
   NOTHING — never a filler rail (Ley 11).
   ========================================================================= */

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

export default function RelatedWorlds({ profileId, crafts = [] }) {
  const navigate = useNavigate()
  const wide = useWide()
  const [related, setRelated] = useState([])

  useEffect(() => {
    let alive = true
    setRelated([])
    const craftIds = crafts.map((c) => c.id).filter(Boolean)
    if (!profileId || !craftIds.length) return
    ;(async () => {
      try {
        // everyone who shares ANY of this person's crafts, ranked by overlap
        const { data: rows, error } = await supabase
          .from('profile_crafts')
          .select('profile_id, craft_id, crafts(name, slug, category)')
          .in('craft_id', craftIds)
          .neq('profile_id', profileId)
          .limit(120)
        if (error || !rows?.length) return
        const byProfile = new Map()
        rows.forEach((r) => {
          if (!r?.crafts) return
          const e = byProfile.get(r.profile_id) || { shared: [] }
          e.shared.push({ name: r.crafts.name, slug: r.crafts.slug, category: r.crafts.category })
          byProfile.set(r.profile_id, e)
        })
        // rank by overlap, keep a wider pool than shown — the is_demo filter
        // below trims AFTER ranking, and trimming first could starve the rail
        const ranked = [...byProfile.entries()]
          .sort((a, b) => b[1].shared.length - a[1].shared.length)
          .slice(0, 14)
        const ids = ranked.map(([id]) => id)
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, verified, is_demo')
          .in('id', ids)
          .eq('is_demo', false)
        if (!alive || !profs?.length) return
        const profById = Object.fromEntries(profs.map((p) => [p.id, p]))
        setRelated(
          ranked
            .filter(([id]) => profById[id])
            .slice(0, 6)
            .map(([id, e]) => ({ ...profById[id], shared: e.shared }))
        )
      } catch { /* the orbit stays empty — honest */ }
    })()
    return () => { alive = false }
  }, [profileId, crafts.map((c) => c.id).join(',')])

  if (!related.length) return null

  const frame = wide
    ? { maxWidth: '1440px', margin: '0 auto', padding: '0 clamp(40px, 5vw, 76px) 90px' }
    : { padding: '0 24px 110px' }

  return (
    <div data-testid="related-worlds" className="card-in" style={{ position: 'relative', zIndex: 3, background: 'transparent', marginTop: '-60px' }}>
      <div style={frame}>
        {/* the header — same catalog language as the museum's movements */}
        <div style={{ display: 'flex', alignItems: 'center', gap: wide ? '16px' : '12px', marginBottom: wide ? '22px' : '16px' }}>
          <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: SILVER, opacity: .9 }}>◇</span>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '25px', letterSpacing: '.05em', lineHeight: 1, color: BONE }}>WORLDS IN ORBIT</span>
          <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${HAIR_HI}, transparent)` }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: wide ? '9px' : '8px', letterSpacing: '.26em', color: BONE_LOW, textTransform: 'uppercase' }}>same craft, same sky</span>
        </div>

        {/* 3+ worlds ride a rail; one or two OWN their row full-width — a
            half-width island in void is abandoned space (panel catch, Ley 4) */}
        <div className="no-scrollbar" style={wide
          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }
          : related.length <= 2
            ? { display: 'flex', flexDirection: 'column', gap: '12px' }
            : { display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
          {related.map((p) => {
            const avatar = safeImg(p.avatar_url)
            const name = p.full_name || 'Unnamed'
            const lead = p.shared[0]
            const meta = categoryMeta(lead?.category)
            return (
              <div key={p.id} className="disc-card pressable" role="button" tabIndex={0} aria-label={`Open ${name}'s world`}
                onClick={() => navigate('/user/' + p.id)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); navigate('/user/' + p.id) } }}
                style={{ flexShrink: 0, minWidth: wide ? 0 : (related.length <= 2 ? 0 : '186px'), display: 'flex', alignItems: 'center', gap: '12px', border: `1px solid ${HAIR_HI}`, borderRadius: '14px', background: CARD, padding: '13px 14px', cursor: 'pointer' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: `1px solid rgba(${meta.tint},.5)`, background: VOID, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px rgba(${meta.tint},.1)` }}>
                  {avatar
                    ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: 'Bebas Neue', fontSize: '17px', color: BONE }}>{name[0].toUpperCase()}</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="disc-name" style={{ fontFamily: 'Bebas Neue', fontSize: '18px', letterSpacing: '.02em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: `rgba(${meta.tint},.9)`, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    also {lead?.name}{p.shared.length > 1 ? ` +${p.shared.length - 1}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
