import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { VOID, BONE, BONE_MID, BONE_LOW, FAINT, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText } from '@/lib/cosmos'

/* =========================================================================
   LEGAL — Terms, Privacy, and Refunds. Standalone cosmos pages (rendered
   OUTSIDE Layout, like /auth and /claim): anon-reachable always, linkable
   from the checkout, the footer, and the ticket email.

   Plain language on purpose — honest, no false promises, correct for
   selling event tickets as a Texas LLC. Not legalese, not legal advice;
   the operating truth of how the platform and the events actually work.
   Content is the same tokens/voice as the rest of the universe.
   ========================================================================= */

// Real company facts (canon). CONTACT is the founders' active mailbox — swap
// to a domain address when one exists (flagged in the build handback).
const COMPANY = 'THE COLLECTIV4 LLC'
const CONTACT = 'thecollectiv4@gmail.com'
const UPDATED = 'July 14, 2026'

const NAV = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refunds', label: 'Refunds' },
]

function LegalShell({ title, kicker, children }) {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(120% 80% at 50% -10%, rgba(242,238,230,.045) 0%, rgba(242,238,230,0) 55%), ${VOID}`, color: BONE }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 24px 64px' }}>
        {/* out is always visible — never trapped */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', textDecoration: 'none', marginBottom: '30px' }}>
          <ArrowLeft size={13} /> The Collectiv4
        </Link>

        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: '10px' }}>{kicker}</div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(40px, 9vw, 60px)', lineHeight: .9, margin: 0, ...chromeText }}>{title}</h1>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.18em', textTransform: 'uppercase', marginTop: '14px' }}>Updated {UPDATED} · {COMPANY} · Houston, Texas</div>

        <div style={{ height: '1px', background: HAIR_HI, margin: '26px 0 30px' }} />

        <div style={{ fontFamily: FONT_SANS, fontSize: '15px', lineHeight: 1.72, color: BONE_MID }}>
          {children}
        </div>

        {/* cross-links + contact */}
        <div style={{ marginTop: '44px', paddingTop: '22px', borderTop: `1px solid ${HAIR}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
          {NAV.map(n => (
            <Link key={n.to} to={n.to} style={{ fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.14em', textTransform: 'uppercase', color: pathname === n.to ? BONE : BONE_LOW, textDecoration: 'none' }}>{n.label}</Link>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.1em' }}>
            Questions? <a href={`mailto:${CONTACT}`} style={{ color: BONE_LOW, textDecoration: 'underline' }}>{CONTACT}</a>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---- one section renderer so the three pages read the same ---- */
function Section({ h, children }) {
  return (
    <section style={{ marginBottom: '26px' }}>
      {h && <h2 style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE, letterSpacing: '.18em', textTransform: 'uppercase', margin: '0 0 12px' }}>{h}</h2>}
      {children}
    </section>
  )
}
const P = ({ children }) => <p style={{ margin: '0 0 12px' }}>{children}</p>
const Em = ({ children }) => <strong style={{ color: BONE, fontWeight: 600 }}>{children}</strong>

/* ============================ TERMS ============================ */
export function Terms() {
  return (
    <LegalShell kicker="◇ The Collectiv4 · Legal" title="TERMS OF SERVICE">
      <P>These terms cover your use of The Collectiv4 — our platform (profiles, discovery, messages, and ticketing) and the live events we run under Ran By Artists. The platform and the events are operated by {COMPANY}, a Texas limited liability company based in Houston. By using the platform or buying a ticket, you agree to these terms. We've written them in plain language, not legalese.</P>

      <Section h="Your account">
        <P>You need an account to build a profile, message, or buy a ticket. Use real information, keep your login to yourself, and you're responsible for what happens under your account. You must be old enough to enter into a contract where you live (at least 13 to use the platform; some events set a higher age at the door).</P>
      </Section>

      <Section h="Tickets & entry">
        <P>When you buy a ticket, you're buying a <Em>license to attend that event</Em> — not a transferable asset or a right to any specific lineup, set time, or experience. Details like lineup, set times, and running order can change; if something material changes, we'll do our best to let you know.</P>
        <P>Entry is subject to the venue's and the event's rules. We may refuse entry or remove anyone for safety, for breaking venue rules, or for behavior that harms others — without a refund in those cases. You may be asked for ID and to meet a minimum age. Live events carry inherent risks (crowds, sound, movement); by attending, you accept those ordinary risks.</P>
        <P>If we cancel an event, you're covered by our <Em>Refund Policy</Em>. If we reschedule, your ticket carries to the new date.</P>
      </Section>

      <Section h="Payments">
        <P>Ticket payments are processed by <Em>Stripe</Em>. We don't see or store your full card number. Prices are shown in U.S. dollars and charged at checkout; your bank may add its own fees. Your purchase is also subject to Stripe's terms.</P>
      </Section>

      <Section h="What you post">
        <P>Your profile, your world, your work, and your messages stay <Em>yours</Em>. By posting them, you give us permission to store and display them on the platform so the room can find you. Don't post anything illegal, hateful, deceptive, infringing, or that isn't yours to share. We can remove content or close accounts that break these terms or put others at risk.</P>
      </Section>

      <Section h="The platform is provided “as is”">
        <P>We're a small team building something real, and we're honest about it: the platform is offered as it is, without warranties. We don't promise it will always be available, error-free, or fit a particular purpose. We're not responsible for the conduct of other members or for what happens between people who meet here.</P>
      </Section>

      <Section h="Limits">
        <P>To the extent the law allows, {COMPANY} isn't liable for indirect or incidental damages, and our total liability to you for anything connected to a ticket or the platform is limited to the amount you actually paid us for the ticket in question. Nothing here removes rights you have that can't be waived under Texas or U.S. law.</P>
      </Section>

      <Section h="Changes, law & contact">
        <P>We may update these terms as the platform grows; the “Updated” date above changes when we do, and continuing to use the platform means you accept the current version. These terms are governed by the laws of the State of Texas. Reach us any time at <a href={`mailto:${CONTACT}`} style={{ color: BONE, textDecoration: 'underline' }}>{CONTACT}</a>.</P>
      </Section>
    </LegalShell>
  )
}

/* ============================ PRIVACY ============================ */
export function Privacy() {
  return (
    <LegalShell kicker="◇ The Collectiv4 · Legal" title="PRIVACY POLICY">
      <P>This explains what we collect, why, and who helps us run the platform. Short version: we collect what we need to give you a profile, sell you a ticket, and get you into the room — nothing we sell to anyone.</P>

      <Section h="What we collect">
        <P><Em>You give us:</Em> your name and email when you sign up, anything you add to your profile or world (bio, city, craft, images, links, messages), and your name/email when you buy a ticket.</P>
        <P><Em>Payments:</Em> when you buy a ticket, Stripe handles your card. We receive a confirmation and details like the amount and the last bit of the transaction — <Em>never your full card number</Em>.</P>
        <P><Em>Automatically:</Em> basic, mostly-aggregate usage data (like page views via Vercel Analytics) to understand what's working. We're not building a surveillance profile of you.</P>
      </Section>

      <Section h="How we use it">
        <P>To run your account and your world, to send you your ticket and important event information, to keep the platform safe and honest, and to make it better. That's it.</P>
      </Section>

      <Section h="Who we share it with">
        <P>Only the services that make the platform work, and only so they can do their job:</P>
        <P>· <Em>Supabase</Em> — database, accounts, and file storage.<br/>· <Em>Stripe</Em> — payments.<br/>· <Em>Resend</Em> — sending your ticket and event emails.<br/>· <Em>Vercel</Em> — hosting and basic analytics.</P>
        <P>We do <Em>not</Em> sell your personal information. We may share information if the law requires it, or to protect people's safety.</P>
      </Section>

      <Section h="Your choices">
        <P>You can edit or clear most of your profile any time. You can ask us to delete your account and personal data by emailing <a href={`mailto:${CONTACT}`} style={{ color: BONE, textDecoration: 'underline' }}>{CONTACT}</a> — we'll take care of it, keeping only what we're legally required to (for example, a record that a ticket sale happened). You can opt out of non-essential email; you'll still get transactional messages like your ticket.</P>
      </Section>

      <Section h="Security, cookies & kids">
        <P>We use reasonable measures to protect your data, but no online service is perfectly secure. We use minimal cookies/local storage to keep you signed in — not for third-party ad tracking. The platform isn't intended for children under 13.</P>
      </Section>

      <Section h="Contact">
        <P>Questions about your privacy? Write to <a href={`mailto:${CONTACT}`} style={{ color: BONE, textDecoration: 'underline' }}>{CONTACT}</a>. We'll answer like humans.</P>
      </Section>
    </LegalShell>
  )
}

/* ============================ REFUNDS ============================ */
export function Refunds() {
  return (
    <LegalShell kicker="◇ The Collectiv4 · Legal" title="REFUND POLICY">
      <P>Straight up: <Em>all ticket sales are final.</Em> We don't offer refunds or exchanges for change of plans, being unable to attend, or not enjoying an event — with the one exception below.</P>

      <Section h="If we cancel">
        <P>If we cancel an event outright, you get an <Em>automatic full refund</Em> of the ticket price to your original payment method. You don't have to ask.</P>
      </Section>

      <Section h="If we reschedule">
        <P>If we move an event to a new date, your ticket <Em>carries over automatically</Em> — same ticket, new date. If you can't make the new date, email us at <a href={`mailto:${CONTACT}`} style={{ color: BONE, textDecoration: 'underline' }}>{CONTACT}</a> and we'll work it out with you.</P>
      </Section>

      <Section h="Duplicate or accidental charges">
        <P>Charged twice, or something clearly went wrong at checkout? Email <a href={`mailto:${CONTACT}`} style={{ color: BONE, textDecoration: 'underline' }}>{CONTACT}</a> with your name and the email you used, and we'll review and fix genuine errors.</P>
      </Section>

      <Section h="How refunds are paid">
        <P>Refunds go back to the original payment method through Stripe, and usually take a few business days to appear depending on your bank.</P>
      </Section>

      <Section h="Why it works this way">
        <P>We're an independent team, and we commit real money to a room — venue, sound, artists, production — before a single door opens. A no-refund-except-cancellation policy is the standard for live events, and it's what lets us keep making them. We'd rather be honest about it up front than surprise you at the worst moment.</P>
      </Section>
    </LegalShell>
  )
}
