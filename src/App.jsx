// src/App.jsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import VehicleService from './pages/VehicleService'
import Itinerary from './pages/Itinerary'
import MountainHiking from './pages/MountainHiking'
import WeddingPlanner from './pages/WeddingPlanner'
import { LangProvider } from './lib/LangContext'

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL

function isAllowed(session) {
  if (!ALLOWED_EMAIL) return true
  return session?.user?.email === ALLOWED_EMAIL
}

function AccessDenied({ email }) {
  const signOut = () => supabase.auth.signOut()
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon" style={{ color: 'var(--red)' }}>⊘</div>
        <h1 className="login-title" style={{ color: 'var(--red)' }}>Akses Ditolak</h1>
        <p className="login-sub">
          Akun <strong>{email}</strong> tidak diizinkan mengakses aplikasi ini.
        </p>
        <button className="btn-google" onClick={signOut} style={{ marginTop: '1.5rem' }}>
          Keluar
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [module, setModule]   = useState(null)
  const [tabType, setTabType] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isAllowed(session)) {
        supabase.auth.signOut()
        return
      }
      setSession(session)
      if (session) {
        const saved = localStorage.getItem('lastModule')
        if (saved) {
          setModule(saved)
          setTabType(localStorage.getItem('lastTabType') || null)
        }
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s && !isAllowed(s)) {
        supabase.auth.signOut()
        return
      }
      setSession(s)
      if (!s) {
        setModule(null); setTabType(null)
        localStorage.removeItem('lastModule'); localStorage.removeItem('lastTabType')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const goModule = (mod, tab = null) => {
    setTabType(tab); setModule(mod)
    localStorage.setItem('lastModule', mod)
    tab ? localStorage.setItem('lastTabType', tab) : localStorage.removeItem('lastTabType')
  }
  const goHome = () => {
    setModule(null); setTabType(null)
    localStorage.removeItem('lastModule'); localStorage.removeItem('lastTabType')
  }

  if (session === undefined) return (
    <div className="splash">
      <div className="splash-icon">◈</div>
      <p>MySpace</p>
    </div>
  )

  return (
    <LangProvider>
      {!session && <Login />}
      {session && !isAllowed(session) && <AccessDenied email={session.user.email} />}
      {session && module === null  && <Home session={session} onModule={goModule} />}
      {session && module === 'asset'   && <Dashboard session={session} onHome={goHome} defaultTabType={tabType} />}
      {session && module === 'service'   && <VehicleService session={session} onHome={goHome} />}
      {session && module === 'itinerary' && <Itinerary session={session} onHome={goHome} />}
      {session && module === 'hiking'    && <MountainHiking session={session} onHome={goHome} />}
      {session && module === 'wedding'   && <WeddingPlanner session={session} onHome={goHome} />}
    </LangProvider>
  )
}
