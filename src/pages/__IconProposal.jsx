import Mark from '@/components/Mark'
import {
  BONE, BONE_MID, BONE_LOW, FAINT, HAIR,
  FONT_DISPLAY, FONT_MONO, FONT_SANS,
} from '@/lib/cosmos'

/* =========================================================================
   /__icons — DEV-ONLY. The nav-icon PROPOSAL, side by side.

   This page changes nothing. The bottom nav still ships ✕ ○ ◇ ●. This is
   here so the decision gets made by looking, by both founders, instead of
   by an agent editing the brand while nobody is watching.

   Precedent for why it is a proposal and not a commit: VerifiedMark.jsx
   carries an explicit founder block — "DECISIÓN DE FUNDADOR, NO DE ESTILO
   … NO MERGEAR sin el visto bueno de Diego." The nav marks are the same
   class of decision.
   ========================================================================= */

const SLOTS = [
  {
    label: 'Event', route: '/',
    now: 'cross', proposed: 'marquee',
    why: '✕ means CLOSE everywhere else in this app — including the X that dismisses every modal. In the leftmost/home slot, the first glyph a new user sees currently reads "exit". The marquee is a poster: the room, announced.',
  },
  {
    label: 'Community', route: '/community',
    now: 'ring', proposed: 'people',
    why: '○ reads as an unselected radio button — a control, not a place. And this app already teaches ● = on / ○ = off in the OS board and the taste picker. Two circles meeting is the convention for people, and the overlap is literally "we are all one".',
  },
  {
    label: 'Messages', route: '/messages',
    now: 'diamond', proposed: 'bubble',
    why: '◇ has no messaging convention anywhere, and it is used ~20 times in this app as a decorative bullet — it cannot also be a proper noun. The bubble is the one glyph nobody has to learn.',
  },
  {
    label: 'Profile', route: '/profile',
    now: 'dot', proposed: 'world',
    why: '● and ○ are the same primitive at two radii — at 22px, through a thumb, Profile and Community are the same icon. A world in orbit says what a profile IS here: a personal museum, not a person icon.',
  },
]

const Cell = ({ children, w }) => (
  <div style={{ width: w, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>{children}</div>
)

const Label = ({ children }) => (
  <div style={{ fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.14em', textTransform: 'uppercase', color: FAINT }}>{children}</div>
)

export default function IconProposal() {
  return (
    <div style={{ minHeight: '100vh', background: 'transparent', position: 'relative', zIndex: 1, padding: '40px 24px 90px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.3em', textTransform: 'uppercase', color: BONE_LOW }}>
          ◇&nbsp;&nbsp;V12 · Proposal · not shipped
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 'clamp(32px,9vw,46px)', color: BONE, letterSpacing: '.02em', margin: '14px 0 0', lineHeight: 1 }}>
          THE FOUR WAYFINDING MARKS
        </h1>
        <p style={{ fontFamily: FONT_SANS, fontSize: '14px', lineHeight: 1.7, color: BONE_MID, marginTop: '16px', maxWidth: '62ch' }}>
          The nav still ships ✕ ○ ◇ ●. Nothing here is wired. The question is only whether
          the four tabs should keep marks the design system locked as <em>section markers</em>,
          or carry marks drawn in the same hand but shaped by function.
          <strong style={{ color: BONE }}> The CREATE + stays exactly as it is</strong> — it is already the one legible mark in the bar.
        </p>

        {/* the honest side-by-side, at the real nav size */}
        <div style={{ marginTop: '40px', border: `1px solid ${HAIR}`, borderRadius: '4px', overflow: 'hidden' }}>
          {SLOTS.map((s, i) => (
            <div key={s.label} style={{ padding: '22px 20px', borderTop: i ? `1px solid ${HAIR}` : 'none', display: 'flex', gap: '22px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                <Cell w="76px">
                  <Mark type={s.now} size={22} color={BONE} />
                  <Label>now</Label>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '7.5px', color: FAINT }}>{s.now}</div>
                </Cell>
                <div style={{ alignSelf: 'center', color: FAINT, fontFamily: FONT_MONO, fontSize: '11px', paddingBottom: '18px' }}>→</div>
                <Cell w="76px">
                  <Mark type={s.proposed} size={22} color={BONE} />
                  <Label>proposed</Label>
                  <div style={{ fontFamily: FONT_MONO, fontSize: '7.5px', color: FAINT }}>{s.proposed}</div>
                </Cell>
              </div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.2em', textTransform: 'uppercase', color: BONE }}>
                  {s.label} <span style={{ color: FAINT }}>· {s.route}</span>
                </div>
                <p style={{ fontFamily: FONT_SANS, fontSize: '13px', lineHeight: 1.62, color: BONE_MID, margin: '8px 0 0' }}>{s.why}</p>
              </div>
            </div>
          ))}
        </div>

        {/* legibility at the real production size range */}
        <div style={{ marginTop: '40px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.24em', textTransform: 'uppercase', color: BONE_LOW }}>Holds up across the shipped size range</div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '26px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {[8, 14, 17, 22, 27].map(sz => (
              <div key={sz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {SLOTS.map(s => <Mark key={s.label} type={s.proposed} size={sz} color={BONE} />)}
                </div>
                <Label>{sz}px</Label>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: FONT_SANS, fontSize: '12.5px', lineHeight: 1.6, color: FAINT, marginTop: '14px', maxWidth: '62ch' }}>
            8px is the smallest production use (museum + messages); 27px is the nav at 22px under
            the scrub scale(1.22). The marks have to survive both ends.
          </p>
        </div>

        {/* the separate bug — worth fixing whatever is decided here */}
        <div style={{ marginTop: '44px', padding: '20px', border: `1px solid ${HAIR}`, borderRadius: '4px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.24em', textTransform: 'uppercase', color: '#E5A0A0' }}>Separate finding · not a taste question</div>
          <p style={{ fontFamily: FONT_SANS, fontSize: '13px', lineHeight: 1.65, color: BONE_MID, margin: '10px 0 0' }}>
            <strong style={{ color: BONE }}>The active state is a silent no-op on three of four tabs.</strong> GlassNav
            passes <code style={{ fontFamily: FONT_MONO, fontSize: '12px', color: BONE }}>filled={'{'}active{'}'}</code>, but
            Mark only consumes <code style={{ fontFamily: FONT_MONO, fontSize: '12px', color: BONE }}>filled</code> for
            triangle, square and diamond. So Messages is the only tab whose icon changes shape when you are standing
            in it — every other tab signals "you are here" with a 0.42→1 opacity step alone. That is a weak signal on
            glass over void, and it is true of the marks shipping today. Worth fixing either way.
          </p>
        </div>

        <div style={{ marginTop: '36px', fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: FAINT, lineHeight: 1.9 }}>
          Untouched by this proposal: the C4 orbit seal (VerifiedMark) · the seed pill (SeedMark) ·
          the wordmark · every ● ○ ✕ △ ◇ used as a section marker, separator or bullet.<br />
          Two founders, one repo — this goes to Diego before it goes to main.
        </div>
      </div>
    </div>
  )
}
