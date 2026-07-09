import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Lock, X, CalendarDays, Compass, Users, User } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { useOSAccess } from '@/lib/osAccess'
import { useIsDesktop, useRailFull } from '@/lib/useIsDesktop'
import { VOID, VOID_2, BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, PANEL, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, FALL_001_ISO, daysUntil, relTime, COLUMN_LABEL, safeImg } from '@/lib/cosmos'
import Board from '@/components/os/Board'
import ContentEngine from '@/components/os/ContentEngine'
import Brain from '@/components/os/Brain'
import RoadmapStrip from '@/components/os/RoadmapStrip'

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
const TABS = [
  { key: 'board', code: '01', label: 'Board', mark: '●' },
  { key: 'content', code: '02', label: 'Content', mark: '○' },
  { key: 'brain', code: '03', label: 'The Brain', mark: '◇' },
]
const HELLO_KEY = 'os_hello_v1'
// Cross-nav out of the OS — same icon vocabulary as Layout.jsx's bottom nav.
const CROSS_NAV = [
  { to: '/', icon: CalendarDays, label: 'Event' },
  { to: '/discover', icon: Compass, label: 'Discover' },
  { to: '/community', icon: Users, label: 'Community' },
  { to: '/profile', icon: User, label: 'Profile' },
]
const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`

export default function OS() {
  const navigate = useNavigate()
  const { state, profile } = useOSAccess()
  const [tasks, setTasks] = useState([])
  const [content, setContent] = useState([])
  const [activity, setActivity] = useState([])
  const [owners, setOwners] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [brainMsgs, setBrainMsgs] = useState([])
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
  const refreshAll = useCallback(() => { loadTasks(); loadContent(); loadActivity() }, [loadTasks, loadContent, loadActivity])

  useEffect(() => {
    if (state !== 'granted') return
    let alive = true
    ;(async () => {
      setLoadErr('')
      const { data: profs, error: pErr } = await supabase.from('profiles').select('id,full_name,username,avatar_url,verified')
      const [tErr, cErr] = await Promise.all([loadTasks(), loadContent(), loadActivity()])
      if (!alive) return
      if (pErr || tErr || cErr) { setLoadErr((pErr || tErr || cErr).message || 'could not reach the board'); return }
      const map = {}; (profs || []).forEach(p => { map[p.id] = p }); setOwners(map)
      setLoaded(true)
    })()
    return () => { alive = false }
  }, [state, reload, loadTasks, loadContent, loadActivity])

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
        <Lock size={24} style={{ color: BONE_LOW }} />
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '14px' }}>Our network only</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.04em', marginTop: '10px', lineHeight: 1.6 }}>The Team OS is the internal hub for verified members of The Collectiv4.</div>
        <button onClick={() => navigate('/discover')} style={{ marginTop: '18px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 18px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>← Discover</button>
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
      profile={profile} tasks={tasks} content={content} activity={activity} owners={owners} notice={notice}
      mutators={{ createTask, updateTask, moveTaskTo, deleteTask, createContent, updateContent, deleteContent }}
      refreshAll={refreshAll} brainMsgs={brainMsgs} setBrainMsgs={setBrainMsgs}
    />
  )
}

/* =========================================================================
   OSInstrument — the entire instrument (rail + header + pulse + roadmap +
   tabs + panels + Brain dock), desktop AND phone branches, as one
   presentational component. Data + mutators come in as props; no supabase
   here (the DEV harness mounts this with mirror data).
   ========================================================================= */
export function OSInstrument({ profile, tasks, content, activity, owners, notice, mutators, refreshAll, brainMsgs, setBrainMsgs }) {
  const desktop = useIsDesktop()   // >=768 — instrument shell
  const railFull = useRailFull()   // >=1180 — full rail; below, icon-only
  const [tab, setTab] = useState('board')
  const [hello, setHello] = useState(() => { try { return !localStorage.getItem(HELLO_KEY) } catch { return false } })
  const [dockOpen, setDockOpen] = useState(false)
  const dismissHello = () => { setHello(false); try { localStorage.setItem(HELLO_KEY, '1') } catch {} }
  const { createTask, updateTask, moveTaskTo, deleteTask, createContent, updateContent, deleteContent } = mutators

  // the dock and the tab are the same session — never both at once
  useEffect(() => { if (tab === 'brain' && dockOpen) setDockOpen(false) }, [tab, dockOpen])

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
  const activeTab = TABS.find(t => t.key === tab)
  const specLine = `HOUSTON, TX · ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()} · OS V1`
  const firstName = (profile?.full_name || profile?.username || 'you').split(' ')[0]

  const brainEl = (embedded) => (
    <Brain embedded={embedded} onSaveContent={createContent} onActed={refreshAll} messages={brainMsgs} setMessages={setBrainMsgs} />
  )

  const dock = dockOpen && tab !== 'brain' && (
    <BrainDock mobile={!desktop} onClose={() => setDockOpen(false)}>
      {brainEl(true)}
    </BrainDock>
  )

  const dockBtn = tab !== 'brain' && (
    <button onClick={() => setDockOpen(v => !v)} aria-label="Toggle the Brain dock (B)" title="The Brain — press B"
      style={{ background: dockOpen ? 'rgba(199,201,209,.1)' : 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '5px 12px', color: dockOpen ? BONE : BONE_MID, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      ◇ Brain{desktop ? ' · B' : ''}
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

  const panel = (
    <>
      {notice && <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_MID, letterSpacing: '.14em', textTransform: 'uppercase', padding: '8px 0 14px' }}>△ {notice}</div>}
      <div key={tab} className="os-reveal-fast">
        {tab === 'board' && <Board tasks={tasks} owners={owners} profileId={profile?.id} onCreate={createTask} onUpdate={updateTask} onMoveTo={moveTaskTo} onDelete={deleteTask} />}
        {tab === 'content' && <ContentEngine content={content} owners={owners} onCreate={createContent} onUpdate={updateContent} onDelete={deleteContent} />}
        {tab === 'brain' && brainEl(false)}
      </div>
      {tab !== 'brain' && <Signal activity={activity} owners={owners} />}
    </>
  )

  /* --------------------- INSTRUMENT (>=768): rail + main --------------------- */
  if (desktop) {
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>
          <Rail tab={tab} setTab={setTab} profile={profile} counts={counts} full={railFull} />
          <main style={{ flex: 1, minWidth: 0, padding: railFull ? '28px 40px 56px' : '28px 26px 56px' }}>
            {/* header row: tab kicker + Brain dock + spec coordinates */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '18px' }}>
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', marginBottom: '16px' }}>
              <PulseRow counts={counts} />
            </div>
            <RoadmapStrip tasks={tasks} content={content} />
            <div style={{ height: '16px' }} />
            {panel}
          </main>
        </div>
        {dock}
      </Shell>
    )
  }

  /* ------------------------- PHONE (<768): fallback ------------------------- */
  return (
    <Shell>
      <div style={{ padding: '24px 18px 40px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '4px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '9px' }}>◇</div>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>Our network · internal</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '42px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>TEAM OS</h1>
          </div>
          <div style={{ marginLeft: 'auto', paddingBottom: '6px' }}>{dockBtn}</div>
        </div>
        <div style={{ margin: '16px 0 6px' }}>{helloCard}</div>
        <PulseRow counts={counts} />
        <div style={{ height: '10px' }} />
        <RoadmapStrip tasks={tasks} content={content} />
        {/* tabs */}
        <div style={{ display: 'flex', gap: '8px', margin: '4px 0 18px', borderBottom: `1px solid ${HAIR}`, paddingBottom: '2px' }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? SILVER : 'transparent'}`, color: active ? BONE : BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 4px 10px', cursor: 'pointer', marginBottom: '-3px' }}>
                <span style={{ fontSize: '9px' }}>{t.mark}</span> {t.label}
              </button>
            )
          })}
        </div>
        {panel}
      </div>
      {dock}
    </Shell>
  )
}

/* ------------- pieces (exported for layout previews/tests) ------------- */

/* BrainDock — the Brain, omnipresent. A right side panel on the instrument
   shell (void + grain continuity, hairline border-left); a bottom sheet on
   the phone. Hosts the SAME <Brain> session as the tab. */
function BrainDock({ mobile, onClose, children }) {
  const grain = <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .04, backgroundImage: GRAIN_BG }} />
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
          {grain}
          {header}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
        </div>
      </div>
    )
  }
  return (
    <aside role="dialog" aria-label="The Brain"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 92vw)', zIndex: 10000, background: `radial-gradient(120% 60% at 50% -10%, rgba(242,238,230,.045) 0%, rgba(242,238,230,0) 55%), ${VOID}`, borderLeft: `1px solid ${HAIR_HI}`, padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {grain}
      {header}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </aside>
  )
}

export function Rail({ tab, setTab, profile, counts, full = true }) {
  const navigate = useNavigate()
  const name = profile?.full_name || profile?.username || 'Member'
  const avatar = safeImg(profile?.avatar_url)
  const avatarEl = (size) => (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: VOID, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontFamily: FONT_DISPLAY, fontSize: `${Math.round(size * 0.46)}px`, color: BONE }}>{name[0].toUpperCase()}</span>}
    </div>
  )

  /* icon-only rail (<1180px): the deck marks ARE the nav; condensed pulse is
     just the days-to-Fall-001 number; identity is the avatar alone. */
  if (!full) {
    return (
      <aside style={{ width: '64px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: `1px solid ${HAIR}`, padding: '24px 10px 18px', background: 'rgba(10,10,13,.55)' }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: '19px', letterSpacing: '.04em', lineHeight: 1, ...chromeText }} title="Team OS">OS</div>
        <nav style={{ marginTop: '26px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} title={t.label} aria-label={t.label} aria-current={active ? 'page' : undefined}
                style={{ width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(242,238,230,.06)' : 'transparent', border: `1px solid ${active ? HAIR_HI : 'transparent'}`, borderRadius: '8px', color: active ? STAR : BONE_LOW, fontFamily: FONT_MONO, fontSize: '12px', cursor: 'pointer' }}>
                {t.mark}
              </button>
            )
          })}
        </nav>
        <div style={{ flex: 1 }} />
        <div title="days to Fall 001" style={{ borderTop: `1px solid ${HAIR}`, width: '100%', paddingTop: '12px', textAlign: 'center', fontFamily: FONT_MONO, fontSize: '14px', color: BONE }}>
          {String(counts.days >= 0 ? counts.days : '—').padStart(2, '0')}
        </div>
        {/* cross-nav — never trapped in the OS */}
        <div style={{ borderTop: `1px solid ${HAIR}`, width: '100%', marginTop: '12px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
          {CROSS_NAV.map(l => {
            const Icon = l.icon
            return (
              <button key={l.to} onClick={() => navigate(l.to)} title={l.label} aria-label={l.label}
                style={{ width: '32px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: '6px', color: FAINT, cursor: 'pointer' }}>
                <Icon size={14} strokeWidth={1.5} />
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
      {/* mark */}
      <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>The Collectiv4</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: '31px', letterSpacing: '.03em', lineHeight: .9, marginTop: '6px', ...chromeText }}>TEAM OS</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: FAINT, letterSpacing: '.2em', textTransform: 'uppercase', marginTop: '7px' }}>our network · internal</div>

      {/* nav — the deck's marks as the navigation language */}
      <nav style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} aria-current={active ? 'page' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '11px', background: active ? 'rgba(242,238,230,.05)' : 'transparent', border: 'none', borderLeft: `1px solid ${active ? SILVER : 'transparent'}`, borderRadius: '0 8px 8px 0', color: active ? BONE : BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.16em', textTransform: 'uppercase', padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: '9px', color: active ? STAR : FAINT, width: '10px' }}>{t.mark}</span>
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
    <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: `1px solid ${HAIR}`, maxWidth: '760px' }}>
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

/* Shell — void gradient + film grain (deck: fixed, ~4–5%). */
export function Shell({ children, center }) {
  return (
    <div className="os-root" style={{ position: 'relative', minHeight: '100vh', background: `radial-gradient(120% 80% at 50% -10%, rgba(242,238,230,.045) 0%, rgba(242,238,230,0) 55%), ${VOID}` }}>
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: .04, zIndex: 0, backgroundImage: GRAIN_BG }} />
      <div style={{ position: 'relative', zIndex: 1, ...(center ? { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' } : {}) }}>
        {children}
      </div>
    </div>
  )
}
