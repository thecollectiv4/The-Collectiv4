import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Check, ArrowRight } from 'lucide-react'
import GlassSheet from './GlassSheet'
import {
  fetchFriendState, requestFriend, respondFriend, startDM, sendMessage,
  addCloseFriend, removeCloseFriend, myCloseFriends,
} from '@/lib/social'
import { announceSignalsChange } from '@/lib/signals'
import { VOCAB } from '@/lib/socialVocab'
import { WELL } from '@/lib/glass'
import { BONE, BONE_MID, BONE_LOW, SILVER, FAINT, HAIR, HAIR_HI, FONT_MONO, FONT_SANS } from '@/lib/cosmos'

/* =========================================================================
   CONNECT — LA INTERFAZ DE CONEXIÓN (v13 · Design Max).

   ─── QUÉ ES ─────────────────────────────────────────────────────────────
   Picar CONNECT no es "seguir". Abre una intención: le decís a la persona
   PARA QUÉ querés conectar, y esa intención se vuelve el primer mensaje del
   hilo. La conexión es un principio de algo, no un estado muerto.

   EL HANDSHAKE (Diego, refinado en v13): picar Connect y NO mandar nada = NO
   conecta. El vínculo se PIDE al mandar (requestFriend → pending) y se
   CONFIRMA cuando la otra persona lo recibe/acepta. Hasta entonces el estado
   es honesto: "requested", no "connected".

   ─── LAS CAPAS (la profundidad que pidió el Design Max) ─────────────────
   No todas las conexiones son iguales, y la interfaz lo dice con su forma:

     · SIN CONECTAR → cuatro intenciones. Colaborar, proponer un booking,
       invitar a una sala, o simplemente conectar. Cada una manda su vínculo
       + su primer mensaje.
     · YA CONECTADOS → el círculo íntimo. Aparece CLOSE FRIENDS: meter a
       alguien a tu lista privada, para lo cercano. La DB obliga close ⊆
       friends (add_close_friend rechaza a un no-amigo), así que esta capa
       SÓLO existe una vez que el vínculo es mutuo — la arquitectura y la UI
       dicen lo mismo, que es como tiene que ser.

   ─── CÓMO SINCRONIZA CON MESSAGES ───────────────────────────────────────
   No hay dos sistemas. La intención ES el primer mensaje del hilo (startDM +
   sendMessage), así que Messages no necesita saber que Connect existe: abre
   el hilo y ahí está la propuesta, con su hora y su autor. Sincronizado por
   construcción.

   ─── EL DISEÑO (Ley del Lujo Inmersivo, al tope) ────────────────────────
   Las intenciones NO son cuatro cajas. Son una composición: un riel de luz
   que baja por el lado izquierdo del que está elegido, la marca de la casa
   como índice tranquilo, jerarquía de tipo estricta, y UN solo movimiento
   que confirma la elección — nada que decore. El vidrio de la fila elegida
   es WELL (la faceta encendida de glass.js), no un relleno plano. Museo, no
   circo: el vacío alrededor es el lujo.
   ========================================================================= */

/* Las intenciones. Una entrada más aquí y aparece sola en la hoja. El `line`
   es lo que se manda si la persona no escribe nada de su puño. Los marks son
   las marcas de carta estelar de la casa — índice, no pictograma: la palabra
   y el hint cargan la función, la marca sólo da ritmo. */
export const CONNECT_INTENTS = [
  { key: 'collab',  mark: '◇', label: 'Collaborate',    hint: 'make something together',
    line: 'I want to make something with you.' },
  { key: 'booking', mark: '△', label: 'Propose a booking', hint: 'work together — details later',
    line: 'I want to book you / propose working together.' },
  { key: 'invite',  mark: '✕', label: 'Invite',         hint: 'to a room or a world',
    line: 'I want to invite you to something.' },
  { key: 'connect', mark: '●', label: 'Just connect',    hint: 'no agenda',
    line: 'I like what you make — connecting.' },
]

/* ── UNA FILA DE INTENCIÓN ────────────────────────────────────────────────
   El riel de luz izquierdo es lo único que se mueve: entra con scaleY cuando
   la fila se elige (confirma "este camino"), y se va cuando otra la releva.
   La fila elegida se apoya sobre WELL — vidrio con canto, no color plano. */
function IntentRow({ intent, active, onPick }) {
  return (
    <button
      type="button" role="radio" aria-checked={active}
      data-testid={`connect-intent-${intent.key}`}
      onClick={onPick} className="pressable"
      style={{
        position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: '13px',
        textAlign: 'left', padding: '15px 15px 15px 17px', borderRadius: '12px', cursor: 'pointer',
        overflow: 'hidden',
        border: `1px solid ${active ? 'transparent' : HAIR}`,
        transition: 'border-color 260ms var(--ease-house)',
        ...(active ? WELL : { background: 'transparent' }),
      }}
    >
      {/* el riel de luz — sólo en la elegida, entra desde el centro */}
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: '10%', bottom: '10%', width: '2.5px', borderRadius: '2px',
        background: 'linear-gradient(180deg, transparent, rgba(var(--ink-rgb),.85) 22%, rgba(var(--ink-rgb),.85) 78%, transparent)',
        transformOrigin: 'center', transform: active ? 'scaleY(1)' : 'scaleY(0)',
        transition: 'transform 300ms var(--ease-house)',
      }} />
      {/* la marca de la casa, en un chip que se enciende con la elección */}
      <span aria-hidden style={{
        flexShrink: 0, width: '30px', height: '30px', borderRadius: '9px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT_MONO, fontSize: '13px',
        color: active ? BONE : BONE_LOW,
        background: active ? 'rgba(var(--ink-rgb),.10)' : 'rgba(var(--ink-rgb),.04)',
        border: `1px solid ${active ? 'rgba(var(--ink-rgb),.22)' : HAIR}`,
        transition: 'color 260ms var(--ease-house), background 260ms var(--ease-house), border-color 260ms var(--ease-house)',
      }}>{intent.mark}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '14.5px', letterSpacing: '.005em', color: active ? BONE : BONE_MID, transition: 'color 260ms var(--ease-house)' }}>{intent.label}</span>
        <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', color: active ? BONE_LOW : FAINT, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '4px', transition: 'color 260ms var(--ease-house)' }}>{intent.hint}</span>
      </span>
    </button>
  )
}

export default function ConnectSheet({ me, person, wide, onClose, onStateChange }) {
  const navigate = useNavigate()
  const [bond, setBond] = useState(null)      // none | out | in | friends | null(cargando)
  const [intent, setIntent] = useState('collab')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')        // '' | 'sent' | 'close-on' | 'close-off'
  const [isClose, setIsClose] = useState(false)
  const [closeBusy, setCloseBusy] = useState(false)
  const doneTimer = useRef(0)

  const name = person.full_name || person.username || 'this world'
  const firstName = name.split(' ')[0]

  useEffect(() => {
    let alive = true
    fetchFriendState(me.id, person.id).then((s) => { if (alive) setBond(s || 'none') })
    return () => { alive = false; clearTimeout(doneTimer.current) }
  }, [me.id, person.id])

  // sólo si ya son amigos tiene sentido leer la lista íntima (la door la
  // rechazaría de otro modo, y pedirla sin conexión sería ruido)
  useEffect(() => {
    if (bond !== 'friends') return undefined
    let alive = true
    myCloseFriends().then((list) => {
      if (alive) setIsClose(list.some((p) => (p.id || p.friend_id) === person.id))
    })
    return () => { alive = false }
  }, [bond, person.id])

  /* EL ENVÍO. El vínculo va PRIMERO: si algo falla después, quedó pedida la
     conexión —que es lo que importa— en vez de un mensaje sin vínculo. El
     hilo y el mensaje son recuperables; el estado social no. */
  const send = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const chosen = CONNECT_INTENTS.find((i) => i.key === intent) || CONNECT_INTENTS[0]
      if (bond === 'none') await requestFriend(person.id)
      else if (bond === 'in') await respondFriend(person.id, true)

      const threadId = await startDM(person.id)
      await sendMessage(threadId, me.id, note.trim() || chosen.line)

      announceSignalsChange()
      onStateChange?.()
      setDone('sent')
      // un latido en "listo" antes del salto de pantalla — sin la pausa el
      // cambio se siente como un error, no como una respuesta
      doneTimer.current = setTimeout(() => { onClose(); navigate(`/messages/${threadId}`) }, 720)
    } catch (e) {
      setErr(e?.message || "couldn't send — try again")
      setBusy(false)
    }
  }

  /* CLOSE FRIENDS — optimista con reversión honesta. Sólo alcanzable en el
     estado 'friends' (la door lo exige y la UI también). */
  const toggleClose = async () => {
    if (closeBusy) return
    const next = !isClose
    setCloseBusy(true); setErr('')
    setIsClose(next)   // optimista
    try {
      if (next) await addCloseFriend(person.id)
      else await removeCloseFriend(person.id)
      announceSignalsChange()
      onStateChange?.()
      setDone(next ? 'close-on' : 'close-off')
      doneTimer.current = setTimeout(() => setDone(''), 1500)
    } catch (e) {
      setIsClose(!next)   // reversión limpia a la verdad del servidor
      setErr(e?.message || "couldn't update — try again")
    } finally {
      setCloseBusy(false)
    }
  }

  const connected = bond === 'friends'
  const title = connected ? `You & ${firstName}` : `Connect with ${firstName}`
  const kicker = connected ? 'your connection' : 'a connection with intent'

  return (
    <GlassSheet title={title} kicker={kicker} onClose={onClose} wide={wide} maxWidth="480px">
      <div data-testid="connect-sheet">
      {done ? (
        <DoneCeremony kind={done} firstName={firstName} />
      ) : connected ? (
        /* ── YA CONECTADOS: el círculo íntimo + un mensaje ── */
        <div style={{ paddingTop: '2px' }}>
          <CloseFriendsCard on={isClose} busy={closeBusy} firstName={firstName} onToggle={toggleClose} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '22px 0 12px' }}>
            <span style={{ height: '1px', flex: 1, background: HAIR }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.24em', textTransform: 'uppercase' }}>or say something</span>
            <span style={{ height: '1px', flex: 1, background: HAIR }} />
          </div>

          <NoteField value={note} onChange={setNote} placeholder={`Message ${firstName}…`} />
          {err && <ErrLine msg={err} />}
          <SendButton onClick={send} busy={busy} disabled={!note.trim()} label="Send message" />
        </div>
      ) : (
        /* ── SIN CONECTAR: las cuatro intenciones ── */
        <div style={{ paddingTop: '2px' }}>
          {bond === 'out' && <StateNote tone="mid">You already asked to connect — sending again just adds to the conversation.</StateNote>}
          {/* el copy tiene que decir la MISMA ley que el código: nada se manda
              hasta que picás. "Choosing an intent accepts it" prometía que
              elegir el radio ya aceptaba — justo lo contrario del handshake
              que este archivo declara arriba. */}
          {bond === 'in' && <StateNote tone="hi">{firstName} asked to connect with you. Pick what for, then send — that accepts it.</StateNote>}

          <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.24em', textTransform: 'uppercase', margin: '2px 0 11px' }}>
            what for
          </div>

          <div role="radiogroup" aria-label="Connection intent" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {CONNECT_INTENTS.map((i) => (
              <IntentRow key={i.key} intent={i} active={intent === i.key} onPick={() => setIntent(i.key)} />
            ))}
          </div>

          <div style={{ marginTop: '16px' }}>
            <NoteField
              value={note} onChange={setNote}
              placeholder={(CONNECT_INTENTS.find((i) => i.key === intent) || CONNECT_INTENTS[0]).line}
            />
          </div>

          {err && <ErrLine msg={err} />}

          <SendButton onClick={send} busy={busy}
            label={bond === 'in' ? 'Accept & send' : 'Send request'} />

          <p style={{ fontFamily: FONT_SANS, fontSize: '11.5px', color: BONE_LOW, lineHeight: 1.55, marginTop: '12px', textAlign: 'center' }}>
            Nothing is sent until you tap. Your note becomes the first thing they read in Messages.
          </p>
        </div>
      )}
      </div>
    </GlassSheet>
  )
}

/* ── EL CÍRCULO ÍNTIMO ────────────────────────────────────────────────────
   Una tarjeta con presencia, no una casilla. El estado ON se lee de lejos:
   el canto se enciende, el punto orbital se llena. Es privado por doctrina —
   el copy lo dice, porque una persona tiene que saber que su círculo no lo
   ve nadie más. */
function CloseFriendsCard({ on, busy, firstName, onToggle }) {
  return (
    <button type="button" onClick={onToggle} disabled={busy} className="pressable"
      aria-pressed={on}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left',
        padding: '16px 16px', borderRadius: '14px', cursor: busy ? 'default' : 'pointer',
        border: `1px solid ${on ? 'rgba(var(--ink-rgb),.30)' : HAIR_HI}`,
        transition: 'border-color 300ms var(--ease-house), background 300ms var(--ease-house)',
        ...(on ? WELL : { background: 'rgba(var(--ink-rgb),.03)' }),
      }}>
      {/* la marca del círculo — un anillo con su satélite, lleno cuando estás dentro */}
      <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="34" height="34" viewBox="0 0 34 34" style={{ display: 'block' }}>
          <circle cx="17" cy="17" r="11" fill="none" stroke={on ? BONE : BONE_LOW} strokeWidth="1.2" opacity={on ? 0.85 : 0.5} />
          <circle cx="17" cy="6" r={on ? 3 : 2.4} fill={on ? BONE : BONE_LOW}
            style={{ transition: 'r 300ms var(--ease-house)' }} />
        </svg>
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '15px', color: on ? BONE : BONE_MID, transition: 'color 300ms var(--ease-house)' }}>
          {on ? `${firstName} is in your close friends` : 'Add to close friends'}
        </span>
        <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '4px' }}>
          your private circle · only you see it
        </span>
      </span>
      {busy
        ? <Loader2 size={15} color={SILVER} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        : <span style={{ flexShrink: 0, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', color: on ? BONE : FAINT }}>{on ? 'in' : 'add'}</span>}
    </button>
  )
}

/* ── piezas compartidas ── */

function NoteField({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={400}
      aria-label="Add a note" placeholder={placeholder}
      style={{
        width: '100%', padding: '13px 14px', borderRadius: '12px',
        background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR_HI}`,
        color: BONE, fontFamily: FONT_SANS, fontSize: '14px', lineHeight: 1.5, resize: 'none',
        transition: 'border-color 200ms var(--ease-house)',
      }}
      onFocus={(e) => { e.target.style.borderColor = 'rgba(var(--ink-rgb),.34)' }}
      onBlur={(e) => { e.target.style.borderColor = HAIR_HI }}
    />
  )
}

function SendButton({ onClick, busy, disabled, label }) {
  const off = busy || disabled
  return (
    <button onClick={onClick} disabled={off} className="pressable" data-testid="connect-send"
      style={{
        width: '100%', marginTop: '16px', padding: '15px', borderRadius: '12px',
        background: off ? 'rgba(var(--ink-rgb),.10)' : BONE, border: 'none',
        color: off ? BONE_LOW : 'var(--bg)', cursor: off ? 'default' : 'pointer',
        fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '.18em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        transition: 'background 220ms var(--ease-house), color 220ms var(--ease-house)',
      }}>
      {busy && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
      {label}
      {!busy && !disabled && <ArrowRight size={14} />}
    </button>
  )
}

function StateNote({ tone, children }) {
  return (
    <div style={{
      fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.6, marginBottom: '16px',
      padding: '12px 14px', borderRadius: '11px',
      background: 'rgba(var(--ink-rgb),.04)', border: `1px solid ${HAIR}`,
      color: tone === 'hi' ? BONE : BONE_MID,
    }}>{children}</div>
  )
}

function ErrLine({ msg }) {
  return <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: 'var(--warn)', letterSpacing: '.06em', marginTop: '11px', textAlign: 'center' }}>{msg}</div>
}

/* La ceremonia — el único momento de recompensa. La marca se dibuja, la
   línea la nombra. Se usa igual para el envío y para el toggle del círculo. */
function DoneCeremony({ kind, firstName }) {
  const line = kind === 'sent' ? 'sent — opening the conversation'
    : kind === 'close-on' ? `${firstName} is in your close friends`
    : `removed from close friends`
  return (
    <div style={{ padding: '30px 4px 18px', textAlign: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '46px', height: '46px', borderRadius: '50%', border: `1px solid ${HAIR_HI}`, background: 'rgba(var(--ink-rgb),.05)' }}>
        <Check size={20} color={SILVER} />
      </span>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_MID, letterSpacing: '.18em', textTransform: 'uppercase', marginTop: '15px' }}>
        {line}
      </div>
    </div>
  )
}
