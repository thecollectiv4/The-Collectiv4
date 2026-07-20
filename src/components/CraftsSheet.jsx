import { ArrowUpRight } from 'lucide-react'
import GlassSheet from './GlassSheet'
import { categoryMeta } from '@/lib/crafts'
import { tintChannel } from '@/lib/cosmos'

/* =========================================================================
   CraftsSheet (v12) — lo que hay detrás del "+11".

   La línea del hero sólo cabe para tres crafts, así que el resto se resumía
   en un "+9" que no se podía picar: la app te decía que había más y no te
   dejaba verlo. Ahora se abre la lista COMPLETA.

   Y cada craft es una puerta, no una etiqueta: picarlo lleva a Community
   filtrado por ese craft — o sea a las OTRAS personas que lo comparten. Ese
   es el punto entero (Diego: descubrimiento por craft para conectar con
   gente afín). No hace falta vista nueva: Community ya lee ?craft=slug del
   URL, así que esto se cuelga de la columna de descubrimiento que ya existe
   en vez de inventar una paralela.

   El primario va marcado, y el orden respeta el del perfil (primario primero)
   — la misma regla que el hero, para que no digan cosas distintas.
   ========================================================================= */

const BONE = 'var(--cream)'
const BONE_LOW = 'var(--cream-dim)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'

export default function CraftsSheet({ name, crafts = [], onPickCraft, onClose, wide }) {
  // primario primero, pase lo que pase — igual que el hero (una fila recién
  // guardada llega en otro orden que una leída de la DB)
  const ordered = [...crafts].sort((a, b) => (b.isPrimary === true) - (a.isPrimary === true))

  return (
    <GlassSheet
      title={name ? `${name}'s crafts` : 'Crafts'}
      /* el kicker se queda CORTO a propósito: la explicación completa ya vive
         al pie de la hoja, y aquí arriba compite por renglón con el botón de
         cerrar — al envolverse se le metía encima */
      kicker={`◇ ${crafts.length} ${crafts.length === 1 ? 'craft' : 'crafts'}`}
      onClose={onClose} wide={wide}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {ordered.map((c, i) => {
          const meta = categoryMeta(c.category)
          const isP = c.isPrimary || (i === 0 && !crafts.some((x) => x.isPrimary))
          return (
            <button key={c.slug} className="pressable row-lead" onClick={() => onPickCraft(c.slug)}
              aria-label={`See other ${c.name}s`}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', borderRadius: '12px',
                padding: '13px 12px', cursor: 'pointer', color: BONE,
              }}>
              <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '11px', color: `rgb(${tintChannel(meta.tint)})`, flexShrink: 0, width: '14px' }}>
                {meta.mark}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{
                  display: 'block', fontFamily: 'DM Mono', fontSize: '11.5px',
                  letterSpacing: '.16em', textTransform: 'uppercase',
                  color: isP ? `rgb(${tintChannel(meta.tint)})` : BONE,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.name}</span>
                {isP && (
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', marginTop: '4px' }}>
                    primary
                  </span>
                )}
              </span>
              <ArrowUpRight size={14} style={{ color: BONE_LOW, flexShrink: 0 }} />
            </button>
          )
        })}
      </div>
      <p style={{ fontFamily: 'DM Sans', fontSize: '11.5px', color: BONE_LOW, lineHeight: 1.6,
        margin: '10px 12px 0', paddingTop: '12px', borderTop: `1px solid ${HAIR_HI}` }}>
        Cada craft abre Community filtrado — la gente que comparte ese oficio.
      </p>
    </GlassSheet>
  )
}
