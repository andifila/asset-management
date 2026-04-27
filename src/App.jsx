// src/App.jsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import VehicleService from './pages/VehicleService'
import Itinerary from './pages/Itinerary'
import MountainHiking from './pages/MountainHiking'
import { LangProvider } from './lib/LangContext'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [module, setModule]   = useState(null)   // null = Home
  const [tabType, setTabType] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
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
      {session && module === null  && <Home session={session} onModule={goModule} />}
      {session && module === 'asset'   && <Dashboard session={session} onHome={goHome} defaultTabType={tabType} />}
      {session && module === 'service'   && <VehicleService session={session} onHome={goHome} />}
      {session && module === 'itinerary' && <Itinerary session={session} onHome={goHome} />}
      {session && module === 'hiking'    && <MountainHiking session={session} onHome={goHome} />}
    </LangProvider>
  )
}
