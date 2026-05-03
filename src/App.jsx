import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from './lib/supabase'
import { LangProvider, useLang } from './lib/LangContext'
import Login from './pages/Login'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import VehicleService from './pages/VehicleService'
import Itinerary from './pages/Itinerary'
import MountainHiking from './pages/MountainHiking'
import WeddingPlanner from './pages/WeddingPlanner'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL

function isAllowed(s) {
  if (!ALLOWED_EMAIL) return true
  return s?.user?.email === ALLOWED_EMAIL
}

const PAGE_TITLES = {
  home:      { id: null,                en: null              },
  asset:     { id: 'Asset Tracking',   en: 'Asset Tracking'  },
  service:   { id: 'Servis Kendaraan', en: 'Vehicle Service' },
  itinerary: { id: 'Itinerary',        en: 'Itinerary'       },
  hiking:    { id: 'Pendakian',        en: 'Mountain Hiking' },
  wedding:   { id: 'Wedding Planner',  en: 'Wedding Planner' },
}

function AppShell({ session }) {
  const [active, setActive] = useState(() => localStorage.getItem('lastModule') || 'home')
  const [collapsed, setCollapsed] = useState(false)
  const [tabType] = useState(() => localStorage.getItem('lastTabType') || null)
  const { lang } = useLang()

  const navigate = (mod) => {
    setActive(mod)
    localStorage.setItem('lastModule', mod)
  }

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
  }

  return (
    <>
      <Sidebar
        active={active}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        session={session}
      />
      <div className={`main-layout${collapsed ? ' collapsed' : ''}`}>
        <Topbar session={session} title={PAGE_TITLES[active]?.[lang]} />
        <div className="page-content" style={{ padding: active === 'asset' ? '0' : undefined }}>
          <AnimatePresence mode="wait">
            <motion.div key={active} variants={pageVariants} initial="initial" animate="animate" exit="exit">
              {active === 'home'      && <Home session={session} onNavigate={navigate} />}
              {active === 'asset'     && <Dashboard session={session} defaultTabType={tabType} />}
              {active === 'service'   && <VehicleService session={session} />}
              {active === 'itinerary' && <Itinerary session={session} />}
              {active === 'hiking'    && <MountainHiking session={session} />}
              {active === 'wedding'   && <WeddingPlanner session={session} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s && !isAllowed(s)) { supabase.auth.signOut(); return }
      setSession(s)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s && !isAllowed(s)) { supabase.auth.signOut(); return }
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>◈</div>
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>MySpace</div>
      </div>
    </div>
  )

  return (
    <LangProvider>
      {!session   && <Login />}
      {session && !isAllowed(session) && (
        <div className="login-bg">
          <div className="login-card">
            <div style={{ fontSize: '2rem', color: 'var(--red)', marginBottom: '0.75rem' }}>⊘</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--red)', marginBottom: '0.5rem' }}>Akses Ditolak</h1>
            <p style={{ fontSize: '0.83rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
              Akun <strong>{session.user.email}</strong> tidak diizinkan.
            </p>
            <button className="btn-google" onClick={() => supabase.auth.signOut()}>Keluar</button>
          </div>
        </div>
      )}
      {session && isAllowed(session) && <AppShell session={session} />}
    </LangProvider>
  )
}
