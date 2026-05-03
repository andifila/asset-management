import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, Wrench, Map, Mountain, Heart,
  ArrowUpRight, Wallet, ChevronRight,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { AreaChart, Area } from 'recharts'
import { fmt } from '../lib/format'
import { useLang } from '../lib/LangContext'
import { useHomeStats } from '../hooks/useHomeStats'

/* ─── helpers ────────────────────────────────────────── */
const daysSince = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null

function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) { setVal(0); return }
    const start = performance.now()
    const tick = ts => {
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return val
}

function genSpark(seed, n = 10, trend = 0.02) {
  let v = 40
  return Array.from({ length: n }, (_, i) => {
    const r = ((seed * 9301 + i * 49297 + 233280) % 233280) / 233280
    v = Math.max(10, Math.min(90, v + (r - 0.44 + trend) * 16))
    return { v: Math.round(v) }
  })
}

/* ─── sub-components ─────────────────────────────────── */

/** Large hero card — total assets */
function AssetHeroCard({ total, loading, onNavigate, lang }) {
  const anim = useCountUp(total)
  const spark = genSpark(3, 12, 0.025)

  return (
    <motion.div
      onClick={() => onNavigate('asset')}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      style={{
        background: 'linear-gradient(135deg, rgba(74,144,217,0.12) 0%, rgba(74,144,217,0.04) 100%)',
        border: '1px solid rgba(74,144,217,0.2)',
        borderRadius: 20,
        padding: '1.5rem 1.75rem 1.25rem',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        gridArea: 'asset',
      }}
    >
      {/* glow */}
      <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(74,144,217,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(74,144,217,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#4a90d9" />
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              {lang === 'en' ? 'Total Portfolio' : 'Total Portofolio'}
            </span>
          </div>
          {loading ? (
            <div className="skel-line skel-h-lg" style={{ width: 220, marginBottom: 6 }} />
          ) : (
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#e8edf5', letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: 'Inter, sans-serif' }}>
              {fmt(anim)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
            <span style={{ background: 'rgba(61,186,126,0.15)', border: '1px solid rgba(61,186,126,0.3)', color: '#3dba7e', borderRadius: 20, padding: '0.15rem 0.55rem', fontSize: '0.7rem', fontWeight: 700 }}>
              ↑ +8% {lang === 'en' ? 'this month' : 'bulan ini'}
            </span>
          </div>
        </div>
        <ArrowUpRight size={16} color="rgba(74,144,217,0.6)" style={{ flexShrink: 0 }} />
      </div>

      {/* sparkline */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem', marginLeft: '-0.5rem', marginRight: '-0.5rem' }}>
        <ResponsiveContainer width="100%" height={48}>
          <AreaChart data={spark} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4a90d9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4a90d9" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="#4a90d9" strokeWidth={2} fill="url(#ag)" dot={false} animationDuration={900} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

/** Wedding ring / donut card */
function WeddingRingCard({ spent, budget, loading, onNavigate, lang }) {
  const pct    = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const remain = budget - spent
  const animPct = useCountUp(pct, 1200)

  const donut = [
    { v: pct,       fill: '#e05252' },
    { v: 100 - pct, fill: 'rgba(255,255,255,0.06)' },
  ]

  return (
    <motion.div
      onClick={() => onNavigate('wedding')}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      style={{
        background: 'linear-gradient(160deg, rgba(224,82,82,0.1) 0%, rgba(224,82,82,0.03) 100%)',
        border: '1px solid rgba(224,82,82,0.18)',
        borderRadius: 20,
        padding: '1.5rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        gridArea: 'wedding',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Heart size={14} color="#e05252" />
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Wedding
        </span>
      </div>

      {/* Donut */}
      <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={donut} dataKey="v" innerRadius={42} outerRadius={56} startAngle={90} endAngle={-270} paddingAngle={2} strokeWidth={0} animationBegin={200} animationDuration={900}>
              {donut.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e05252', lineHeight: 1 }}>
            {loading ? '—' : `${animPct}`}
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 600 }}>%</span>
        </div>
      </div>

      {/* Stats below donut */}
      {!loading && budget > 0 && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {[
            { label: lang === 'en' ? 'Budget'    : 'Budget',     val: fmt(budget),  color: 'var(--muted)' },
            { label: lang === 'en' ? 'Spent'     : 'Terpakai',   val: fmt(spent),   color: '#e05252'      },
            { label: lang === 'en' ? 'Remaining' : 'Sisa',       val: fmt(remain),  color: '#3dba7e'      },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{r.label}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: r.color }}>{r.val}</span>
            </div>
          ))}
        </div>
      )}
      {!loading && budget === 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
          {lang === 'en' ? 'Set your budget →' : 'Set budget →'}
        </p>
      )}
    </motion.div>
  )
}

/** Compact stat tile */
function MiniTile({ icon: Icon, color, bg, label, value, sub, onClick, delay = 0 }) {
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2, transition: { duration: 0.13 } }}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '1rem 1.1rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        transition: 'border-color 0.15s',
      }}
      onHoverStart={e => e.target.style?.borderColor}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
        <ArrowUpRight size={12} color="var(--border2)" />
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sub}
      </div>
    </motion.div>
  )
}

/** Monthly spending tile */
function SpendTile({ amount, loading, lang, delay = 0 }) {
  const anim = useCountUp(amount, 900)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '1rem 1.1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(61,186,126,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={14} color="#3dba7e" />
        </div>
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        {lang === 'en' ? 'This Month' : 'Bulan Ini'}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3dba7e', lineHeight: 1 }}>
        {loading ? '—' : (amount > 0 ? fmt(anim) : '—')}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
        {lang === 'en' ? 'service + wedding' : 'servis + wedding'}
      </div>
    </motion.div>
  )
}

/** Bottom module navigation strip */
const NAV_ITEMS = [
  { id: 'asset',     icon: TrendingUp, color: '#4a90d9', bg: 'rgba(74,144,217,0.12)',   labelId: 'Asset',    labelEn: 'Assets'   },
  { id: 'service',   icon: Wrench,     color: '#e9a229', bg: 'rgba(233,162,41,0.12)',  labelId: 'Servis',   labelEn: 'Service'  },
  { id: 'itinerary', icon: Map,        color: '#3dba7e', bg: 'rgba(61,186,126,0.12)',  labelId: 'Itinerary',labelEn: 'Itinerary'},
  { id: 'hiking',    icon: Mountain,   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', labelId: 'Hiking',   labelEn: 'Hiking'   },
  { id: 'wedding',   icon: Heart,      color: '#e05252', bg: 'rgba(224,82,82,0.12)',   labelId: 'Wedding',  labelEn: 'Wedding'  },
]

function ModuleStrip({ onNavigate, lang }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.4 }}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: '0.25rem', flexShrink: 0 }}>
        {lang === 'en' ? 'Go to' : 'Buka'}
      </span>
      {NAV_ITEMS.map(item => {
        const Icon = item.icon
        return (
          <motion.button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              background: item.bg,
              border: `1px solid ${item.color}28`,
              borderRadius: 20,
              cursor: 'pointer',
              color: item.color,
              fontSize: '0.78rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'opacity 0.12s',
            }}
          >
            <Icon size={12} />
            {lang === 'en' ? item.labelEn : item.labelId}
          </motion.button>
        )
      })}
      <ChevronRight size={13} color="var(--muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
    </motion.div>
  )
}

/* ─── Main ─────────────────────────────────────────────── */
export default function Home({ session, onNavigate }) {
  const { lang } = useLang()
  const uid = session.user.id

  const { data: stats, isLoading: loading } = useHomeStats(uid)
  const { assetTotal = 0, lastService = null, tripCount = 0, hikeCount = 0, wpSpent = 0, wpBudget = 0, monthlySpend = 0 } = stats || {}

  const getSvcLabel = () => {
    if (!lastService) return lang === 'en' ? 'No data' : 'Belum ada'
    try {
      const items = JSON.parse(lastService.service_type)
      if (Array.isArray(items)) {
        const first = items[0]?.nama || '—'
        return items.length > 1 ? `${first} +${items.length - 1}` : first
      }
    } catch {}
    return lastService.service_type || '—'
  }

  const svcDays = daysSince(lastService?.service_date)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

      {/* ── Bento grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 200px',
        gridTemplateRows: 'auto auto',
        gridTemplateAreas: `
          "asset  asset  asset  wedding"
          "svc    trips  hike   wedding"
        `,
        gap: '0.875rem',
      }}>

        {/* Asset hero */}
        <AssetHeroCard total={assetTotal} loading={loading} onNavigate={onNavigate} lang={lang} />

        {/* Wedding ring */}
        <WeddingRingCard spent={wpSpent} budget={wpBudget} loading={loading} onNavigate={onNavigate} lang={lang} />

        {/* Service */}
        <div style={{ gridArea: 'svc' }}>
          <MiniTile
            icon={Wrench}
            color="#e9a229"
            bg="rgba(233,162,41,0.12)"
            label={lang === 'en' ? 'Last Service' : 'Servis Terakhir'}
            value={loading ? '—' : getSvcLabel()}
            sub={loading ? '—' : (svcDays !== null ? (lang === 'en' ? `${svcDays}d ago` : `${svcDays} hari lalu`) : (lang === 'en' ? 'No record' : 'Belum ada'))}
            onClick={() => onNavigate('service')}
            delay={0.2}
          />
        </div>

        {/* Trips */}
        <div style={{ gridArea: 'trips' }}>
          <MiniTile
            icon={Map}
            color="#3dba7e"
            bg="rgba(61,186,126,0.12)"
            label={lang === 'en' ? 'Trips Done' : 'Trip Selesai'}
            value={loading ? '—' : `${tripCount}`}
            sub={lang === 'en' ? 'trips completed' : 'perjalanan'}
            onClick={() => onNavigate('itinerary')}
            delay={0.25}
          />
        </div>

        {/* Hike */}
        <div style={{ gridArea: 'hike' }}>
          <MiniTile
            icon={Mountain}
            color="#a78bfa"
            bg="rgba(167,139,250,0.12)"
            label={lang === 'en' ? 'Mountains' : 'Gunung Didaki'}
            value={loading ? '—' : `${hikeCount}`}
            sub={lang === 'en' ? 'peaks climbed' : 'puncak'}
            onClick={() => onNavigate('hiking')}
            delay={0.3}
          />
        </div>
      </div>

      {/* ── Monthly spending + module strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.875rem', alignItems: 'stretch' }}>
        <SpendTile amount={monthlySpend} loading={loading} lang={lang} delay={0.35} />
        <ModuleStrip onNavigate={onNavigate} lang={lang} />
      </div>

    </div>
  )
}
