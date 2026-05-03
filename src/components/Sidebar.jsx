import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, TrendingUp, Wrench, Map, Mountain, Heart,
  ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'
import { useLang } from '../lib/LangContext'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { id: 'home',      icon: LayoutDashboard, labelId: 'Dashboard',        labelEn: 'Dashboard'       },
  { id: 'asset',     icon: TrendingUp,      labelId: 'Asset Tracking',   labelEn: 'Asset Tracking'  },
  { id: 'service',   icon: Wrench,          labelId: 'Servis Kendaraan', labelEn: 'Vehicle Service' },
  { id: 'itinerary', icon: Map,             labelId: 'Itinerary',        labelEn: 'Itinerary'       },
  { id: 'hiking',    icon: Mountain,        labelId: 'Pendakian',        labelEn: 'Mountain Hiking' },
  { id: 'wedding',   icon: Heart,           labelId: 'Wedding Planner',  labelEn: 'Wedding Planner' },
]

export default function Sidebar({ active, onNavigate, collapsed, onToggle, session }) {
  const { lang } = useLang()
  const name   = session?.user?.user_metadata?.full_name || 'Andi'
  const email  = session?.user?.email || ''
  const avatar = session?.user?.user_metadata?.avatar_url

  const initial = name.charAt(0).toUpperCase()

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Toggle button */}
      <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed
          ? <ChevronRight size={12} color="var(--muted)" />
          : <ChevronLeft  size={12} color="var(--muted)" />
        }
      </button>

      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">◈</div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="sidebar-logo-text"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              MySpace
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const label = lang === 'en' ? item.labelEn : item.labelId
          const isActive = active === item.id
          return (
            <div
              key={item.id}
              className={`sidebar-nav-item${isActive ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="sidebar-nav-icon" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className="sidebar-nav-label"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="sidebar-bottom">
        <div className="sidebar-user" title={collapsed ? `${name}\n${email}` : undefined}>
          <div className="sidebar-avatar">
            {avatar ? <img src={avatar} referrerPolicy="no-referrer" alt="avatar" /> : initial}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}
              >
                <div className="sidebar-user-name">{name.split(' ')[0]}</div>
                <div className="sidebar-user-email">{email}</div>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={() => supabase.auth.signOut()}
              className="btn-icon"
              title="Logout"
              style={{ flexShrink: 0 }}
            >
              <LogOut size={13} />
            </button>
          )}
        </div>
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <button className="btn-icon" onClick={() => supabase.auth.signOut()} title="Logout">
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
