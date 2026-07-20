import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Check } from 'lucide-react'
import GlassSheet from './GlassSheet'
import { fetchFriendState, requestFriend, respondFriend, startDM, sendMessage } from '@/lib/social'
import { announceSignalsChange } from '@/lib/signals'
import { VOCAB } from '@/lib/socialVocab'
import { BONE, BONE_MID, BONE_LOW, SILVER, HAIR, HAIR_HI, FONT_MONO, FONT_SANS } from '@/lib/cosmos'

/* =========================================================================
   CONNECT — LA INTERFAZ DE CONEXIÓN (v12.3, idea de Diego).

   ─── QUÉ PROBLEMA RESUELVE ──────────────────────────────────────────────
   Antes había un botón que decía CONNECT y hacía una cosa: mandar la
   solicitud. Y una vez aceptada… nada. Dos personas quedaban "conectadas" y
   ninguna de las dos sabía para qué. La conexión era un estado, no un
   principio de algo.

   Aquí la conexión SE PIDE CON UNA INTENCIÓN. No "acepta mi solicitud" sino
   "quiero que hagamos X". Eso cambia lo que la otra persona recibe: en vez
   de una notificación vacía, le llega una propuesta con motivo.

   ─── CÓMO SE SINCRONIZA CON MESSAGES (lo que pidió Diego) ───────────────
   No hay dos sistemas que haya que mantener de acuerdo — hay UNO. Mandar la
   conexión hace tres cosas seguidas sobre primitivas que ya existían:

     1. requestFriend(otro)  → el vínculo MUTUO (friendships, pending)
     2. startDM(otro)        → el hilo de conversación
     3. sendMessage(hilo, …) → la intención, como PRIMER MENSAJE del hilo

   O sea que la intención no es metadata que haya que reflejar en otra
   pantalla: ES el primer mensaje. Messages no necesita saber que existe
   Connect — abre el hilo y ahí está la propuesta, con su hora y su autor,
   como cualquier otro mensaje. Sincronizado por construcción, no por
   sincronización.

   ─── POR QUÉ RESPETA EL MODELO SOCIAL ───────────────────────────────────
   socialVocab.js lo dejó escrito: FOLLOW es direccional y público; CONNECTED
   es el vínculo MUTUO que se pide y se acepta, y su lista es privada por RLS.
   Esta hoja opera el vínculo mutuo (request/respond), NO el follow. Por eso
   la tarjeta tiene los dos íconos separados: seguir es un gesto, conectar es
   una conversación.

   ─── DECISIONES DE PRODUCTO PARA DIEGO ──────────────────────────────────
   Marcadas para que las apruebe o las cambie; ninguna es técnica.

   D1 · LAS CUATRO INTENCIONES. Elegí el conjunto más chico que cubre por qué
        un creativo le escribe a otro y que NO se pisan entre sí:
          · COLLABORATE — hacer algo juntos
          · INVITE      — traerlo a una noche/sala
          · ASK         — preguntar por su trabajo, pedir consejo
          · JUST CONNECT — sin agenda, que es una respuesta legítima
        Cuatro y no ocho a propósito: un menú de intenciones largo convierte
        una decisión de dos segundos en un formulario.

   D2 · LA INTENCIÓN VIAJA COMO TEXTO, NO COMO CAMPO. Va de primer mensaje.
        Ventaja: funciona hoy, sin migración, y se lee en Messages como lo
        que es. Límite: no se puede filtrar Messages por "todas las
        colaboraciones" ni pintar la intención como etiqueta en la bandeja.
        Para eso haría falta `thread_messages.kind` (o una tabla de
        intenciones) — PENDIENTE DE BACKEND si Diego lo quiere estructurado.

   D3 · CONECTAR ABRE HILO SIEMPRE. Aun con "just connect" se crea la
        conversación. Alternativa era no crearla y dejar la bandeja limpia;
        preferí que conectar SIEMPRE deje una puerta abierta, porque una
        conexión sin conversación es exactamente el estado muerto que esto
        vino a arreglar. Si Diego prefiere lo otro, es un `if`.

   D4 · LA NOTA ES OPCIONAL. La intención sola ya dice algo. Obligar a
        escribir convierte el gesto en tarea.
   ========================================================================= */

/* Las intenciones. Una entrada más aquí y aparece sola en la hoja — el
   `line` es lo que se manda si la persona no escribe nada de su puño. */
export const CONNECT_INTENTS = [
  { key: 'collab',  mark: '◇', label: 'Collaborate', hint: 'make something together',
    line: 'I want to make something with you.' },
  { key: 'invite',  mark: '✕', label: 'Invite',      hint: 'bring them to a room',
    line: 'I want to invite you to a room.' },
  { key: 'ask',     mark: '○', label: 'Ask',         hint: 'about their work',
    line: 'I have something to ask you about your work.' },
  { key: 'connect', mark: '●', label: 'Just connect', hint: 'no agenda',
    line: 'I like what you make — connecting.' },
]

export default function ConnectSheet({ me, person, wide, onClose, onStateChange }) {
  const navigate = useNavigate()
  const [bond, setBond] = useState(null)     // none | out | in | friends | null(cargando)
  const [intent, setIntent] = useState('collab')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const name = person.full_name || person.username || 'this world'
  const firstName = name.split(' ')[0]

  useEffect(() => {
    let alive = true
    fetchFriendState(me.id, person.id).then((s) => { if (alive) setBond(s || 'none') })
    return () => { alive = false }
  }, [me.id, person.id])

  /* EL ENVÍO. Los tres pasos van en orden y el vínculo va PRIMERO: si algo
     falla después, quedó pedida la conexión —que es lo que importa— en vez
     de un mensaje suelto sin vínculo. El hilo y el mensaje son la parte
     recuperable; el estado social no. */
  const send = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const chosen = CONNECT_INTENTS.find((i) => i.key === intent) || CONNECT_INTENTS[0]
      if (bond === 'none') await requestFriend(person.id)
      else if (bond === 'in') await respondFriend(person.id, true)

      const threadId = await startDM(person.id)
      const body = note.trim() || chosen.line
      await sendMessage(threadId, me.id, body)

      announceSignalsChange()
      onStateChange?.()
      setDone(true)
      // se queda un latido en "listo" y recién ahí abre el hilo: sin esa
      // pausa el salto de pantalla se siente como un error, no como respuesta
      setTimeout(() => { onClose(); navigate(`/messages/${threadId}`) }, 620)
    } catch (e) {
      setErr(e?.message || "couldn't send — try again")
      setBusy(false)
    }
  }

  const title = bond === 'friends' ? `You and ${firstName}` : `Connect with ${firstName}`
  const kicker = bond === 'friends' ? VOCAB.followingState : 'a connection with intent'

  return (
    <GlassSheet title={title} kicker={kicker} onClose={onClose} wide={wide} maxWidth="460px">
      {done ? (
        <div style={{ padding: '26px 4px 10px', textAlign: 'center' }}>
          <Check size={22} color={SILVER} />
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.18em', textTransform: 'uppercase', marginTop: '12px' }}>
            sent — opening the conversation
          </div>
        </div>
      ) : (
        <>
          {/* EL ESTADO DEL VÍNCULO, DICHO. Sin esto la hoja no sabe decirte si
              ya le pediste conexión a alguien la semana pasada, y volverías a
              pedirla sin enterarte. */}
          {bond === 'out' && (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_MID, lineHeight: 1.6, marginBottom: '16px' }}>
              You already asked to connect. Sending again just adds to the conversation.
            </div>
          )}
          {bond === 'in' && (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE, lineHeight: 1.6, marginBottom: '16px' }}>
              {firstName} asked to connect with you — sending this accepts it.
            </div>
          )}

          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '10px' }}>
            what for
          </div>

          <div role="radiogroup" aria-label="Connection intent" style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: '7px' }}>
            {CONNECT_INTENTS.map((i) => {
              const on = intent === i.key
              return (
                <button key={i.key} type="button" role="radio" aria-checked={on}
                  onClick={() => setIntent(i.key)} className="pressable"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                    padding: '12px 13px', borderRadius: '10px', cursor: 'pointer',
                    background: on ? 'rgba(var(--ink-rgb),.08)' : 'transparent',
                    border: `1px solid ${on ? 'rgba(var(--ink-rgb),.30)' : HAIR}`,
                    transition: 'background 200ms var(--ease-house), border-color 200ms var(--ease-house)',
                  }}>
                  <span aria-hidden style={{ fontFamily: FONT_MONO, fontSize: '11px', color: on ? SILVER : BONE_LOW, flexShrink: 0 }}>{i.mark}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '13.5px', color: on ? BONE : BONE_MID }}>{i.label}</span>
                    <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '3px' }}>{i.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* La nota es opcional (D4) y el placeholder enseña qué se manda si
              la dejás vacía — así nadie descubre después qué dijo en su nombre. */}
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={400}
            aria-label="Add a note"
            placeholder={(CONNECT_INTENTS.find((i) => i.key === intent) || CONNECT_INTENTS[0]).line}
            style={{
              width: '100%', marginTop: '14px', padding: '12px 13px', borderRadius: '10px',
              background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR_HI}`,
              color: BONE, fontFamily: FONT_SANS, fontSize: '13.5px', lineHeight: 1.5, resize: 'none',
            }}
          />

          {err && (
            <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: 'var(--warn)', letterSpacing: '.08em', marginTop: '10px' }}>{err}</div>
          )}

          <button onClick={send} disabled={busy} className="pressable"
            style={{
              width: '100%', marginTop: '16px', padding: '14px', borderRadius: '11px',
              background: BONE, border: 'none', color: 'var(--bg)', cursor: busy ? 'default' : 'pointer',
              fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '.16em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', opacity: busy ? .6 : 1,
            }}>
            {busy && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {bond === 'in' ? 'Accept & send' : bond === 'friends' ? 'Send' : 'Send request'}
          </button>

          <div style={{ fontFamily: FONT_SANS, fontSize: '11.5px', color: BONE_LOW, lineHeight: 1.55, marginTop: '11px', textAlign: 'center' }}>
            This opens a conversation in Messages — your note is the first thing they read.
          </div>
        </>
      )}
    </GlassSheet>
  )
}
