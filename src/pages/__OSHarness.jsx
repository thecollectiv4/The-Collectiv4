import { useState, useEffect } from 'react'
import { OSInstrument } from './OS'

/* =========================================================================
   DEV-ONLY harness — /__os-harness. Mounts the full OSInstrument with mirror
   data so layout can be verified in a browser without a member session (the
   real /os is gated to verified members). No supabase calls: mutators work
   on local state. The Brain will show its unavailable/error state here —
   acceptable; this harness exists for layout, not the operator.

   Registered in App.jsx ONLY inside import.meta.env.DEV — statically
   excluded from the prod bundle. Never link to it from product UI.
   ========================================================================= */

const iso = (d) => d.toISOString().slice(0, 10)
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return iso(d) }
const ts = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString()

const P1 = 'mirror-pato'
const P2 = 'mirror-diego'

const MIRROR_PROFILE = { id: P1, full_name: 'Pato Durán', username: 'patoduranc', avatar_url: '', verified: true }

const MIRROR_OWNERS = {
  [P1]: MIRROR_PROFILE,
  [P2]: { id: P2, full_name: 'Diego Villaseñor', username: 'visurelic', avatar_url: '', verified: true },
}

const MIRROR_TASKS = [
  { id: 't1', title: 'Scout the warehouse on Sawyer', type: 'venue', board_column: 'ideas', due_date: day(18), owner_profile_id: P1, created_at: ts(9000) },
  { id: 't2', title: 'Fall 001 poster — third pass', type: 'content', board_column: 'ideas', due_date: null, owner_profile_id: P2, created_at: ts(8600) },
  { id: 't3', title: 'Sponsor list — cash only, no promises', type: 'ops', board_column: 'this_week', due_date: day(4), owner_profile_id: P1, created_at: ts(7200) },
  { id: 't4', title: 'Valencia picnic recap edit', type: 'content', board_column: 'this_week', due_date: day(6), owner_profile_id: P2, created_at: ts(7000) },
  { id: 't5', title: 'Bar split draft to venue (in writing)', type: 'venue', board_column: 'this_week', due_date: day(9), owner_profile_id: P1, created_at: ts(6400) },
  { id: 't6', title: 'Ticket flow QA — one real transaction', type: 'platform', board_column: 'in_motion', due_date: day(12), owner_profile_id: P1, created_at: ts(5800) },
  { id: 't7', title: 'Lineup conversations — round one', type: 'ops', board_column: 'in_motion', due_date: day(21), owner_profile_id: P2, created_at: ts(5000) },
  { id: 't8', title: 'DJ set — Saturday booking', type: 'ops', board_column: 'done', due_date: day(-3), owner_profile_id: P1, created_at: ts(4300) },
  { id: 't9', title: 'Grain + hairline pass on /discover', type: 'platform', board_column: 'done', due_date: day(-6), owner_profile_id: P1, created_at: ts(4000) },
]

const LONG_BRIEF = `HOOK — cold open on the empty room, lights off. One line of mono text: "a scattered city, one room."

STRUCTURE
01 · 0:00–0:04  empty warehouse, static wide. Room tone only.
02 · 0:04–0:12  cut rhythm builds with the kick — doors, cables, hands, tape.
03 · 0:12–0:22  first faces arrive. No logos, no talking heads. Eye contact.
04 · 0:22–0:30  the drop lands with the room full. Camera never leaves eye level.

REFERENCES — Boiler Room Mexico City '22 (crowd-first framing), our April 4 recap (the hallway shot), the deck's star-chart marks for the end card.

DELIVERABLES — 1×45s master (4:5), 1×15s cut (9:16), stills for the drop.
VOICE — no captions over faces. Mono type only on black. End card: the 4, then the date.`

const MIRROR_CONTENT = [
  { id: 'c1', title: 'Fall 001 announce film', concept: 'The empty room becoming one room — 45 seconds.', caption: 'one room. done right. for the people.', brief: LONG_BRIEF, format: 'Pro camera', status: 'planned', planned_date: day(10), owner_profile_id: P1, created_at: ts(8000) },
  { id: 'c2', title: 'In-car — why the 4', concept: 'Casual monologue on the symbol, one take.', caption: null, brief: null, format: 'Casual in-car', status: 'idea', planned_date: day(5), owner_profile_id: P1, created_at: ts(7100) },
  { id: 'c3', title: 'Valencia picnic — first gathering', concept: 'Diego documents pole two, raw.', caption: 'the room has two doors now.', brief: null, format: 'iPhone raw', status: 'shot', planned_date: day(2), owner_profile_id: P2, created_at: ts(6000) },
  { id: 'c4', title: 'Museum walkthrough — profile as world', concept: 'Screen capture + hands, scripted beats.', caption: null, brief: null, format: 'Scripted', status: 'edited', planned_date: day(15), owner_profile_id: P1, created_at: ts(5200) },
  { id: 'c5', title: 'April 4 recap — the hallway', concept: 'The shot everyone reposts, recut.', caption: '220 people. one hallway.', brief: null, format: 'Pro camera', status: 'posted', planned_date: day(-8), owner_profile_id: P2, created_at: ts(4500) },
]

const MIRROR_ACTIVITY = [
  { id: 'a1', profile_id: P1, action: 'moved “Ticket flow QA — one real transaction” → In Motion', created_at: ts(12) },
  { id: 'a2', profile_id: P2, action: 'new content “Valencia picnic — first gathering”', created_at: ts(95) },
  { id: 'a3', profile_id: P1, action: 'added “Bar split draft to venue (in writing)”', created_at: ts(230) },
  { id: 'a4', profile_id: P2, action: '“April 4 recap — the hallway” → posted', created_at: ts(1500) },
  { id: 'a5', profile_id: P1, action: 'edited “Sponsor list — cash only, no promises”', created_at: ts(2900) },
]

let nextId = 1

export default function OSHarness() {
  const [tasks, setTasks] = useState(MIRROR_TASKS)
  const [content, setContent] = useState(MIRROR_CONTENT)
  const [activity, setActivity] = useState(MIRROR_ACTIVITY)
  const [notice, setNotice] = useState('')
  const [brainMsgs, setBrainMsgs] = useState([])

  // the harness runs outside Layout.jsx, so it releases the 430px frame itself
  useEffect(() => {
    document.body.classList.add('os-full')
    return () => document.body.classList.remove('os-full')
  }, [])

  const log = (action) => setActivity(a => [{ id: `ah${nextId++}`, profile_id: P1, action, created_at: new Date().toISOString() }, ...a])
  const say = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 5000) }

  const mutators = {
    createTask: async (f) => { setTasks(ts_ => [...ts_, { id: `th${nextId++}`, owner_profile_id: P1, created_at: new Date().toISOString(), ...f }]); log(`added “${f.title}”`); return true },
    updateTask: async (id, f) => { setTasks(ts_ => ts_.map(t => t.id === id ? { ...t, ...f } : t)); log(`edited “${f.title || 'task'}”`); return true },
    moveTaskTo: async (task, colKey) => { setTasks(ts_ => ts_.map(t => t.id === task.id ? { ...t, board_column: colKey } : t)); log(`moved “${task.title}”`); return true },
    deleteTask: async (task) => { setTasks(ts_ => ts_.filter(t => t.id !== task.id)); log(`removed “${task.title}”`); return true },
    createContent: async (f) => { setContent(cs => [...cs, { id: `ch${nextId++}`, owner_profile_id: P1, created_at: new Date().toISOString(), ...f }]); log(`new content “${f.title}”`); return true },
    updateContent: async (id, f) => { setContent(cs => cs.map(c => c.id === id ? { ...c, ...f } : c)); log(`edited content “${f.title || 'content'}”`); return true },
    deleteContent: async (c) => { setContent(cs => cs.filter(x => x.id !== c.id)); log(`removed content “${c.title}”`); return true },
  }
  // silence the unused warning path — harness never errors, say kept for parity
  void say

  return (
    <OSInstrument
      profile={MIRROR_PROFILE}
      tasks={tasks} content={content} activity={activity} owners={MIRROR_OWNERS}
      notice={notice} mutators={mutators} refreshAll={() => {}}
      brainMsgs={brainMsgs} setBrainMsgs={setBrainMsgs}
    />
  )
}
