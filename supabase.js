// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://gwzholmmxsvkdhstukpd.supabase.co"
const supabaseKey = "sb_publishable_z3r6J9lnIUfWn4Ou5hXNVw_VxpZUJdw"

export const supabase = createClient(supabaseUrl, supabaseKey)