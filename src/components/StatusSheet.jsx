import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Check, RotateCw } from 'lucide-react'
import GlassSheet from './GlassSheet'
import Mark from './Mark'
import { StateChip } from './Chip'
import { useWide } from '@/lib/useIsDesktop'
import { fetchMyStatus, metricValue, PENDING_METRICS } from '@/lib/tiers'
import { BONE, BONE_MID, BONE_LOW, FAINT, SILVER, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS } from '@/lib/cosmos'

/* =========================================================================
   STATUS — WHERE YOU STAND (v14 · entry & identity).

   The five rungs, the one you're on, and the exact rows that would move you
   to the next. The doctrine lives in src/lib/tiers.js and is worth reading
   before touching this file; what follows is only how it is DRAWN.

   ─── THE DESIGN PROBLEM, STATED HONESTLY ─────────────────────────────────
   The most active real human here has 6 follows, 2 connections, 8 messages
   and ZERO posts. Most real members are at or near nothing. So the design
   brief was not "make progress look exciting" — it was:

       THIS SCREEN MUST BE DIGNIFIED AT ZERO.

   Everything below follows from that one sentence:

   · RUNG ONE IS A RUNG, NOT A FAILURE. A member at literally zero opens
     this and reads "01 ARRIVED — you're in. A world exists under your name,
     and nothing else is asked of rung one." They are STANDING somewhere,
     with a marked position on a five-step ladder. There is no empty state
     on this screen because there is no empty position.
   · NO PERCENTAGE WITHOUT ITS ROWS. The meter never appears alone: the
     requirements it averages are printed directly under it with real
     current/target numbers, so the bar can be checked by hand. An aggregate
     you cannot audit is a mood, not a measurement.
   · AN UNMET REQUIREMENT ARRIVES WITH ITS NEXT MOVE. A 0 sits next to the
     action that feeds it, never alone. Same posture as the gate's error
     copy: never blame the person, always hand them the next step.
   · POSTS IS NEVER HIDDEN. Nobody on this platform has posted, ever.
     Dropping the metric to make the screen look fuller — or swapping in a
     livelier number — is precisely the fake fullness this product forbids.
     Precisely where it appears (the requirement rows only ever show the
     NEXT rung's bar, and posts first enters that bar at 03): it stands in
     the ladder's bars from the moment you open this, and it takes its own
     row, at 0, with its hint, as soon as it is part of the bar you are
     actually working toward.

   ─── LOADING IS NOT ZERO ─────────────────────────────────────────────────
   `record === null` means the counts have not landed; it renders a spinner
   and never a number. The crafts/tastes discipline the rest of the app
   already keeps (null = asking, [] = honestly empty). A screen that flashes
   "0 / 3" for 200ms and then corrects itself has told the person they are
   nothing, briefly, every single time they open it.

   And when a read fails, this shows NO RUNG AT ALL rather than one built
   from half the numbers. A partial tier is not approximately right — it is
   somebody else's number wearing your name.

   ─── MATERIAL ────────────────────────────────────────────────────────────
   GlassSheet is the shell (it portals to <body>, which is load-bearing —
   see its own header). NOTHING in here carries a second backdrop-filter:
   glassSurface() is already a backdrop root and a blur inside a blur
   re-blurs its parent into a grey patch (glass.js). Inner surfaces are
   gradients and hairlines only.

   NO CHROME ANYWHERE ON THIS SHEET. Ley 8 allows one chrome moment per
   VIEW, and this sheet is not a view — it opens over the museum, whose
   single chrome moment is the member's NAME. A chrome tier name here would
   be the second one on screen. Solid BONE Bebas, and the hierarchy is
   carried by size and air instead.

   FAINT APPEARS ON EXACTLY THREE THINGS AND NONE OF THEM ARE TEXT: the two
   aria-hidden catalog numerals and the ○ of an unmet requirement. index.css
   documents --cream-ghost at ~2:1 in BOTH registers, decorative only. Every
   real line here — kickers, targets, the line that tells you how to open a
   lock, the reason a metric can't be read — is BONE_LOW (4.6:1). That is
   the same correction Settings made to its <Pending/> badge, and it matters
   most in exactly the same place: the text explaining what is MISSING must
   never be the hardest text on the screen to read.

   NO EXTRA ENTRANCE MOTION. The sheet's own .sheet-up / .dialog-in is the
   movement; stacking a .rise procession inside something that opens this
   often would turn a glance into a performance. The meter's transition
   only fires on a value CHANGE — on mount it paints at its final width, so
   the number is right even if no animation ever runs (index.css:794-809,
   the identity bug: an animation that does not advance paints frame one).
   ========================================================================= */

/* Mirrors the <Pending/> badge in Settings.jsx (it isn't exported, and this
   is not worth a shared module for two callers). Same law behind it: a thing
   that does not work is LABELLED, never faked and never quietly dropped.
   BONE_LOW and not FAINT on purpose — the notice that something is missing
   must not be the least legible text on the screen. */
function Pending({ children = 'Needs backend' }) {
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.16em', textTransform: 'uppercase',
      color: BONE_LOW, border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '4px 9px',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>◇ {children}</span>
  )
}

/* THE LOCK IS A REAL AFFORDANCE, NOT A DIMMED ROW.
   Lowering opacity says "this is less important"; a lock says "this is
   CLOSED, and there is a way in." The row keeps its requirement line right
   underneath precisely so the lock never reads as a wall — the same rule the
   invite gate obeys ("a wall says go away; a door says you are almost
   there"). Gradient + hairline, never a nested blur.

   ⚠ THIS LABEL IS A PROMISE ABOUT THE LINE BELOW IT, so LadderRow is
   obliged to print the FULL merged bar on a locked row. Read the comment
   there before changing either one — they only stay true together. */
function LockChip() {
  return (
    <span role="img" aria-label="Locked" title="Locked — the line below is the whole bar that opens it"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'linear-gradient(180deg, rgba(var(--ink-rgb),.10), rgba(var(--ink-rgb),.03))',
        border: `1px solid ${HAIR_HI}`, color: BONE_LOW,
      }}>
      <Lock size={9} strokeWidth={1.8} />
    </span>
  )
}

/* one requirement: the mark says met/unmet, the numbers say by how much,
   and an unmet row carries the action that feeds it. */
function RequirementRow({ req, last }) {
  return (
    <div data-testid={`status-req-${req.key}`}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '11px',
        padding: '11px 2px', borderBottom: last ? 'none' : `1px solid ${HAIR}`,
      }}>
      <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: '3px' }}>
        {/* ● cumplido · ○ pendiente — la misma primitiva en dos estados, que
            es como la casa dibuja "encendido" en todos lados (closeStarStyle
            hace exactamente esto con la estrella) */}
        <Mark type={req.met ? 'dot' : 'ring'} size={9} color={req.met ? SILVER : FAINT} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontFamily: FONT_SANS, fontSize: '13px', color: req.met ? BONE_MID : BONE, lineHeight: 1.3 }}>
            {req.label}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: '10.5px', letterSpacing: '.06em', color: req.met ? SILVER : BONE_MID, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {metricValue(req.key, req.current)}
            <span style={{ color: BONE_LOW }}> / {metricValue(req.key, req.target)}</span>
          </span>
        </span>
        {!req.met && (
          <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.08em', color: BONE_LOW, marginTop: '6px', lineHeight: 1.6 }}>
            {req.unknown ? "couldn't read this one" : req.hint}
          </span>
        )}
      </span>
    </div>
  )
}

/* one rung. Catalog numbering (01…05), the house mark, the name, the state,
   and the line that rung costs.

   ─── WHY LOCKED ROWS CARRY A DIFFERENT LINE ──────────────────────────────
   A locked row prints the FULL merged bar; a passed or current row prints
   only what that rung adds. That asymmetry is a correctness fix, not a
   flourish.

   Caught in review: the lock says "the line below is the whole bar that
   opens it", and for rungs 04 and 05 the short line is NOT the whole bar.
   stepLine(4) reads "40 messages · 6 connections · 6 on your walls", while
   the bar computeStatus actually tests for FIXED STAR is "1 craft · world
   90% · 8 followed · 40 messages · 6 connections · 6 on your walls". A
   member standing at ARRIVED could do exactly the three things printed,
   move nothing, and have been told by this screen that they would.

   The full bar used to live in the row's `title` attribute, which is the
   worst possible hiding place for it: hover does not exist on the 430px
   phone this app is built around, and a `title` on a listitem is announced
   by a screen reader as the row's own label — so the people least able to
   check the claim were the ones being handed it. The attribute is gone; the
   truth is on the row, at 8.5px, wrapping if it must. A long true line beats
   a short false one.

   Passed and current rows keep the short line on purpose: neither makes a
   claim about what would open anything, the bar you are working toward is
   printed in full with real numbers in the section above, and five rows of
   six clauses would be a wall instead of a ladder. */
function LadderRow({ tier, last, wide }) {
  const locked = tier.state === 'locked'
  const current = tier.state === 'current'
  const markColor = current ? BONE : locked ? BONE_LOW : SILVER
  const line = locked ? tier.fullBar : tier.summary
  return (
    <li role="listitem" data-testid={`status-rung-${tier.key}`} data-state={tier.state}
      aria-current={current ? 'step' : undefined}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '11px',
        padding: '13px 2px', borderBottom: last ? 'none' : `1px solid ${HAIR}`,
      }}>
      <span aria-hidden style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.1em', color: FAINT, width: '17px', flexShrink: 0, marginTop: '5px' }}>
        {String(tier.index + 1).padStart(2, '0')}
      </span>
      <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: '3px' }}>
        <Mark type={tier.mark} size={14} color={markColor} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', rowGap: '5px' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: wide ? '21px' : '19px', letterSpacing: '.04em', lineHeight: 1, color: current ? BONE : locked ? BONE_LOW : BONE_MID }}>
            {tier.name}
          </span>
          {current && <StateChip label="you" tone={BONE} style={{ borderColor: 'rgba(var(--ink-rgb),.34)' }} />}
          {tier.state === 'passed' && (
            <span role="img" aria-label="Reached" style={{ display: 'inline-flex', color: SILVER }}><Check size={12} strokeWidth={2} /></span>
          )}
          {locked && <LockChip />}
        </span>
        <span data-testid={`status-rung-line-${tier.key}`}
          style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.08em', color: BONE_LOW, marginTop: '6px', lineHeight: 1.6 }}>
          {line}
        </span>
      </span>
    </li>
  )
}

/* =========================================================================
   PROPS
     profileId  — the VIEWER'S OWN id (profiles.id === auth.users.id). This
                  sheet reads one record and it must be the caller's; tiers.js
                  refuses the read outright if the session says otherwise,
                  because my_circle() always answers for the caller and a
                  mismatched id would silently blend two people's records.
     onClose    — required, GlassSheet's contract.
     preloaded  — optional fetchMyStatus() result, if a parent (the identity
                  card) already paid for it. Skips the round trip; the sheet
                  is fully self-sufficient without it.
     wide       — optional override of useWide().
   ========================================================================= */
export default function StatusSheet({ profileId, onClose, preloaded = null, wide }) {
  const autoWide = useWide()
  const isWide = wide ?? autoWide

  // null = todavía preguntando. NUNCA se confunde con "cargó y da cero":
  // esa distinción es la razón por la que este componente no pinta un solo
  // número hasta tener el registro completo.
  const [record, setRecord] = useState(preloaded)
  const [attempt, setAttempt] = useState(0)

  /* `attempt === 0` is load-bearing, not a guard clause.

     Caught in self-review: with a bare `if (preloaded)` the parent's record
     short-circuits the effect FOREVER, so when that record is a failed read
     the error state renders a Try-again button that quietly does nothing —
     a dead promise, which is the one thing Ley 9 forbids outright. The
     preload is therefore honoured only on the FIRST pass; every retry falls
     through to a real fetch. The button always means what it says, and the
     sheet no longer depends on the caller remembering to pass only healthy
     records. */
  useEffect(() => {
    if (preloaded && attempt === 0) { setRecord(preloaded); return undefined }
    let alive = true
    setRecord(null)
    fetchMyStatus(profileId)
      .then((r) => { if (alive) setRecord(r) })
      // fetchMyStatus already resolves honestly instead of throwing; this is
      // the belt: an unexpected throw must land on the error state, never on
      // a spinner that spins forever.
      .catch(() => { if (alive) setRecord({ ok: false, counts: {}, unreadable: ['unknown'], status: null }) })
    return () => { alive = false }
  }, [profileId, preloaded, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  /* El kicker viaja como STRING, no como JSX: los espacios finos van como
     U+00A0 literales. Dos espacios normales colapsan a uno en HTML, y una
     entidad &nbsp; escrita dentro de un ATRIBUTO depende de que el
     transform decodifique entidades — una apuesta que no hace falta hacer.
     (En texto JSX suelto sí se decodifica, y por eso los ◇ de abajo la
     usan sin problema.) */
  return (
    <GlassSheet title="WHERE YOU STAND" kicker={'◇  The ladder'} onClose={onClose} wide={isWide} maxWidth="470px">
      <div data-testid="status-sheet" style={{ padding: '2px 10px 6px' }}>
        {record === null ? (
          <div data-testid="status-loading" style={{ display: 'flex', justifyContent: 'center', padding: '54px 0' }}>
            <Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : !record.ok || !record.status ? (
          <ErrorState identity={record.unreadable?.includes('identity')} onRetry={retry} />
        ) : (
          <Standing status={record.status} wide={isWide} />
        )}
      </div>
    </GlassSheet>
  )
}

/* The refusal. Ley 9: a surface that cannot keep its promise says so and
   offers the next move — it does not render a plausible-looking rung.

   ─── THE RETRY IS ON BOTH BRANCHES NOW, AND THAT IS THE FIX ──────────────
   It used to be hidden whenever the failure was 'identity', which made that
   branch a dead end: read the sentence, close the sheet, that's it. Worse,
   'identity' was also where a session that could not be READ landed — and
   auth-js answers { session: null, error } on any failed token refresh, so
   one backgrounded phone or one auth 5xx was enough to tell a genuinely
   signed-in member that they were somebody else and hand them no way back.

   tiers.js now separates the two ('session' = unread, 'identity' = read and
   it isn't you), so the copy can be accurate. The button stays on both
   because in both cases it does a real thing: `retry()` bumps `attempt`,
   the effect re-runs and the session is read again. After you sign in on
   another tab, or after the network returns, that is precisely the move.
   A button that re-asks a question whose answer may have changed is not a
   dead promise; hiding it was. */
function ErrorState({ identity, onRetry }) {
  return (
    <div data-testid="status-error" role="alert" style={{ padding: '40px 14px 30px', textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_SANS, fontSize: '13.5px', color: BONE_MID, lineHeight: 1.65, margin: '0 auto', maxWidth: '34ch' }}>
        {identity
          ? 'This only ever reads your own record, and the session on this device isn’t signed in as you. Sign in again, then try once more.'
          : 'Couldn’t read your record just now. Rather than build a rung out of half the numbers, it shows you none.'}
      </p>
      <button type="button" className="pressable" onClick={onRetry}
        style={{
          marginTop: '20px', background: 'rgba(var(--ink-rgb),.05)', border: `1px solid ${HAIR_HI}`,
          borderRadius: '100px', padding: '9px 20px', color: BONE, fontFamily: FONT_SANS, fontSize: '11.5px',
          letterSpacing: '.03em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px',
        }}>
        <RotateCw size={12} /> Try again
      </button>
    </div>
  )
}

function Standing({ status, wide }) {
  const { tier, nextTier, progress, requirements, ladder } = status
  const pct = Math.round(progress * 100)

  return (
    <>
      {/* ── 01 · WHERE YOU ARE ─────────────────────────────────────────────
          The answer comes first and it is the biggest thing on the sheet.
          Solid BONE Bebas — no chrome (see the header). */}
      <section style={{ padding: '14px 2px 20px', borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.26em', textTransform: 'uppercase', color: BONE_LOW }}>
          You are at
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginTop: '11px' }}>
          <span aria-hidden style={{ fontFamily: FONT_MONO, fontSize: '11px', letterSpacing: '.1em', color: FAINT }}>
            {String(tier.index + 1).padStart(2, '0')}
          </span>
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>
            <Mark type={tier.mark} size={wide ? 20 : 18} color={BONE} />
          </span>
          <h3 data-testid="status-tier" style={{
            fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: wide ? '40px' : '34px',
            letterSpacing: '.02em', lineHeight: 0.92, margin: 0, color: BONE,
          }}>
            {tier.name}
          </h3>
        </div>
        <p style={{ fontFamily: FONT_SANS, fontSize: wide ? '13.5px' : '13px', color: BONE_MID, lineHeight: 1.65, margin: '13px 0 0', maxWidth: '40ch', textWrap: 'balance' }}>
          {tier.line}
        </p>
      </section>

      {/* ── 02 · THE BAR ───────────────────────────────────────────────────
          El medidor NUNCA va solo: debajo van exactamente las filas que
          promedia, con sus números reales. Un porcentaje que no se puede
          verificar a mano es un estado de ánimo, no un dato. */}
      <section style={{ padding: '20px 2px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.24em', textTransform: 'uppercase', color: BONE_LOW }}>
            {nextTier ? `Toward ${nextTier.name}` : 'The bar you hold'}
          </span>
          {nextTier && (
            <span style={{ fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.1em', color: BONE_MID }}>{pct}%</span>
          )}
        </div>

        {nextTier && (
          /* 2px, no 1px: en el museo este medidor es una nota al margen y ahí
             el pelo basta; aquí es el elemento central de la pantalla. Sigue
             siendo una línea, no una barra de videojuego. La transición sólo
             corre si el valor CAMBIA — al montar pinta ya en su ancho final,
             así que el número es correcto aunque la animación nunca ocurra. */
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            aria-label={`Progress toward ${nextTier.name}`} data-testid="status-progress"
            style={{ height: '2px', background: HAIR, position: 'relative', overflow: 'hidden', marginTop: '9px' }}>
            <div style={{
              position: 'absolute', inset: 0, transformOrigin: 'left',
              transform: `scaleX(${Math.max(0, Math.min(1, progress))})`,
              background: SILVER, opacity: 0.7,
              transition: 'transform .5s var(--ease-house)',
            }} />
          </div>
        )}

        {!nextTier && (
          <p style={{ fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_MID, lineHeight: 1.65, margin: '10px 0 2px', maxWidth: '40ch' }}>
            Top of the ladder. There is nothing above this — only keeping it, which is the whole idea.
          </p>
        )}

        <div style={{ marginTop: nextTier ? '12px' : '8px' }}>
          {requirements.map((r, i) => (
            <RequirementRow key={r.key} req={r} last={i === requirements.length - 1} />
          ))}
        </div>
      </section>

      {/* ── 03 · THE FIVE ─────────────────────────────────────────────────── */}
      <section style={{ padding: '24px 2px 4px' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.26em', textTransform: 'uppercase', color: BONE_LOW, marginBottom: '4px' }}>
          ◇&nbsp;&nbsp;The five
        </div>
        <ol role="list" aria-label="The five rungs" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {ladder.map((t, i) => (
            <LadderRow key={t.key} tier={t} wide={wide} last={i === ladder.length - 1} />
          ))}
        </ol>
      </section>

      {/* ── 04 · HOW THIS IS COUNTED ───────────────────────────────────────
          La ley, escrita en el producto y no sólo en el código. Si la
          plataforma dice que la honestidad se impone en código, la persona
          tiene derecho a leer cómo se contó su propio número. */}
      <section style={{ marginTop: '22px', paddingTop: '16px', borderTop: `1px solid ${HAIR}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.26em', textTransform: 'uppercase', color: BONE_LOW }}>
          ◇&nbsp;&nbsp;How this is counted
        </div>
        <p style={{ fontFamily: FONT_SANS, fontSize: '11.5px', color: BONE_LOW, lineHeight: 1.75, margin: '9px 0 0', maxWidth: '48ch' }}>
          Your rung is worked out from your own rows every time you open this. It is never stored, never granted and never handed to anyone — including us. Follows and connections to seed worlds count for nothing.
        </p>
        <p style={{ fontFamily: FONT_SANS, fontSize: '11.5px', color: BONE_LOW, lineHeight: 1.75, margin: '9px 0 0', maxWidth: '48ch' }}>
          No ranking, no percentile, nobody else’s numbers. Only your own record.
        </p>
      </section>

      {/* ── 05 · WHAT ISN'T COUNTED YET ────────────────────────────────────
          Se dice, no se finge y no se calla. La ley de Settings: un dato que
          no funciona se ROTULA — el que no existe no promete nada, el que
          miente sí. "0 días activo" para alguien que lleva seis sería una
          mentira igual de grave que inflar el número. */}
      {PENDING_METRICS.map((m) => (
        <div key={m.key} data-testid={`status-pending-${m.key}`}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginTop: '18px', paddingTop: '14px', borderTop: `1px solid ${HAIR}` }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_MID, lineHeight: 1.3 }}>
              {m.label}
            </span>
            <span style={{ display: 'block', fontFamily: FONT_MONO, fontSize: '8.5px', letterSpacing: '.08em', color: BONE_LOW, marginTop: '6px', lineHeight: 1.6 }}>
              {m.why} · needs {m.needs}
            </span>
          </span>
          <Pending>Not readable</Pending>
        </div>
      ))}
    </>
  )
}
