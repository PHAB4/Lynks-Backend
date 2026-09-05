import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qcyxyunngbkupttcwlbk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXh5dW5uZ2JrdXB0dGN3bGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNjUwNTksImV4cCI6MjA5OTc0MTA1OX0.ij-_OBQT-nIz8wL6Fpzwy_-dOl2HNRk9EqUcBQXGn-0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
})
