// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://gwzholmmxsvkdhstukpd.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3emhvbG1teHN2a2Roc3R1a3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNzY4NzMsImV4cCI6MjA5MjY1Mjg3M30.oJWceuuW5c9EZqBJ2c7y_ToZycMSzYM1TZoI2s5DtAg"

export const supabase = createClient(supabaseUrl, supabaseKey)