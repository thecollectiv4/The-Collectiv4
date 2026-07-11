// Cleanup of walkthrough test accounts — strictly within each account's OWN
// permissions (their session, their RLS row, their storage folder). No
// privileged writes: the account hides itself behind is_demo (the honest
// "not a real member" flag every public surface filters) and frees its
// handle. Hard-deleting the auth rows is a one-line founder SQL, listed in
// the handback.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const ANON = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'

for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file)) { console.log(`skip (missing): ${file}`); continue }
  const { uid, email, password } = JSON.parse(fs.readFileSync(file, 'utf8'))
  const supa = createClient(URL, ANON)
  const { error: authErr } = await supa.auth.signInWithPassword({ email, password })
  if (authErr) { console.log(`skip (${email}): ${authErr.message}`); continue }

  // storage: remove everything under the account's own folder
  const { data: objects } = await supa.storage.from('worlds').list(uid, { limit: 100 })
  const paths = (objects || []).map(o => `${uid}/${o.name}`)
  if (paths.length) {
    const { error } = await supa.storage.from('worlds').remove(paths)
    console.log(`${email}: removed ${paths.length} storage object(s)${error ? ` (err: ${error.message})` : ''}`)
  }

  // profile: hide from every public surface + free the handle slot
  const { error: updErr, count } = await supa.from('profiles')
    .update({ is_demo: true, username: null, full_name: 'QA (retired)' }, { count: 'exact' })
    .eq('id', uid)
  console.log(`${email}: profile ${updErr ? `err: ${updErr.message}` : `${count ?? '?'} row(s) hidden (is_demo)`}`)
  await supa.auth.signOut()
}
console.log('cleanup done')
