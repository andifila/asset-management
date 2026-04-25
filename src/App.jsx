// src/App.jsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { LangProvider } from './lib/LangContext'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div className="splash">
      <div className="splash-icon">◈</div>
      <p>Memuat...</p>
    </div>
  )

  return (
    <LangProvider>
      {session ? <Dashboard session={session} /> : <Login />}
    </LangProvider>
  )
}
