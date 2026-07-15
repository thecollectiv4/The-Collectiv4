import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Lock, X, ArrowLeft, CalendarDays, MessagesSquare, Users, User, ListTodo, Clapperboard, Sparkles, UsersRound, UserX, Activity } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { useOSAccess } from '@/lib/osAccess'
import { useLiveEvent } from '@/lib/useLiveEvent'
import { useIsDesktop, useRailFull } from '@/lib/useIsDesktop'
import { VOID, VOID_2, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, PANEL, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, FALL_001_ISO, daysUntil, relTime, COLUMN_LABEL, safeImg } from '@/lib/cosmos'
import Board from '@/components/os/Board'
import ContentEngine from '@/components/os/ContentEngine'
import Brain from '@/components/os/Brain'
import RoadmapStrip from '@/components/os/RoadmapStrip'
import EventsAdmin from '@/components/os/Events'
import Network from '@/components/os/Network'
import Moderation from '@/components/os/Moderation'
import Cohorts from '@/components/os/Cohorts'
import { DropButton, DropsFeed } from '@/components/os/Drops'

/* =========================================================================
   TEAM OS — the deck become an app. Fluid work surface: the instrument shell
   (persistent left rail + full-bleed main, deck language — catalog kickers,
   panel clusters, chrome only on display type) from 768px up; the rail
   collapses to icon-only below 1180px; the phone pattern below 768px.

   OS() is the thin gate + data container; OSInstrument is the whole layout
   as one presentational component (also mounted by the DEV harness with
   mirror data — keep it free of supabase calls).
   ========================================================================= */

const nowISO = () => new Date().toISOString()
// Every tab carries a SEMANTIC icon at a dignified size + its word (Leyes 5 y
// 14: an icon that needs explaining isn't design; the icon matches what the
// thing IS). The deck marks stay as the catalog glyph in the header kicker.
// `tint` is the section's light temperature — same locked palette, different
// warmth: instrument work reads cool silver, making reads warm bone, the
// Brain reads starlight. Void and bone never move (Ley 14).
const TABS = [
  { key: 'board', code: '01', label: 'Board', short: 'Board', mark: '●', icon: ListTodo, tint: '199,201,209' },
  { key: 'content', code: '02', label: 'Content', short: 'Content', mark: '○', icon: Clapperboard, tint: '242,238,230' },
  { key: 'brain', code: '03', label: 'The Brain', short: 'Brain', mark: '◇', icon: Sparkles, tint: '232,233,237' },
  { key: 'events', code: '04', label: 'Events', short: 'Events', mark: '✕', icon: CalendarDays, tint: '242,238,230' },
]
// Founders only — appended to TABS when the server's my_os_identity() says
// owner. Display-gating: the admin_* RPCs re-check is_owner() on every call.
const NETWORK_TAB = { key: 'network', code: '05', label: 'Network', short: 'Network', mark: '△', icon: UsersRound, tint: '199,201,209' }
// v7 — founders-only surfaces (same server gate as Network/DROPS): the bot
// cleanup (D2) and the retention number (D4).
const MODERATION_TAB = { key: 'moderation', code: '06', label: 'Moderation', short: 'Clean', mark: '✕', icon: UserX, tint: '199,201,209' }
const COHORTS_TAB = { key: 'cohorts', code: '07', label: 'Retention', short: 'Retention', mark: '△', icon: Activity, tint: '232,233,237' }
const HELLO_KEY = 'os_hello_v1'
// Cross-nav out of the OS — same icon vocabulary as Layout.jsx's bottom nav.
const CROSS_NAV = [
  { to: '/', icon: CalendarDays, label: 'Event' },
  { to: '/community', icon: Users, label: 'Community' },
  { to: '/messages', icon: MessagesSquare, label: 'Messages' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function OS() {
  const navigate = useNavigate()
  const { state, profile, owner } = useOSAccess()
  const [tasks, setTasks] = useState([])
  const [content, setContent] = useState([])
  const [activity, setActivity] = useState([])
  const [owners, setOwners] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [brainMsgs, setBrainMsgs] = useState([])
  const [drops, setDrops] = useState([])
  const noticeTimer = useRef(null)

  const say = useCallback((msg) => { setNotice(msg); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 5000) }, [])

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase.from('os_tasks').select('*').order('created_at', { ascending: true })
    if (!error) setTasks(data || []); return error
  }, [])
  const loadContent = useCallback(async () => {
    const { data, error } = await supabase.from('os_content').select('*').order('created_at', { ascending: true })
    if (!error) setContent(data || []); return error
  }, [])
  const loadActivity = useCallback(async () => {
    const { data } = await supabase.from('os_activity').select('*').order('created_at', { ascending: false }).limit(30)
    setActivity(data || [])
  }, [])
  // DROPS — the team's feedback, FOUNDERS ONLY (RLS returns rows only to
  // owners; 0019). A non-owner member gets [] and never sees the feed.
  const loadDrops = useCallback(async () => {
    const { data } = await supabase.from('drops').select('*').order('created_at', { ascending: false }).limit(30)
    setDrops(data || [])
  }, [])
  // Any network member may submit; only the founders read it back.
  const submitDrop = useCallback(async (body, context) => {
    const { data, error } = await supabase.rpc('submit_drop', { p_body: body, p_context: context || {} })
    if (error) return { ok: false, error: error.message }
    if (data?.ok && owner) loadDrops()
    return data || { ok: false }
  }, [owner, loadDrops])
  const refreshAll = useCallback(() => { loadTasks(); loadContent(); loadActivity() }, [loadTasks, loadContent, loadActivity])

  useEffect(() => {
    if (state !== 'granted') return
    let alive = true
    ;(async () => {
      setLoadErr('')
      // real people only (v8 C): the board assigns work to the TEAM — 112
      // seed personas must never appear in an owner menu
      const { data: profs, error: pErr } = await supabase.from('profiles').select('id,full_name,username,avatar_url,verified').eq('is_demo', false)
      const [tErr, cErr] = await Promise.all([loadTasks(), loadContent(), loadActivity()])
      if (!alive) return
      if (pErr || tErr || cErr) { setLoadErr((pErr || tErr || cErr).message || 'could not reach the board'); return }
      const map = {}; (profs || []).forEach(p => { map[p.id] = p }); setOwners(map)
      setLoaded(true)
    })()
    return () => { alive = false }
  }, [state, reload, loadTasks, loadContent, loadActivity])

  // founders-only DROPS feed — loads only on the server's owner verdict
  useEffect(() => {
    if (state !== 'granted' || !owner) return
    loadDrops()
  }, [state, owner, reload, loadDrops])

  const log = useCallback(async (action) => {
    await supabase.from('os_activity').insert({ profile_id: profile?.id ?? null, action }); loadActivity()
  }, [profile, loadActivity])

  /* --- mutators: optimistic where it matters, rollbacks target ONLY the row
     they touched (a failed move must never revert someone else's change),
     and no post-success refetch races the optimistic state. --- */
  const createTask = async (f) => {
    const { error } = await supabase.from('os_tasks').insert({ ...f, owner_profile_id: profile?.id ?? null })
    if (error) { say(`couldn't save — ${error.message}`); return false }
    await loadTasks(); log(`added “${f.title}”`)
    return true
  }
  const updateTask = async (id, f) => {
    const before = tasks.find(t => t.id === id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...f } : t))
    const { error } = await supabase.from('os_tasks').update({ ...f, updated_at: nowISO() }).eq('id', id)
    if (error) { if (before) setTasks(ts => ts.map(t => t.id === id ? before : t)); say(`couldn't save — ${error.message}`); return false }
    log(`edited “${f.title || before?.title || 'task'}”`)
    return true
  }
  const moveTaskTo = async (task, colKey) => {
    if (task.board_column === colKey) return true
    const from = task.board_column
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, board_column: colKey } : t))
    const { error } = await supabase.from('os_tasks').update({ board_column: colKey, updated_at: nowISO() }).eq('id', task.id)
    if (error) { setTasks(ts => ts.map(t => t.id === task.id ? { ...t, board_column: from } : t)); say(`couldn't move — ${error.message}`); return false }
    log(`moved “${task.title}” → ${COLUMN_LABEL[colKey]}`)
    return true
  }
  const deleteTask = async (task) => {
    setTasks(ts => ts.filter(t => t.id !== task.id))
    const { error } = await supabase.from('os_tasks').delete().eq('id', task.id)
    if (error) { setTasks(ts => [...ts, task]); say(`couldn't delete — ${error.message}`); return false }
    log(`removed “${task.title}”`)
    return true
  }
  const createContent = async (f) => {
    const { error } = await supabase.from('os_content').insert({ ...f, owner_profile_id: f.owner_profile_id ?? profile?.id ?? null })
    if (error) { say(`couldn't save — ${error.message}`); return false }
    await loadContent(); log(`new content “${f.title}”`)
    return true
  }
  const updateContent = async (id, f) => {
    const before = content.find(c => c.id === id)
    setContent(cs => cs.map(c => c.id === id ? { ...c, ...f } : c))
    const { error } = await supabase.from('os_content').update({ ...f, updated_at: nowISO() }).eq('id', id)
    if (error) { if (before) setContent(cs => cs.map(c => c.id === id ? before : c)); say(`couldn't save — ${error.message}`); return false }
    const keys = Object.keys(f)
    if (keys.length === 1 && keys[0] === 'status') log(`“${before?.title || 'content'}” → ${f.status}`)
    else log(`edited content “${f.title || before?.title || 'content'}”`)
    return true
  }
  const deleteContent = async (c) => {
    setContent(cs => cs.filter(x => x.id !== c.id))
    const { error } = await supabase.from('os_content').delete().eq('id', c.id)
    if (error) { setContent(cs => [...cs, c]); say(`couldn't delete — ${error.message}`); return false }
    log(`removed content “${c.title}”`)
    return true
  }

  /* ------------------------------- gates ------------------------------- */
  if (state === 'loading' || (state === 'granted' && !loaded && !loadErr)) return <Shell center><Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></Shell>
  if (state === 'denied') return (
    <Shell center>
      <div style={{ textAlign: 'center', maxWidth: '300px' }}>
        <Lock size={24} style={{ color: BONE_LOW, display: 'block', margin: '0 auto' }} />
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '14px' }}>Our network only</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.04em', marginTop: '10px', lineHeight: 1.6 }}>The Team OS is the internal hub for verified members of The Collectiv4.</div>
        <button onClick={() => navigate('/community')} style={{ marginTop: '18px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 18px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>← Community</button>
      </div>
    </Shell>
  )
  if (loadErr) return (
    <Shell center>
      <div style={{ textAlign: 'center', maxWidth: '320px' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase' }}>couldn't load the OS</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.04em', marginTop: '10px', lineHeight: 1.6 }}>{loadErr}</div>
        <button onClick={() => setReload(n => n + 1)} style={{ marginTop: '18px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 18px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>↻ Retry</button>
      </div>
    </Shell>
  )

  return (
    <OSInstrument
      profile={profile} isOwner={owner} tasks={tasks} content={content} activity={activity} owners={owners} notice={notice}
      mutators={{ createTask, updateTask, moveTaskTo, deleteTask, createContent, updateContent, deleteContent }}
      refreshAll={refreshAll} brainMsgs={brainMsgs} setBrainMsgs={setBrainMsgs}
      onDrop={submitDrop} drops={drops}
    />
  )
}

/* CREATE central (and any deep link) can land on a specific pane:
   /os?tab=events&new=1 opens the Events surface straight onto a blank
   event. Read once at mount — the instrument owns the state after that. */
function useOSEntry() {
  const [searchParams] = useSearchParams()
  const valid = ['board', 'content', 'brain', 'events', 'network']
  const t = searchParams.get('tab')
  return {
    initialTab: valid.includes(t) ? t : 'board',
    startNewEvent: searchParams.get('new') === '1',
  }
}

/* =========================================================================
   OSInstrument — the entire instrument (rail + header + pulse + roadmap +
   tabs + panels + Brain dock), desktop AND phone branches, as one
   presentational component. Data + mutators come in as props; no supabase
   here (the DEV harness mounts this with mirror data).
   ========================================================================= */
export function OSInstrument({ profile, isOwner = false, tasks, content, activity, owners, notice, mutators, refreshAll, brainMsgs, setBrainMsgs, onDrop = null, drops = [] }) {
  const navigate = useNavigate()
  const desktop = useIsDesktop()   // >=768 — instrument shell
  const railFull = useRailFull()   // >=1180 — full rail; below, icon-only
  const { initialTab, startNewEvent } = useOSEntry()
  const [tab, setTab] = useState(initialTab)
  // one-shot: &new=1 opens the blank editor ONCE — leaving and returning to
  // the Events pane must not keep reopening it
  const newEventOnce = useRef(startNewEvent)
  // the founder's desk appears only on the server's owner verdict
  const tabs = isOwner ? [...TABS, NETWORK_TAB, MODERATION_TAB, COHORTS_TAB] : TABS
  const [hello, setHello] = useState(() => { try { return !localStorage.getItem(HELLO_KEY) } catch { return false } })
  const [dockOpen, setDockOpen] = useState(false)
  const dismissHello = () => { setHello(false); try { localStorage.setItem(HELLO_KEY, '1') } catch {} }
  const { createTask, updateTask, moveTaskTo, deleteTask, createContent, updateContent, deleteContent } = mutators

  // the dock and the tab are the same session — never both at once
  useEffect(() => { if (tab === 'brain' && dockOpen) setDockOpen(false) }, [tab, dockOpen])

  // if the active tab leaves the set (owner verdict flipped on refresh),
  // land on Board instead of an empty pane
  useEffect(() => { if (!tabs.some(t => t.key === tab)) setTab('board') }, [isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  // B toggles the Brain dock (same guard style as the board's N quick-add);
  // Esc closes it. Ignored while typing or while on the Brain tab itself.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { if (dockOpen) setDockOpen(false); return }
      if ((e.key !== 'b' && e.key !== 'B') || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (tab === 'brain') return
      e.preventDefault()
      setDockOpen(v => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dockOpen, tab])

  const counts = {
    days: daysUntil(FALL_001_ISO),
    week: tasks.filter(t => t.board_column === 'this_week').length,
    motion: tasks.filter(t => t.board_column === 'in_motion').length,
    make: content.filter(c => c.status !== 'posted').length,
    planned: content.filter(c => c.planned_date).length,
  }
  const activeTab = tabs.find(t => t.key === tab) || TABS[0]
  const specLine = `HOUSTON, TX · ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()} · OS V1`
  const firstName = (profile?.full_name || profile?.username || 'you').split(' ')[0]

  // THE BRAIN opens with YOUR TODAY (Ley 16) — real state from the board and
  // the live event, never generic chips. All of it already lives in Supabase.
  // "Next event" must be NEXT: a published event whose date already passed is
  // an honest absence here, not a next date (Ley 11).
  const live = useLiveEvent()
  const eventUpcoming = live.hasDate && live.date >= new Date(new Date().toDateString())
  const brainContext = {
    days: counts.days,
    week: tasks.filter(t => t.board_column === 'this_week').map(t => t.title),
    motion: tasks.filter(t => t.board_column === 'in_motion').map(t => t.title),
    toMake: content.filter(c => c.status !== 'posted').map(c => c.title),
    nextEvent: eventUpcoming ? { title: `${live.name}${live.editionNumber ? ' ' + live.editionNumber : ''}`, date: live.dateLong } : null,
  }

  const brainEl = (embedded) => (
    <Brain embedded={embedded} context={brainContext} onSaveContent={createContent} onActed={refreshAll} messages={brainMsgs} setMessages={setBrainMsgs} />
  )

  const dock = dockOpen && tab !== 'brain' && (
    <BrainDock mobile={!desktop} onClose={() => setDockOpen(false)}>
      {brainEl(true)}
    </BrainDock>
  )

  const dockBtn = tab !== 'brain' && (
    // the Brain is a first-class citizen of the instrument — its door reads
    // like a presence, not a footnote (silver ring, star mark, steady glow)
    <button onClick={() => setDockOpen(v => !v)} aria-label="Toggle the Brain dock (B)" title="The Brain — press B"
      style={{ background: dockOpen ? 'rgba(199,201,209,.12)' : 'rgba(199,201,209,.04)', border: `1px solid ${dockOpen ? SILVER : 'rgba(199,201,209,.3)'}`, borderRadius: '100px', padding: '6px 14px', color: dockOpen ? BONE : BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
      <span aria-hidden style={{ width: '5px', height: '5px', borderRadius: '50%', background: STAR, boxShadow: '0 0 7px rgba(232,233,237,.6)' }} />
      The Brain{desktop ? ' · B' : ''}
    </button>
  )

  const helloCard = hello && (
    <div className="os-reveal" style={{ position: 'relative', border: `1px solid ${HAIR_HI}`, background: PANEL, borderRadius: '14px', padding: desktop ? '20px 24px' : '16px 16px', marginBottom: '20px', maxWidth: '640px' }}>
      <button onClick={dismissHello} aria-label="Dismiss" style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px' }}><X size={14} /></button>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ welcome to the room</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: desktop ? '30px' : '24px', lineHeight: .95, marginTop: '10px', color: BONE }}>
        {firstName.toUpperCase()}, THIS IS THE <span style={chromeText}>OS</span>.
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: '13px', color: BONE_MID, lineHeight: 1.6, marginTop: '10px' }}>
        The board is what's moving. The engine is what we're making. The Brain listens and acts. One room, all of it pointed at Fall 001 — and it moves better with you in it.
      </div>
    </div>
  )

  // section transitions CONNECT (Ley 13): the pane slides from the side the
  // tab lives on, never a dry cut. Direction = index delta on the rail.
  const prevTabIdx = useRef(0)
  const tabIdx = Math.max(0, tabs.findIndex(t => t.key === tab))
  const slideClass = tabIdx > prevTabIdx.current ? 'os-slide-in-right' : tabIdx < prevTabIdx.current ? 'os-slide-in-left' : 'os-reveal-fast'
  useEffect(() => { prevTabIdx.current = tabIdx }, [tabIdx])

  const panel = (
    <>
      {notice && <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase', padding: '8px 0 14px' }}>△ {notice}</div>}
      <div key={tab} className={slideClass}>
        {tab === 'board' && <Board tasks={tasks} owners={owners} profileId={profile?.id} onCreate={createTask} onUpdate={updateTask} onMoveTo={moveTaskTo} onDelete={deleteTask} />}
        {tab === 'content' && <ContentEngine content={content} owners={owners} onCreate={createContent} onUpdate={updateContent} onDelete={deleteContent} />}
        {tab === 'brain' && brainEl(false)}
        {tab === 'events' && <EventsAdmin isOwner={isOwner} startNew={newEventOnce.current} onConsumedNew={() => { newEventOnce.current = false }} />}
        {tab === 'network' && isOwner && <Network />}
        {tab === 'moderation' && isOwner && <Moderation />}
        {tab === 'cohorts' && isOwner && <Cohorts />}
      </div>
      {tab !== 'brain' && <Signal activity={activity} owners={owners} />}
      {tab !== 'brain' && isOwner && <DropsFeed drops={drops} owners={owners} />}
    </>
  )

  // the section's light temperature — one glow layer per tab, crossfading on
  // opacity (backgrounds don't transition; opacity does). Alpha stays ≤.05:
  // temperature, not color; void and bone intact (Ley 14).
  const temperature = (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {tabs.map(t => (
        <div key={t.key} style={{ position: 'absolute', inset: 0, opacity: tab === t.key ? 1 : 0, transition: 'opacity .9s ease', background: `radial-gradient(110% 70% at 50% -8%, rgba(${t.tint},.05) 0%, rgba(${t.tint},0) 55%)` }} />
      ))}
    </div>
  )

  /* --------------------- INSTRUMENT (>=768): rail + main --------------------- */
  if (desktop) {
    return (
      <Shell>
        {temperature}
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>
          <Rail tabs={tabs} tab={tab} setTab={setTab} profile={profile} counts={counts} full={railFull} />
          <main style={{ flex: 1, minWidth: 0, padding: railFull ? '22px 36px 48px' : '22px 24px 48px' }}>
            {/* header row: tab kicker + Brain dock + spec coordinates */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '14px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.3em', textTransform: 'uppercase', color: BONE_LOW, display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                <span style={{ letterSpacing: 0 }}>{activeTab.mark}</span>
                <span style={{ color: BONE, border: `1px solid ${HAIR_HI}`, padding: '3px 9px', borderRadius: '3px', fontSize: '9px', letterSpacing: '.16em' }}>{activeTab.code}</span>
                <span>{activeTab.label}</span>
                <span aria-hidden style={{ flex: '0 0 38px', height: '1px', background: HAIR_HI }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                {dockBtn}
                {railFull && <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.22em', whiteSpace: 'nowrap' }}>{specLine}</div>}
              </div>
            </div>
            {helloCard}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', marginBottom: '12px' }}>
              <PulseRow counts={counts} />
            </div>
            <RoadmapStrip tasks={tasks} content={content} />
            <div style={{ height: '10px' }} />
            {panel}
          </main>
        </div>
        {dock}
        <DropButton onDrop={onDrop} desktop context={{ tab }} />
      </Shell>
    )
  }

  /* ------------------------- PHONE (<768): fallback ------------------------- */
  return (
    <Shell>
      {temperature}
      <div style={{ padding: '24px 18px 40px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '4px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '9px' }}>◇</div>
          <button onClick={() => navigate('/')} title="Back to The Collectiv4 app" aria-label="Back to The Collectiv4 app"
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>Our network · internal</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '42px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>TEAM OS</h1>
          </button>
          <div style={{ marginLeft: 'auto', paddingBottom: '6px' }}>{dockBtn}</div>
        </div>
        <div style={{ margin: '16px 0 6px' }}>{helloCard}</div>
        <PulseRow counts={counts} />
        <div style={{ height: '10px' }} />
        <RoadmapStrip tasks={tasks} content={content} />
        {/* tabs — semantic icons with their words (Leyes 5, 14) */}
        <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', margin: '4px 0 18px', borderBottom: `1px solid ${HAIR}`, paddingBottom: '2px', overflowX: 'auto' }}>
          {tabs.map(t => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button key={t.key} className="pressable" onClick={() => setTab(t.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? `rgb(${t.tint})` : 'transparent'}`, color: active ? BONE : BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 4px 10px', cursor: 'pointer', marginBottom: '-3px', whiteSpace: 'nowrap' }}>
                <Icon size={13} strokeWidth={active ? 1.9 : 1.5} style={{ color: active ? `rgb(${t.tint})` : BONE_LOW, flexShrink: 0 }} /> {t.label}
              </button>
            )
          })}
        </div>
        {panel}
      </div>
      {dock}
      <DropButton onDrop={onDrop} context={{ tab }} />
    </Shell>
  )
}

/* ------------- pieces (exported for layout previews/tests) ------------- */

/* BrainDock — the Brain, omnipresent. A right side panel on the instrument
   shell (void + grain continuity, hairline border-left); a bottom sheet on
   the phone. Hosts the SAME <Brain> session as the tab. */
function BrainDock({ mobile, onClose, children }) {
  // the app-wide grain (v8) varnishes the dock too — no local layer
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', position: 'relative', zIndex: 1 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase' }}>◇ The Brain</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!mobile && <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.14em', textTransform: 'uppercase' }}>B · Esc</span>}
        <button onClick={onClose} aria-label="Close the Brain dock" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '2px', display: 'inline-flex' }}><X size={15} /></button>
      </div>
    </div>
  )
  if (mobile) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(7,8,14,.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="The Brain"
          style={{ position: 'relative', width: '100%', height: '85dvh', background: VOID_2, borderTop: `1px solid ${HAIR_HI}`, borderRadius: '20px 20px 0 0', padding: '16px 16px calc(14px + env(safe-area-inset-bottom,0px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {header}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
        </div>
      </div>
    )
  }
  return (
    <aside role="dialog" aria-label="The Brain"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 92vw)', zIndex: 10000, background: `radial-gradient(120% 60% at 50% -10%, rgba(242,238,230,.045) 0%, rgba(242,238,230,0) 55%), ${VOID}`, borderLeft: `1px solid ${HAIR_HI}`, padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {header}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </aside>
  )
}

export function Rail({ tabs = TABS, tab, setTab, profile, counts, full = true }) {
  const navigate = useNavigate()
  const name = profile?.full_name || profile?.username || 'Member'
  const avatar = safeImg(profile?.avatar_url)
  const avatarEl = (size) => (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontFamily: FONT_DISPLAY, fontSize: `${Math.round(size * 0.46)}px`, color: BONE }}>{name[0].toUpperCase()}</span>}
    </div>
  )

  /* icon-only rail (<1180px): the deck marks stay, but every mark carries its
     word — an icon that needs explaining isn't design (Pato's OS-QA rule:
     legibility > minimalism). */
  if (!full) {
    return (
      <aside style={{ width: '68px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: `1px solid ${HAIR}`, padding: '24px 8px 18px', background: 'rgba(10,10,13,.55)' }}>
        {/* the brand is a door, not a decoration — tapping it always goes home */}
        <button onClick={() => navigate('/')} title="Back to The Collectiv4 app" aria-label="Back to The Collectiv4 app"
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: '19px', letterSpacing: '.04em', lineHeight: 1, ...chromeText }}>OS</span>
        </button>
        <button onClick={() => navigate('/')} aria-label="Back to the app"
          style={{ marginTop: '14px', width: '52px', padding: '6px 2px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '8px', color: BONE_MID, cursor: 'pointer' }}>
          <ArrowLeft size={12} strokeWidth={1.5} />
          <span style={{ fontFamily: FONT_MONO, fontSize: '6.5px', letterSpacing: '.1em', textTransform: 'uppercase', lineHeight: 1 }}>App</span>
        </button>
        <nav style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          {tabs.map(t => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button key={t.key} className="pressable" onClick={() => setTab(t.key)} title={t.label} aria-label={t.label} aria-current={active ? 'page' : undefined}
                style={{ width: '54px', padding: '9px 2px 7px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', background: active ? `rgba(${t.tint},.08)` : 'transparent', border: `1px solid ${active ? `rgba(${t.tint},.3)` : 'transparent'}`, borderRadius: '9px', color: active ? `rgb(${t.tint})` : BONE_LOW, cursor: 'pointer' }}>
                <Icon size={18} strokeWidth={active ? 1.9 : 1.5} />
                <span style={{ fontFamily: FONT_MONO, fontSize: '7.5px', letterSpacing: '.08em', textTransform: 'uppercase', lineHeight: 1 }}>{t.short || t.label}</span>
              </button>
            )
          })}
        </nav>
        <div style={{ flex: 1 }} />
        <div title="days to Fall 001" style={{ borderTop: `1px solid ${HAIR}`, width: '100%', paddingTop: '12px', textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '14px', color: BONE }}>{String(counts.days >= 0 ? counts.days : '—').padStart(2, '0')}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '6.5px', color: FAINT, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '3px' }}>days to 001</div>
        </div>
        {/* cross-nav — never trapped in the OS */}
        <div style={{ borderTop: `1px solid ${HAIR}`, width: '100%', marginTop: '12px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          {CROSS_NAV.map(l => {
            const Icon = l.icon
            return (
              <button key={l.to} onClick={() => navigate(l.to)} title={l.label} aria-label={l.label}
                style={{ width: '52px', padding: '5px 2px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'transparent', border: 'none', borderRadius: '6px', color: FAINT, cursor: 'pointer' }}>
                <Icon size={13} strokeWidth={1.5} />
                <span style={{ fontFamily: FONT_MONO, fontSize: '6.5px', letterSpacing: '.1em', textTransform: 'uppercase', lineHeight: 1 }}>{l.label}</span>
              </button>
            )
          })}
        </div>
        <div style={{ borderTop: `1px solid ${HAIR}`, width: '100%', marginTop: '10px', paddingTop: '12px', display: 'flex', justifyContent: 'center' }} title={name}>
          {avatarEl(28)}
        </div>
      </aside>
    )
  }

  return (
    <aside style={{ width: '232px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${HAIR}`, padding: '28px 20px 22px', background: 'rgba(10,10,13,.55)' }}>
      {/* mark — the brand is a door, not a decoration: tapping it goes home */}
      <button onClick={() => navigate('/')} title="Back to The Collectiv4 app" aria-label="Back to The Collectiv4 app"
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>The Collectiv4</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: '31px', letterSpacing: '.03em', lineHeight: .9, marginTop: '6px', ...chromeText }}>TEAM OS</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.2em', textTransform: 'uppercase', marginTop: '7px' }}>our network · internal</div>
      </button>

      {/* the way OUT is always visible — never trapped in the OS (P0, QA 11 jul) */}
      <button onClick={() => navigate('/')} aria-label="Back to the app"
        style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '9px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '8px', padding: '9px 12px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', cursor: 'pointer', textAlign: 'left' }}>
        <ArrowLeft size={12} strokeWidth={1.5} />
        Back to the app
      </button>

      {/* nav — semantic icons at a dignified size, each with its word (Leyes 5, 14) */}
      <nav style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {tabs.map(t => {
          const active = tab === t.key
          const Icon = t.icon
          return (
            <button key={t.key} className="pressable" onClick={() => setTab(t.key)} aria-current={active ? 'page' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '11px', background: active ? `rgba(${t.tint},.06)` : 'transparent', border: 'none', borderLeft: `1px solid ${active ? `rgb(${t.tint})` : 'transparent'}`, borderRadius: '0 8px 8px 0', color: active ? BONE : BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
              <Icon size={15} strokeWidth={active ? 1.9 : 1.5} style={{ color: active ? `rgb(${t.tint})` : FAINT, flexShrink: 0 }} />
              {t.label}
              <span style={{ marginLeft: 'auto', fontSize: '8px', color: FAINT, letterSpacing: '.1em' }}>{t.code}</span>
            </button>
          )
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* condensed pulse */}
      <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <RailStat label="days to Fall 001" value={counts.days >= 0 ? counts.days : '—'} big />
        <RailStat label="this week" value={counts.week} />
        <RailStat label="in motion" value={counts.motion} />
        <RailStat label="to make" value={counts.make} />
        <RailStat label="planned" value={counts.planned} />
      </div>

      {/* identity */}
      <div style={{ borderTop: `1px solid ${HAIR}`, marginTop: '14px', paddingTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {avatarEl(28)}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '12px', color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '2px' }}>{profile?.verified ? '✕ verified' : 'owner'}</div>
        </div>
      </div>

      {/* cross-nav — discreet foot links out of the OS; never trapped */}
      <div style={{ borderTop: `1px solid ${HAIR}`, marginTop: '14px', paddingTop: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '7px', rowGap: '5px' }}>
        {CROSS_NAV.map((l, i) => (
          <span key={l.to} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '7px' }}>
            {i > 0 && <span aria-hidden style={{ color: FAINT, fontFamily: FONT_MONO, fontSize: '8px' }}>·</span>}
            <button onClick={() => navigate(l.to)} aria-label={l.label}
              style={{ background: 'transparent', border: 'none', padding: 0, color: FAINT, fontFamily: FONT_MONO, fontSize: '8px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {l.label}
            </button>
          </span>
        ))}
      </div>
    </aside>
  )
}

function RailStat({ label, value, big }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: big ? '15px' : '11px', color: big ? BONE : BONE_MID }}>{String(value).padStart(2, '0')}</span>
    </div>
  )
}

/* Pulse — one row of mono stat pills; wraps, never truncates (§E). */
export function PulseRow({ counts }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minWidth: 0 }}>
      <Pill label="days to Fall 001" value={counts.days >= 0 ? counts.days : '—'} accent />
      <Pill label="this week" value={counts.week} />
      <Pill label="in motion" value={counts.motion} />
      <Pill label="to make" value={counts.make} />
      <Pill label="planned" value={counts.planned} />
    </div>
  )
}

function Pill({ label, value, accent }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '8px', border: `1px solid ${accent ? 'rgba(199,201,209,.3)' : HAIR_HI}`, background: accent ? 'rgba(199,201,209,.06)' : 'transparent', borderRadius: '100px', padding: '7px 14px', whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: '13px', color: accent ? BONE : BONE_MID }}>{String(value).padStart(2, '0')}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.16em', textTransform: 'uppercase' }}>{label}</span>
    </span>
  )
}

/* Signal — the latest moves. Honest when quiet. */
export function Signal({ activity, owners }) {
  return (
    <div style={{ marginTop: '22px', paddingTop: '14px', borderTop: `1px solid ${HAIR}`, maxWidth: '760px' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.26em', textTransform: 'uppercase', marginBottom: '11px' }}>△ Signal · recent</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {activity.slice(0, 10).map((a, i) => (
          <div key={a.id} className="os-reveal-fast" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontFamily: FONT_MONO, fontSize: '10px', lineHeight: 1.4, padding: '6px 0', borderBottom: i === Math.min(activity.length, 10) - 1 ? 'none' : `1px solid ${HAIR}`, animationDelay: `${i * 25}ms` }}>
            <span style={{ color: STAR, flexShrink: 0 }}>{owners[a.profile_id]?.full_name || owners[a.profile_id]?.username || 'Someone'}</span>
            <span style={{ color: BONE_MID, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.action}</span>
            <span style={{ color: FAINT, flexShrink: 0 }}>{relTime(a.created_at)}</span>
          </div>
        ))}
        {activity.length === 0 && (
          <div style={{ fontFamily: FONT_MONO, fontSize: '9.5px', color: FAINT, letterSpacing: '.08em', padding: '10px 0' }}>no moves yet — the board is waiting.</div>
        )}
      </div>
    </div>
  )
}

/* Shell — transparent over the app's shared atmosphere (v8): /os rides the
   QUIET register (grain and a far star — a work surface, not a stage). The
   faint bone glow stays; the solid void is gone so the sky shows through. */
export function Shell({ children, center }) {
  return (
    <div className="os-root" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'radial-gradient(120% 80% at 50% -10%, rgba(242,238,230,.045) 0%, rgba(242,238,230,0) 55%)' }}>
      <div style={{ position: 'relative', zIndex: 1, ...(center ? { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' } : {}) }}>
        {children}
      </div>
    </div>
  )
}
