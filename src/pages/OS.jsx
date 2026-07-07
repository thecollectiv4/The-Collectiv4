import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LayoutGrid, Clapperboard, Sparkles, Lock } from 'lucide-react'
import { supabase } from '@/api/supabase'
import { useOSAccess } from '@/lib/osAccess'
import { VOID, BONE, BONE_MID, BONE_LOW, SILVER, STAR, CARD, HAIR, HAIR_HI, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText, FALL_001_ISO, daysUntil, relTime, COLUMN_LABEL } from '@/lib/cosmos'
import Board from '@/components/os/Board'
import ContentEngine from '@/components/os/ContentEngine'
import Brainstorm from '@/components/os/Brainstorm'

const nowISO = () => new Date().toISOString()

export default function OS() {
  const navigate = useNavigate()
  const { state, profile } = useOSAccess()
  const [tab, setTab] = useState('board')
  const [tasks, setTasks] = useState([])
  const [content, setContent] = useState([])
  const [activity, setActivity] = useState([])
  const [owners, setOwners] = useState({})
  const [loaded, setLoaded] = useState(false)

  const loadOwners = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id,full_name,username,avatar_url,verified')
    const map = {}; (data || []).forEach(p => { map[p.id] = p }); setOwners(map)
  }, [])
  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('os_tasks').select('*').order('created_at', { ascending: true }); setTasks(data || [])
  }, [])
  const loadContent = useCallback(async () => {
    const { data } = await supabase.from('os_content').select('*').order('created_at', { ascending: true }); setContent(data || [])
  }, [])
  const loadActivity = useCallback(async () => {
    const { data } = await supabase.from('os_activity').select('*').order('created_at', { ascending: false }).limit(30); setActivity(data || [])
  }, [])

  useEffect(() => {
    if (state !== 'granted') return
    let alive = true
    ;(async () => { await Promise.all([loadOwners(), loadTasks(), loadContent(), loadActivity()]); if (alive) setLoaded(true) })()
    return () => { alive = false }
  }, [state, loadOwners, loadTasks, loadContent, loadActivity])

  const log = useCallback(async (action) => {
    await supabase.from('os_activity').insert({ profile_id: profile?.id ?? null, action }); loadActivity()
  }, [profile, loadActivity])

  // --- task mutators ---
  const createTask = async (f) => { const { error } = await supabase.from('os_tasks').insert({ ...f, owner_profile_id: profile?.id ?? null }); if (!error) { await loadTasks(); log(`added “${f.title}”`) } }
  const updateTask = async (id, f) => { const { error } = await supabase.from('os_tasks').update({ ...f, updated_at: nowISO() }).eq('id', id); if (!error) { await loadTasks(); log(`edited “${f.title}”`) } }
  const moveTask = async (task, dir) => {
    const order = ['ideas', 'this_week', 'in_motion', 'done']
    const i = order.indexOf(task.board_column), ni = Math.max(0, Math.min(order.length - 1, i + dir))
    if (ni === i) return
    const nc = order[ni]
    const { error } = await supabase.from('os_tasks').update({ board_column: nc, updated_at: nowISO() }).eq('id', task.id)
    if (!error) { await loadTasks(); log(`moved “${task.title}” → ${COLUMN_LABEL[nc]}`) }
  }
  const deleteTask = async (task) => { const { error } = await supabase.from('os_tasks').delete().eq('id', task.id); if (!error) { await loadTasks(); log(`removed “${task.title}”`) } }

  // --- content mutators ---
  const createContent = async (f) => { const { error } = await supabase.from('os_content').insert({ ...f, owner_profile_id: profile?.id ?? null }); if (!error) { await loadContent(); log(`new content “${f.title}”`) } }
  const updateContent = async (id, f) => { const { error } = await supabase.from('os_content').update({ ...f, updated_at: nowISO() }).eq('id', id); if (!error) { await loadContent(); log(`edited content “${f.title}”`) } }
  const deleteContent = async (c) => { const { error } = await supabase.from('os_content').delete().eq('id', c.id); if (!error) { await loadContent(); log(`removed content “${c.title}”`) } }
  const saveIntel = async ({ label, finding }) => { const { error } = await supabase.from('os_intel').insert({ label, finding }); if (!error) log(`saved intel “${label}”`) }

  // --- gates ---
  if (state === 'loading' || (state === 'granted' && !loaded)) return <Shell><Center><Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} /></Center></Shell>
  if (state === 'denied') return (
    <Shell><Center>
      <div style={{ textAlign: 'center', maxWidth: '300px' }}>
        <Lock size={24} style={{ color: BONE_LOW }} />
        <div style={{ fontFamily: FONT_MONO, fontSize: '11px', color: BONE_MID, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: '14px' }}>Our network only</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: BONE_LOW, letterSpacing: '.04em', marginTop: '10px', lineHeight: 1.6 }}>The Team OS is the internal hub for verified members of The Collectiv4.</div>
        <button onClick={() => navigate('/discover')} style={{ marginTop: '18px', background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '9px 18px', color: BONE_MID, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer' }}>← Discover</button>
      </div>
    </Center></Shell>
  )

  const thisWeek = tasks.filter(t => t.board_column === 'this_week').length
  const inMotion = tasks.filter(t => t.board_column === 'in_motion').length
  const toMake = content.filter(c => c.status !== 'posted').length
  const planned = content.filter(c => c.planned_date).length
  const days = daysUntil(FALL_001_ISO)

  const TABS = [
    { key: 'board', label: 'Board', icon: LayoutGrid },
    { key: 'content', label: 'Content', icon: Clapperboard },
    { key: 'brainstorm', label: 'Brainstorm', icon: Sparkles },
  ]

  return (
    <Shell>
      <div style={{ padding: '24px 18px 40px', maxWidth: '900px', margin: '0 auto' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '4px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER, letterSpacing: '.28em', paddingBottom: '9px' }}>◇</div>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '4px' }}>Our network · internal</div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '44px', letterSpacing: '.02em', lineHeight: .85, margin: 0, ...chromeText }}>TEAM OS</h1>
          </div>
        </div>

        {/* pulse */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', margin: '18px 0 22px', paddingBottom: '4px' }}>
          <Pulse big value={days >= 0 ? days : '—'} unit="days" label="to Fall 001" accent />
          <Pulse value={thisWeek} label="This week" />
          <Pulse value={inMotion} label="In motion" />
          <Pulse value={toMake} label="To make" />
          <Pulse value={planned} label="Planned" />
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: `1px solid ${HAIR}`, paddingBottom: '2px' }}>
          {TABS.map(t => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? SILVER : 'transparent'}`, color: active ? BONE : BONE_LOW, fontFamily: FONT_MONO, fontSize: '10px', letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 4px 10px', cursor: 'pointer', marginBottom: '-3px' }}>
                <Icon size={13} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* panel */}
        {tab === 'board' && <Board tasks={tasks} owners={owners} profileId={profile?.id} onCreate={createTask} onUpdate={updateTask} onMove={moveTask} onDelete={deleteTask} />}
        {tab === 'content' && <ContentEngine content={content} owners={owners} onCreate={createContent} onUpdate={updateContent} onDelete={deleteContent} />}
        {tab === 'brainstorm' && <Brainstorm onSaveContent={createContent} onSaveIntel={saveIntel} />}

        {/* activity feed (hidden under brainstorm's full-height chat) */}
        {tab !== 'brainstorm' && (
          <div style={{ marginTop: '30px', paddingTop: '18px', borderTop: `1px solid ${HAIR}` }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: '12px' }}>Signal · recent</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {activity.slice(0, 10).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontFamily: FONT_MONO, fontSize: '10.5px', lineHeight: 1.4 }}>
                  <span style={{ color: STAR }}>{owners[a.profile_id]?.full_name || owners[a.profile_id]?.username || 'Someone'}</span>
                  <span style={{ color: BONE_MID, flex: 1, minWidth: 0 }}>{a.action}</span>
                  <span style={{ color: 'rgba(91,89,82,.7)', flexShrink: 0 }}>{relTime(a.created_at)}</span>
                </div>
              ))}
              {activity.length === 0 && <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: 'rgba(91,89,82,.6)' }}>—</div>}
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}

function Pulse({ value, unit, label, big, accent }) {
  return (
    <div style={{ flex: big ? '0 0 auto' : '1 1 0', minWidth: big ? '112px' : '76px', border: `1px solid ${accent ? 'rgba(199,201,209,.25)' : HAIR}`, background: accent ? 'rgba(199,201,209,.05)' : CARD, borderRadius: '13px', padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: big ? '38px' : '30px', lineHeight: .8, ...(accent ? chromeText : { color: BONE }) }}>{value}</span>
        {unit && <span style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em' }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '8px', color: BONE_LOW, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: '7px', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

function Shell({ children }) {
  return <div style={{ position: 'relative', minHeight: '100vh', background: 'radial-gradient(120% 80% at 50% -10%, #12121A 0%, #0A0A0D 55%, #08080B 100%)' }}>{children}</div>
}
function Center({ children }) {
  return <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>{children}</div>
}
