import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import GlassSheet from './GlassSheet'
import SeedPill from './SeedMark'
import VerifiedMark from './VerifiedMark'

/* =========================================================================
   PeopleSheet (v12) — la gente detrás de un conteo.

   "3 FOLLOWERS · 2 FOLLOWING" era texto muerto. Ahora se pica y se abre; cada
   renglón es una puerta al mundo de esa persona (la visión de Diego: los
   nombres son puertas).

   HONESTO POR CÓDIGO, NO POR MEMORIA: este componente NO filtra seed. No
   hace falta y no debe — la RLS de follows (0034) sólo entrega la arista
   cuando los dos mundos son públicos, así que a un miembro normal el seed
   nunca llega hasta acá. Y lo que sí llega (a un fundador) viaja etiquetado:
   is_demo acompaña a la identidad (guardrail 4) y se pinta con la misma
   píldora que en todas partes. Filtrar aquí a mano sería duplicar la ley en
   un segundo lugar donde después se olvidaría actualizarla.

   El vacío se dice, no se deja en blanco: una lista que carga y no trae nada
   tiene que explicarse, porque "cero" y "no cargó" se ven idénticos si no.
   ========================================================================= */

const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'
const HAIR = 'rgba(var(--ink-rgb),0.08)'

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) || (raw || '').startsWith('data:image/')) ? raw : ''

export default function PeopleSheet({ title, kicker, load, loadKey, onOpenPerson, onClose, wide }) {
  const [people, setPeople] = useState(null)   // null = todavía preguntando

  /* `load` es una función nueva en cada render del padre, así que NO puede
     ser la dependencia del efecto: cualquier re-render allá arriba volvería a
     pegarle a la red por nada. La identidad de la consulta la lleva loadKey
     (a quién y qué lista), que es un string y se compara por valor; la
     función viaja en un ref para que el efecto siempre llame a la última sin
     depender de ella. */
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let alive = true
    setPeople(null)
    loadRef.current().then((rows) => { if (alive) setPeople(rows || []) })
      .catch(() => { if (alive) setPeople([]) })
    return () => { alive = false }
  }, [loadKey])

  return (
    <GlassSheet title={title} kicker={kicker} onClose={onClose} wide={wide}>
      {people === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '38px 0' }}>
          <Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
        </div>
      ) : people.length === 0 ? (
        <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, margin: 0, padding: '30px 14px', textAlign: 'center' }}>
          Nadie por aquí todavía.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {people.map((p) => {
            const avatar = safeImg(p.avatar_url)
            const name = p.full_name || p.username || 'Unnamed'
            return (
              <button key={p.id} className="pressable" onClick={() => onOpenPerson(p.id)}
                aria-label={`Open ${name}'s world`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none', borderRadius: '12px',
                  padding: '11px 12px', cursor: 'pointer', color: BONE,
                  borderBottom: `1px solid ${HAIR}`,
                }}>
                <span style={{
                  width: '40px', height: '40px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
                  border: `1px solid ${SILVER}`, background: 'rgba(20,20,26,.8)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {avatar
                    ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', color: BONE }}>{name[0].toUpperCase()}</span>}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: '18px', letterSpacing: '.02em', lineHeight: 1.1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</span>
                    {p.verified && <span aria-label="Verified" style={{ display: 'inline-flex', flexShrink: 0 }}><VerifiedMark size={13} /></span>}
                    {/* guardrail 4: si un fundador está viendo seed, va rotulado */}
                    {p.is_demo && <span style={{ display: 'inline-flex', flexShrink: 0 }}><SeedPill is_demo={p.is_demo} size={7.5} /></span>}
                  </span>
                  {(p.username || p.discipline) && (
                    <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '9.5px', color: BONE_LOW,
                      letterSpacing: '.06em', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.username ? `@${p.username}` : p.discipline}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </GlassSheet>
  )
}
