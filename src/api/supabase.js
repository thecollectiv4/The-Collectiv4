import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_GWP7VXZml8dAxi5vfyBkxQ_uCGJAC8K'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const db = {
  profiles:      () => supabase.from('profiles'),
  posts:         () => supabase.from('posts'),
  events:        () => supabase.from('events'),
  services:      () => supabase.from('services'),
  moves:         () => supabase.from('moves'),
  conversations: () => supabase.from('conversations'),
  messages:      () => supabase.from('messages'),
  tickets:       () => supabase.from('tickets'),
}
