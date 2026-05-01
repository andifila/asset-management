// src/pages/Itinerary.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'
import Toast from '../components/Toast'

const CURRENT_YEAR = 2026

const fmtRp = n => n ? 'Rp ' + Number(n).toLocaleString('id-ID') : '—'

const fmtDate = d => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fmtDateShort = d => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function tripDuration(start, end) {
  if (!start || !end) return '—'
  const [y1, m1, d1] = start.split('-')
  const [y2, m2, d2] = end.split('-')
  const n = Math.round((new Date(+y2, +m2-1, +d2) - new Date(+y1, +m1-1, +d1)) / 86400000) + 1
  return n + ' hari'
}

function daysUntil(startDate) {
  if (!startDate) return null
  const [y, m, d] = startDate.split('-')
  const start = new Date(+y, +m - 1, +d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((start - today) / 86400000)
}

function tripProgress(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const [y1,m1,d1] = startDate.split('-'), [y2,m2,d2] = endDate.split('-')
  const s = new Date(+y1,+m1-1,+d1), e = new Date(+y2,+m2-1,+d2)
  const today = new Date(); today.setHours(0,0,0,0)
  if (today <= s) return 0
  if (today >= e) return 100
  return Math.round((today - s) / (e - s) * 100)
}

function effectiveStatus(trip) {
  if (trip.status === 'cancelled' || trip.status === 'optional') return trip.status
  if (trip.status === 'done') return 'done'
  if (!trip.start_date) return 'upcoming'
  const parse = d => { const [y,m,dd] = d.split('-'); return new Date(+y,+m-1,+dd) }
  const today = new Date(); today.setHours(0,0,0,0)
  const s = parse(trip.start_date)
  const e = trip.end_date ? parse(trip.end_date) : s
  if (s <= today && today <= e) return 'ongoing'
  return 'upcoming'
}

function isPastTrip(trip) {
  if (!trip.end_date) return false
  const [y,m,d] = trip.end_date.split('-')
  const today = new Date(); today.setHours(0,0,0,0)
  return new Date(+y,+m-1,+d) < today
}

function totalDaysThisYear(trips) {
  return trips.filter(t => { const s = effectiveStatus(t); return s === 'done' || s === 'ongoing' })
    .reduce((sum, t) => {
      if (!t.start_date || !t.end_date) return sum
      const [y1,m1,d1] = t.start_date.split('-'), [y2,m2,d2] = t.end_date.split('-')
      const s = new Date(+y1,+m1-1,+d1), e = new Date(+y2,+m2-1,+d2)
      const yStart = new Date(CURRENT_YEAR, 0, 1), yEnd = new Date(CURRENT_YEAR, 11, 31)
      const cs = s > yStart ? s : yStart
      const ce = e < yEnd ? e : yEnd
      if (ce < cs) return sum
      return sum + Math.round((ce - cs) / 86400000) + 1
    }, 0)
}

function parseActivities(raw) {
  if (!raw) return []
  const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return null } })() : raw
  if (!data || !Array.isArray(data) || !data.length) return []
  if (data[0]?.activity !== undefined) return data
  return data.flatMap(d => (d.activities || []).map(act => ({
    date: null, time_start: '', time_end: '', activity: act, location: '',
    category: 'aktivitas', price_per_person: 0, note: '', status: 'done', attachment_url: ''
  })))
}

async function uploadAttachment(file, uid) {
  const BUCKET = 'trip-files'
  const ext  = file.name.split('.').pop().toLowerCase()
  const path = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  let { error } = await supabase.storage.from(BUCKET).upload(path, file)

  if (error) {
    const msg = error.message?.toLowerCase() || ''

    if (msg.includes('bucket') || msg.includes('not found') || error.statusCode === '404') {
      const { error: ce } = await supabase.storage.createBucket(BUCKET, { public: true })
      if (!ce || ce.message?.includes('already exists')) {
        ;({ error } = await supabase.storage.from(BUCKET).upload(path, file))
      } else {
        throw new Error(`Bucket "${BUCKET}" belum ada. Buat di Supabase Dashboard → Storage → New bucket → nama: "${BUCKET}", public: on.`)
      }
    }

    if (error) {
      if (msg.includes('row-level security') || msg.includes('policy') || msg.includes('rls') || error.statusCode === '403') {
        throw new Error(
          `Upload ditolak (RLS). Di Supabase Dashboard → Storage → "${BUCKET}" → Policies → tambahkan policy:\n` +
          `INSERT untuk role "authenticated" dengan kondisi: bucket_id = '${BUCKET}'`
        )
      }
      throw new Error(error.message || 'Upload gagal')
    }
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

const ACT_CATEGORIES = [
  { value: 'transport', label: 'Transport', icon: '🚌', color: '#4a90d9' },
  { value: 'akomodasi', label: 'Akomodasi', icon: '🏨', color: '#8b7de8' },
  { value: 'makan',     label: 'Makan',     icon: '🍜', color: '#e9a229' },
  { value: 'aktivitas', label: 'Aktivitas', icon: '🎯', color: '#3dba7e' },
  { value: 'tiket',     label: 'Tiket',     icon: '🎫', color: '#e05252' },
  { value: 'lainnya',   label: 'Lainnya',   icon: '◎',  color: '#5a6b8a' },
]
const catMap = Object.fromEntries(ACT_CATEGORIES.map(c => [c.value, c]))

const TRIP_STATUS = {
  upcoming:  { label: 'Belum Selesai', color: '#e9a229', bg: 'rgba(233,162,41,0.10)',   bd: 'rgba(233,162,41,0.30)' },
  ongoing:   { label: 'Berlangsung',   color: '#4a90d9', bg: 'rgba(74,144,217,0.10)',   bd: 'rgba(74,144,217,0.30)' },
  done:      { label: 'Selesai',       color: '#3dba7e', bg: 'rgba(61,186,126,0.10)',   bd: 'rgba(61,186,126,0.30)' },
  cancelled: { label: 'Batal',         color: '#e05252', bg: 'rgba(224,82,82,0.10)',    bd: 'rgba(224,82,82,0.30)' },
  optional:  { label: 'Opsional',      color: '#8b7de8', bg: 'rgba(139,125,232,0.10)', bd: 'rgba(139,125,232,0.30)' },
}

const ACT_STATUS = {
  upcoming:  { label: 'Upcoming',  color: '#4a90d9' },
  done:      { label: 'Selesai',   color: '#3dba7e' },
  cancelled: { label: 'Batal',     color: '#e05252' },
  optional:  { label: 'Opsional',  color: '#8b7de8' },
}

const SEED_TRIPS = [
  {
    destination: 'Bali',
    start_date: '2025-05-03', end_date: '2025-05-06',
    people_count: 2, est_budget_per_person: 3200000, status: 'upcoming',
    itinerary: [
      { date: '2025-05-03', time_start: '08:00', time_end: '10:00', activity: 'Tiba Ngurah Rai', location: 'Bandara Ngurah Rai', category: 'transport', price_per_person: 500000, note: 'Pesawat pagi', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-03', time_start: '12:00', time_end: '', activity: 'Check-in Hotel', location: 'Seminyak', category: 'akomodasi', price_per_person: 450000, note: '', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-04', time_start: '09:00', time_end: '11:00', activity: 'Tegallalang Rice', location: 'Ubud', category: 'aktivitas', price_per_person: 50000, note: '', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-04', time_start: '13:00', time_end: '15:00', activity: 'Tirta Empul', location: 'Ubud', category: 'tiket', price_per_person: 50000, note: '', status: 'upcoming', attachment_url: '' },
      { date: '2025-05-05', time_start: '07:00', time_end: '18:00', activity: 'Kelingking Beach', location: 'Nusa Penida', category: 'aktivitas', price_per_person: 300000, note: 'Speed boat', status: 'upcoming', attachment_url: '' },
    ],
    notes: null,
  },
  {
    destination: 'Bromo', start_date: '2024-12-14', end_date: '2024-12-15',
    people_count: 3, est_budget_per_person: 0, status: 'done', itinerary: null, notes: null,
  },
  {
    destination: 'Yogyakarta', start_date: '2024-08-20', end_date: '2024-08-23',
    people_count: 1, est_budget_per_person: 0, status: 'done', itinerary: null, notes: null,
  },
  {
    destination: 'Lombok', start_date: '2024-03-10', end_date: '2024-03-14',
    people_count: 4, est_budget_per_person: 0, status: 'done', itinerary: null, notes: null,
  },
]

function ItinSkeleton() {
  return (
    <main className="main-content">
      <div className="itin-smart-stats">
        {[1,2,3,4].map(i => (
          <div key={i} className="itin-smart-card">
            <span className="skel-line skel-h-sm" style={{ width: '55%', display: 'block', marginBottom: 8 }} />
            <span className="skel-line skel-h-lg" style={{ width: '70%', display: 'block', marginBottom: 6 }} />
            <span className="skel-line skel-h-sm" style={{ width: '45%', display: 'block' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ flex: '0 0 260px' }}>
          <span className="skeleton" style={{ height: 120, display: 'block', borderRadius: 12, marginBottom: 8 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <span key={i} className="skeleton" style={{ height: 80, display: 'block', borderRadius: 12 }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
        {[1,2,3,4,5,6].map(i => (
          <span key={i} className="skeleton" style={{ height: 100, display: 'block', borderRadius: 12 }} />
        ))}
      </div>
    </main>
  )
}

function generateItinInsights(trips, done, ongoing, upcoming, totalDaysTraveled, longestTrip, totalBudget) {
  if (trips.length === 0) return []
  const out = []
  const doneLen = done.length

  if (doneLen >= 10)
    out.push({ icon: '🌍', text: `${doneLen} perjalanan selesai — traveler sejati! Terus jelajahi dunia.`, type: 'positive' })
  else if (doneLen >= 5)
    out.push({ icon: '✈', text: `${doneLen} destinasi dikunjungi. Kamu sudah keliling banyak tempat!`, type: 'positive' })
  else if (doneLen > 0)
    out.push({ icon: '📍', text: `${doneLen} perjalanan selesai tercatat. Petualangan baru menantimu!`, type: 'info' })

  if (ongoing.length > 0)
    out.push({ icon: '🚀', text: `Sedang dalam perjalanan ke ${ongoing[0].destination} — enjoy!`, type: 'positive' })
  else if (upcoming.length > 0)
    out.push({ icon: '🗓', text: `${upcoming.length} trip upcoming — jangan lupa persiapkan itinerary!`, type: 'info' })

  if (longestTrip && longestTrip.days >= 7)
    out.push({ icon: '🏖', text: `Trip terpanjang ${longestTrip.days} hari ke ${longestTrip.trip.destination} — liburan panjang yang seru!`, type: 'positive' })

  if (totalBudget > 10000000)
    out.push({ icon: '💰', text: `Total estimasi budget Rp ${(totalBudget/1e6).toFixed(1)}jt untuk semua perjalanan.`, type: 'info' })

  return out.slice(0, 3)
}

export default function Itinerary({ session, onHome }) {
  const [trips,    setTrips]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [detail,   setDetail]   = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editTrip, setEditTrip] = useState(null)
  const [toast,    setToast]    = useState(null)
  const toastKey = useRef(0)

  const uid    = session.user.id
  const { lang, toggle: toggleLang } = useLang()
  const avatar = session.user.user_metadata?.avatar_url
  const uname  = session.user.user_metadata?.full_name || session.user.email

  const showToast = useCallback((msg, type = 'success') => {
    toastKey.current += 1
    setToast({ message: msg, type, key: toastKey.current })
  }, [])

  const fetchTrips = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('trips').select('*').eq('user_id', uid).order('start_date', { ascending: false })

    if (error) {
      showToast('Setup tabel Supabase dibutuhkan. Jalankan SQL migration.', 'error')
      setLoading(false)
      return
    }

    if (!data.length) {
      const { data: seeded } = await supabase
        .from('trips').insert(SEED_TRIPS.map(t => ({ ...t, user_id: uid }))).select()
      setTrips(seeded || [])
    } else {
      setTrips(data)
    }
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchTrips() }, [fetchTrips])

  const handleDelete = async (id) => {
    await supabase.from('trips').delete().eq('id', id).eq('user_id', uid)
    setTrips(prev => prev.filter(t => t.id !== id))
    showToast('Trip dihapus')
  }

  const ongoing   = trips.filter(t => effectiveStatus(t) === 'ongoing')
  const upcoming  = trips.filter(t => effectiveStatus(t) === 'upcoming')
  const done      = trips.filter(t => effectiveStatus(t) === 'done')
  const milestones = trips.filter(t => ['done', 'cancelled', 'optional'].includes(effectiveStatus(t)))

  const year2026 = trips
    .filter(t => {
      const y1 = t.start_date?.slice(0, 4), y2 = t.end_date?.slice(0, 4)
      return y1 === String(CURRENT_YEAR) || y2 === String(CURRENT_YEAR)
    })
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))

  const nextTrip = [...ongoing, ...upcoming]
    .filter(t => t.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]

  const now = new Date()
  const thisM = now.getMonth(), thisY = now.getFullYear()
  const lastM = thisM === 0 ? 11 : thisM - 1
  const lastY = thisM === 0 ? thisY - 1 : thisY
  const tripsThisMonth = trips.filter(t => {
    if (!t.start_date) return false
    const [y, m] = t.start_date.split('-').map(Number)
    return y === thisY && m - 1 === thisM
  }).length
  const tripsLastMonth = trips.filter(t => {
    if (!t.start_date) return false
    const [y, m] = t.start_date.split('-').map(Number)
    return y === lastY && m - 1 === lastM
  }).length
  const tripDelta = tripsThisMonth - tripsLastMonth

  const doneTripsList = trips.filter(t => effectiveStatus(t) === 'done')

  const totalDaysTraveled = doneTripsList.reduce((sum, t) => {
    if (!t.start_date || !t.end_date) return sum
    const [y1,m1,d1] = t.start_date.split('-'), [y2,m2,d2] = t.end_date.split('-')
    return sum + Math.round((new Date(+y2,+m2-1,+d2) - new Date(+y1,+m1-1,+d1)) / 86400000) + 1
  }, 0)

  const longestTrip = doneTripsList.reduce((best, t) => {
    if (!t.start_date || !t.end_date) return best
    const [y1,m1,d1] = t.start_date.split('-'), [y2,m2,d2] = t.end_date.split('-')
    const days = Math.round((new Date(+y2,+m2-1,+d2) - new Date(+y1,+m1-1,+d1)) / 86400000) + 1
    return (!best || days > best.days) ? { trip: t, days } : best
  }, null)

  const totalBudget = trips
    .filter(t => t.est_budget_per_person > 0)
    .reduce((sum, t) => sum + t.est_budget_per_person * (t.people_count || 1), 0)

  const tripsWithBudget = trips.filter(t => t.est_budget_per_person > 0)
  const avgCostPerTrip = tripsWithBudget.length
    ? Math.round(tripsWithBudget.reduce((s, t) => s + t.est_budget_per_person, 0) / tripsWithBudget.length)
    : 0


  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand" style={{ cursor: 'pointer' }} onClick={onHome}>
          ✈ <span>Itinerary</span>
        </div>
        <div className="topbar-right">
          {onHome && <button className="btn-home" onClick={onHome}>← Home</button>}
          {avatar && <img src={avatar} className="avatar" alt="avatar" referrerPolicy="no-referrer" />}
          <span className="topbar-name">{uname}</span>
          <button className="btn-lang" onClick={toggleLang}>
            <span className={lang === 'id' ? 'lang-active' : ''}>ID</span>
            <span className="lang-sep">·</span>
            <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
          </button>
        </div>
      </header>

      {loading ? <ItinSkeleton /> : (
        <main className="main-content">
          {/* Smart Stats Row */}
          <div className="itin-smart-stats">
            {[
              { eyebrow: 'Trip Selesai',       val: doneTripsList.length || '—',              sub: `${trips.length} total trip`,                             color: 'var(--blue)',   accent: 'var(--blue)'   },
              { eyebrow: 'Hari Perjalanan',     val: totalDaysTraveled > 0 ? `${totalDaysTraveled}` : '—', sub: 'total hari',                              color: 'var(--green)',  accent: 'var(--green)'  },
              { eyebrow: 'Total Budget',        val: totalBudget > 0 ? `${(totalBudget/1e6).toFixed(1)}jt` : '—', sub: totalBudget > 0 ? 'estimasi' : 'belum ada', color: 'var(--purple)', accent: 'var(--purple)' },
              { eyebrow: 'Avg Biaya/Trip',      val: avgCostPerTrip > 0 ? `${(avgCostPerTrip/1e6).toFixed(1)}jt` : '—', sub: 'per orang',                 color: 'var(--amber)',  accent: 'var(--amber)'  },
            ].map((c, i) => (
              <div key={i} className="itin-smart-card">
                <div className="itin-smart-eyebrow">{c.eyebrow}</div>
                <div className="itin-smart-val" style={{ color: c.color }}>{c.val}</div>
                <div className="itin-smart-sub">{c.sub}</div>
                <div className="itin-smart-accent" style={{ background: c.accent }} />
              </div>
            ))}
          </div>

          {/* Smart Insights Strip */}
          {(() => {
            const chips = generateItinInsights(trips, done, ongoing, upcoming, totalDaysTraveled, longestTrip, totalBudget)
            return chips.length > 0 ? (
              <div className="mod-insight-strip">
                {chips.map((c, i) => (
                  <div key={i} className={`mod-insight-chip mod-chip-${c.type}`}>
                    <span className="mod-chip-icon">{c.icon}</span>
                    <span className="mod-chip-text">{c.text}</span>
                  </div>
                ))}
              </div>
            ) : null
          })()}

          {/* Action Bar */}
          <div className="itin-action-bar">
            <div className="itin-action-left">
              <div className="itin-action-title">Perjalananku</div>
              <div className="itin-action-sub">{ongoing.length > 0 ? `Sedang berlangsung: ${ongoing[0].destination}` : upcoming.length > 0 ? `${upcoming.length} trip upcoming` : `${doneTripsList.length} destinasi dikunjungi`}</div>
            </div>
            <button className="itin-action-cta" onClick={() => { setEditTrip(null); setShowAdd(true) }}>
              + Trip Baru
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            {/* Ongoing */}
            <div className="itin-section" style={{ flex: '0 0 300px', minWidth: 0 }}>
              <div className="section-header">
                <div className="section-title" style={{ color: '#4a90d9' }}>Ongoing</div>
              </div>
              {ongoing.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {ongoing.map(trip => (
                    <TripCardUpcoming
                      key={trip.id} trip={trip}
                      onView={() => setDetail(trip)}
                      onEdit={() => { setEditTrip(trip); setShowAdd(true) }}
                      onDelete={() => handleDelete(trip.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="itin-empty-ongoing">
                  <div className="itin-empty-ongoing-icon">🚀</div>
                  <div className="itin-empty-ongoing-title">Belum ada perjalanan aktif</div>
                  <div className="itin-empty-ongoing-sub">Yuk mulai trip baru!</div>
                </div>
              )}
            </div>

            {/* Upcoming */}
            <div className="itin-section" style={{ flex: 1, minWidth: 0 }}>
              <div className="section-header">
                <div className="section-title">Upcoming</div>
              </div>
              <div className="itin-upcoming-grid">
                {upcoming.map(trip => (
                  <TripCardUpcoming
                    key={trip.id} trip={trip}
                    onView={() => setDetail(trip)}
                    onEdit={() => { setEditTrip(trip); setShowAdd(true) }}
                    onDelete={() => handleDelete(trip.id)}
                  />
                ))}
                {/* Card tambah trip baru */}
                <div
                  className="itin-card-upcoming itin-card-add"
                  onClick={() => { setEditTrip(null); setShowAdd(true) }}
                  style={{ borderTopColor: 'var(--border2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 90, opacity: 0.6 }}
                >
                  <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Trip baru</span>
                </div>
              </div>
            </div>
          </div>

          <div className="itin-section">
            <div className="section-header">
              <div className="section-title">
                Milestone Perjalanan
                <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
                  {milestones.length} destinasi
                </span>
              </div>
            </div>
            {milestones.length === 0 ? (
              <div className="empty-state">Belum ada trip selesai</div>
            ) : (
              <div className="itin-milestone-grid">
                {milestones.map(trip => (
                  <TripMilestoneCard
                    key={trip.id} trip={trip}
                    onView={() => setDetail(trip)}
                    onEdit={() => { setEditTrip(trip); setShowAdd(true) }}
                    onDelete={() => handleDelete(trip.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {detail && <TripDetailModal trip={detail} uid={uid} onClose={() => setDetail(null)} onSaved={fetchTrips} />}

      {showAdd && (
        <TripModal
          trip={editTrip} uid={uid}
          onClose={() => setShowAdd(false)}
          onSaved={fetchTrips}
          showToast={showToast}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

// ─── Calendar View ──────────────────────────────────────────────────────────

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_LABELS  = ['S','S','R','K','J','S','M']

function CalendarView({ trips, year, onTripClick }) {
  const dateMap = {}
  trips.forEach(t => {
    if (!t.start_date || !t.end_date) return
    const [y1,m1,d1] = t.start_date.split('-'), [y2,m2,d2] = t.end_date.split('-')
    let cur = new Date(+y1,+m1-1,+d1)
    const end = new Date(+y2,+m2-1,+d2)
    while (cur <= end) {
      if (cur.getFullYear() === year) {
        const key = `${year}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`
        if (!dateMap[key]) dateMap[key] = []
        dateMap[key].push(t)
      }
      cur.setDate(cur.getDate() + 1)
    }
  })

  return (
    <div className="itin-calendar">
      {MONTH_NAMES.map((name, mi) => {
        const daysInMonth = new Date(year, mi + 1, 0).getDate()
        const offset = (new Date(year, mi, 1).getDay() + 6) % 7
        const cells = Array(offset).fill(null)
        for (let d = 1; d <= daysInMonth; d++) cells.push(d)

        return (
          <div key={mi} className="itin-cal-month">
            <div className="itin-cal-month-name">{name.slice(0, 3)} {year}</div>
            <div className="itin-cal-grid">
              {DAY_LABELS.map((l, i) => <div key={i} className="itin-cal-day-label">{l}</div>)}
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />
                const key = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const ts = dateMap[key] || []
                const hasTrip = ts.length > 0
                const col = hasTrip ? (TRIP_STATUS[ts[0].status]?.color || '#3dba7e') : null
                return (
                  <div
                    key={idx}
                    className={`itin-cal-day${hasTrip ? ' itin-cal-day-trip' : ''}`}
                    style={hasTrip ? { background: `${col}28`, color: col, borderColor: `${col}50` } : {}}
                    onClick={hasTrip ? () => onTripClick(ts[0]) : undefined}
                    title={hasTrip ? ts.map(t => t.destination).join(', ') : undefined}
                  >{day}</div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Trip Cards ──────────────────────────────────────────────────────────────

function TripMilestoneCard({ trip, onView, onEdit, onDelete }) {
  const budget = trip.est_budget_per_person
  const year = trip.end_date ? trip.end_date.slice(0, 4) : null
  const st = TRIP_STATUS[effectiveStatus(trip)] || TRIP_STATUS.done
  const acts = parseActivities(trip.itinerary)
  const doneActs = acts.filter(a => a.status === 'done' || a.status === 'cancelled').length

  return (
    <div className="itin-milestone-card" onClick={onView}>
      <div className="itin-milestone-top">
        <div>
          <div className="itin-milestone-dest">{trip.destination}</div>
          {year && <div className="itin-milestone-year">{year}</div>}
        </div>
        <span className="itin-status-pill" style={{ flexShrink: 0, background: st.bg, color: st.color, borderColor: st.bd }}>{st.label}</span>
      </div>
      <div className="itin-milestone-meta">
        <span>{fmtDateShort(trip.start_date)} – {fmtDateShort(trip.end_date)}</span>
        {budget > 0 && <span className="itin-milestone-budget">{fmtRp(budget)}/orang</span>}
      </div>
      {acts.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 600, padding: '2px 9px', borderRadius: 4,
            background: 'rgba(61,186,126,0.15)', color: '#3dba7e', border: '1px solid rgba(61,186,126,0.3)',
          }}>
            {doneActs}/{acts.length} aktivitas selesai
          </span>
        </div>
      )}
      <div className="itin-milestone-footer" onClick={e => e.stopPropagation()}>
        <span className="itin-card-cta" onClick={onView}>Lihat detail →</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={onEdit}>✏</button>
          <button className="btn-icon del" onClick={onDelete}>✕</button>
        </div>
      </div>
    </div>
  )
}

function TripCardUpcoming({ trip, onView, onEdit, onDelete }) {
  const days       = daysUntil(trip.start_date)
  const activities = parseActivities(trip.itinerary)
  const budget     = trip.est_budget_per_person
  const pax        = trip.people_count || 1
  const st         = TRIP_STATUS[effectiveStatus(trip)] || TRIP_STATUS.upcoming

  const actPct = activities.length > 0
    ? Math.round(activities.filter(a => a.status === 'done' || a.status === 'cancelled').length / activities.length * 100)
    : null

  const daysLabel = days === null ? null
    : days > 0  ? `${days} hari lagi`
    : days === 0 ? 'Hari ini!'
    : `${Math.abs(days)} hari lalu`

  const daysColor = days === null ? 'var(--muted)'
    : days <= 3   ? '#e05252'
    : days <= 14  ? '#e9a229'
    : 'var(--green)'

  return (
    <div className="itin-card-upcoming" style={{ borderTopColor: st.color }} onClick={onView}>
      <div className="itin-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="itin-card-dest">{trip.destination}</div>
          <span className="itin-status-pill" style={{ background: st.bg, color: st.color, borderColor: st.bd }}>
            {st.label}
          </span>
        </div>
        {daysLabel && (
          <span className="itin-days-badge" style={{ background: `${daysColor}18`, color: daysColor, borderColor: `${daysColor}40` }}>
            {daysLabel}
          </span>
        )}
      </div>

      <div className="itin-card-meta">
        <span>{fmtDateShort(trip.start_date)} – {fmtDate(trip.end_date)} · {tripDuration(trip.start_date, trip.end_date)}</span>
        {pax > 1 && <span>· {pax} orang</span>}
        {budget > 0 && <span className="itin-budget-pill">{fmtRp(budget)}/orang</span>}
      </div>

      {actPct !== null && (
        <div>
          <div className="itin-progress-bar" style={{ marginBottom: 2 }}>
            <div className="itin-progress-fill" style={{ width: `${actPct}%`, background: st.color }} />
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textAlign: 'right' }}>
            {actPct}% aktivitas selesai
          </div>
        </div>
      )}

      {activities.length > 0 && (
        <div className="itin-card-preview">
          {activities.slice(0, 4).map((a, i) => (
            <div key={i} className="itin-preview-day">
              {a.date && <span className="itin-preview-label">{fmtDateShort(a.date)}</span>}
              {a.time_start && <span style={{ fontSize: '0.6rem', color: 'var(--muted)', flexShrink: 0 }}>{a.time_start}</span>}
              <span className="itin-preview-acts">
                {a.activity}{a.location ? ` — ${a.location}` : ''}
                {a.attachment_url && <span style={{ marginLeft: 4, opacity: 0.6 }}>📎</span>}
              </span>
            </div>
          ))}
          {activities.length > 4 && (
            <div className="itin-preview-more">+{activities.length - 4} aktivitas lagi →</div>
          )}
        </div>
      )}

      <div className="itin-card-footer" onClick={e => e.stopPropagation()}>
        <span className="itin-card-cta" onClick={onView}>Lihat detail →</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={onEdit}>✏</button>
          <button className="btn-icon del" onClick={onDelete}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function sortActs(acts) {
  return [...acts].sort((a, b) => {
    const da = a.date || '9999-99-99', db = b.date || '9999-99-99'
    if (da !== db) return da.localeCompare(db)
    return (a.time_start || '99:99').localeCompare(b.time_start || '99:99')
  })
}

function TripDetailModal({ trip, uid, onClose, onSaved }) {
  const [localActs,   setLocalActs]   = useState(() => sortActs(parseActivities(trip.itinerary)))
  const [localStatus, setLocalStatus] = useState(effectiveStatus(trip))
  const [saving,      setSaving]      = useState(false)
  const [previewUrl,  setPreviewUrl]  = useState(null)
  const pax = trip.people_count || 1
  const st  = TRIP_STATUS[localStatus] || TRIP_STATUS.done

  const totalAct = localActs.reduce((s, a) => s + Number(a.price_per_person || 0), 0)

  const catBudget = {}
  localActs.forEach(a => {
    const c = a.category || 'lainnya'
    catBudget[c] = (catBudget[c] || 0) + Number(a.price_per_person || 0)
  })
  const maxCat = Math.max(...Object.values(catBudget), 1)

  const changeActStatus = async (i, newStatus) => {
    const updated = localActs.map((a, idx) => idx === i ? { ...a, status: newStatus } : a)
    setLocalActs(updated)

    let autoStatus = localStatus
    if (localStatus !== 'cancelled' && localStatus !== 'optional') {
      const allFinished = updated.every(a => a.status === 'done' || a.status === 'cancelled')
      const anyDone     = updated.some(a => a.status === 'done')
      const anyUpcoming = updated.some(a => a.status === 'upcoming')
      if (allFinished) autoStatus = 'done'
      else if (anyDone && anyUpcoming) autoStatus = 'ongoing'
      else if (!anyDone && anyUpcoming) autoStatus = 'upcoming'
    }

    if (autoStatus !== localStatus) setLocalStatus(autoStatus)

    setSaving(true)
    const payload = { itinerary: updated }
    if (autoStatus !== localStatus) payload.status = autoStatus
    await supabase.from('trips').update(payload).eq('id', trip.id)
    setSaving(false)
    onSaved?.()
  }

  const changeTripStatus = async (newStatus) => {
    setLocalStatus(newStatus)
    setSaving(true)
    await supabase.from('trips').update({ status: newStatus }).eq('id', trip.id)
    setSaving(false)
    onSaved?.()
  }

  const buildText = () => [
    `✈ Trip ke ${trip.destination}`,
    `📅 ${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)} (${tripDuration(trip.start_date, trip.end_date)})`,
    trip.people_count > 1 ? `👤 ${trip.people_count} orang` : '',
    '',
    localActs.length ? '📋 Itinerary:' : '',
    ...localActs.map(a => {
      const d = a.date ? fmtDateShort(a.date) + (a.time_start ? ` ${a.time_start}` : '') + ' — ' : ''
      const loc = a.location ? `, ${a.location}` : ''
      const price = a.price_per_person ? ` (${fmtRp(a.price_per_person)}/orang)` : ''
      return `• ${d}${a.activity}${loc}${price}`
    }),
    totalAct > 0 ? '' : '',
    totalAct > 0 ? `💰 Estimasi: ${fmtRp(totalAct)}/orang${pax > 1 ? ` · ${fmtRp(totalAct * pax)} total` : ''}` : '',
    trip.notes ? `\n📝 ${trip.notes}` : '',
  ].filter(l => l !== undefined).join('\n').trim()

  const copyShare = () => {
    navigator.clipboard.writeText(buildText())
      .then(() => alert('Itinerary disalin ke clipboard!'))
  }

  const waShare = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(buildText()), '_blank')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 780 }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="modal-title" style={{ fontSize: '1.05rem' }}>{trip.destination}</div>
              <span className="itin-status-pill" style={{ background: st.bg, color: st.color, borderColor: st.bd }}>
                {st.label}
              </span>
              {saving && <span style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>menyimpan…</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 3 }}>
              {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
              &nbsp;·&nbsp;{tripDuration(trip.start_date, trip.end_date)}
              {trip.people_count > 1 && <>&nbsp;·&nbsp;{trip.people_count} orang</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn-add" style={{ fontSize: '0.72rem', padding: '0.25rem 0.7rem', background: '#25d366', border: '1px solid #25d366' }} onClick={waShare}>
              WhatsApp
            </button>
            <button className="btn-add" style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem', background: 'var(--bg3)', borderColor: 'var(--border2)' }} onClick={copyShare}>
              Salin
            </button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '1rem' }}>

          {/* Budget by category */}
          {Object.keys(catBudget).length > 0 && (
            <div className="itin-cat-budget">
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 6 }}>
                Budget per Kategori
              </div>
              {ACT_CATEGORIES.filter(c => catBudget[c.value]).map(c => (
                <div key={c.value} className="itin-cat-row">
                  <div className="itin-cat-label"><span>{c.icon}</span><span>{c.label}</span></div>
                  <div className="itin-cat-bar-wrap">
                    <div className="itin-cat-bar" style={{ width: `${catBudget[c.value] / maxCat * 100}%`, background: c.color }} />
                  </div>
                  <div className="itin-cat-amount" style={{ color: c.color }}>{fmtRp(catBudget[c.value])}</div>
                </div>
              ))}
            </div>
          )}

          {/* Activities table */}
          {localActs.length > 0 ? (
            <div className="table-wrap" style={{ marginBottom: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jam</th>
                    <th>Aktivitas</th>
                    <th>Lokasi</th>
                    <th>Kat</th>
                    <th className="num">Harga/orang</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {localActs.map((a, i) => {
                    const s   = ACT_STATUS[a.status] || ACT_STATUS.upcoming
                    const cat = catMap[a.category] || catMap.lainnya
                    const total = Number(a.price_per_person || 0) * pax
                    return (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                          {a.date ? fmtDateShort(a.date) : '—'}
                          {a.date_end && a.date_end !== a.date ? <><br /><span style={{ color: 'var(--muted)' }}>–{fmtDateShort(a.date_end)}</span></> : null}
                        </td>
                        <td style={{ fontSize: '0.68rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {a.time_start || '—'}{a.time_end ? `–${a.time_end}` : ''}
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {a.activity}
                          {a.attachment_url && (
                            <button className="itin-attach-btn" title="Lihat lampiran" onClick={() => setPreviewUrl(a.attachment_url)}>📎</button>
                          )}
                        </td>
                        <td className="muted">{a.location || '—'}</td>
                        <td><span title={cat.label}>{cat.icon}</span></td>
                        <td className="num">{a.price_per_person ? fmtRp(a.price_per_person) : '—'}</td>
                        <td className="num">{total ? fmtRp(total) : '—'}</td>
                        <td>
                          <select
                            className="itin-detail-status-sel"
                            value={a.status || 'upcoming'}
                            style={{ color: s.color }}
                            onChange={e => changeActStatus(i, e.target.value)}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="done">Selesai</option>
                            <option value="cancelled">Batal</option>
                            <option value="optional">Opsional</option>
                          </select>
                        </td>
                        <td className="muted" style={{ fontSize: '0.72rem' }}>{a.note || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {totalAct > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="muted" style={{ fontSize: '0.7rem' }}>Total {localActs.length} aktivitas</td>
                      <td className="num" style={{ fontSize: '0.78rem' }}>{fmtRp(totalAct)}</td>
                      <td className="num" style={{ fontSize: '0.78rem', color: 'var(--amber)' }}>{fmtRp(totalAct * pax)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2rem 0' }}>Belum ada detail aktivitas</div>
          )}

          {trip.notes && (
            <div className="itin-notes" style={{ marginTop: '1rem' }}>
              <div className="itin-notes-label">Catatan</div>
              <div className="itin-notes-body">{trip.notes}</div>
            </div>
          )}
        </div>
      </div>
      {previewUrl && <FilePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  )
}

// ─── File Preview Modal ───────────────────────────────────────────────────────

function FilePreviewModal({ url, onClose }) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase()
  const isImage = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)
  const isPdf   = ext === 'pdf'

  return (
    <div className="file-preview-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="file-preview-box">
        <div className="file-preview-header">
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
            {isImage ? '🖼 Gambar' : isPdf ? '📄 PDF' : '📁 File'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <a
              href={url} download
              className="btn-add"
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem', textDecoration: 'none' }}
            >
              Download
            </a>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="file-preview-body">
          {isImage && (
            <img src={url} alt="lampiran" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 4 }} />
          )}
          {isPdf && (
            <iframe src={url} title="PDF" style={{ width: '100%', height: '75vh', border: 'none', borderRadius: 4 }} />
          )}
          {!isImage && !isPdf && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                Format ini tidak bisa dipreview langsung
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-save" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Buka di tab baru ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Trip Modal ──────────────────────────────────────────────────────────────

const blankActivity = () => ({
  date: '', date_end: '', time_start: '', time_end: '', activity: '', location: '',
  category: 'aktivitas', price_per_person: '', note: '', status: 'upcoming', attachment_url: ''
})

function TripModal({ trip, uid, onClose, onSaved, showToast }) {
  const today = new Date().toISOString().split('T')[0]

  const initActivities = () => {
    if (!trip?.itinerary) return [blankActivity()]
    const acts = parseActivities(trip.itinerary)
    if (!acts.length) return [blankActivity()]
    return sortActs(acts.map(a => ({
      ...blankActivity(),
      ...a,
      price_per_person: a.price_per_person?.toString() || '',
      time_start: a.time_start || '',
      time_end:   a.time_end   || '',
      date_end:   a.date_end   || '',
      category:   a.category   || 'aktivitas',
      attachment_url: a.attachment_url || '',
    })))
  }

  const [form, setForm] = useState({
    destination:  trip?.destination  || '',
    start_date:   trip?.start_date   || '',
    end_date:     trip?.end_date     || '',
    people_count: trip?.people_count?.toString() || '1',
    status:       trip?.status       || 'upcoming',
    notes:        trip?.notes        || '',
  })
  const [activities, setActivities] = useState(initActivities)
  const [fileOpen,   setFileOpen]   = useState(() => {
    const s = new Set()
    initActivities().forEach((a, i) => { if (a.attachment_url) s.add(i) })
    return s
  })
  const [uploading,  setUploading]  = useState({})
  const [multiDay,   setMultiDay]   = useState(() => {
    const s = new Set()
    initActivities().forEach((a, i) => { if (a.date_end) s.add(i) })
    return s
  })
  const [expandedIdx, setExpandedIdx] = useState(() => initActivities().length === 0 ? 0 : null)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  const set    = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setAct = (i, k, v) => setActivities(prev => prev.map((a, idx) => idx === i ? { ...a, [k]: v } : a))
  const addAct = () => setActivities(prev => {
    const last = prev[prev.length - 1]
    const next = [...prev, { ...blankActivity(), date: last?.date || '' }]
    setExpandedIdx(next.length - 1)
    return next
  })
  const delAct = i => setActivities(prev => prev.filter((_, idx) => idx !== i))
  const parseRawNum = v => parseInt(String(v).replace(/\./g, '')) || 0

  const toggleFile = i => setFileOpen(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
  })
  const toggleMultiDay = i => setMultiDay(prev => {
    const next = new Set(prev)
    if (next.has(i)) { next.delete(i); setAct(i, 'date_end', '') }
    else next.add(i)
    return next
  })

  const handleFileUpload = async (i, file) => {
    if (!file) return
    setUploading(prev => ({ ...prev, [i]: true }))
    try {
      const url = await uploadAttachment(file, uid)
      setAct(i, 'attachment_url', url)
      showToast('File berhasil diupload')
    } catch (e) {
      showToast('Upload gagal: ' + e.message, 'error')
    } finally {
      setUploading(prev => ({ ...prev, [i]: false }))
    }
  }

  const save = async () => {
    if (!form.destination.trim()) { setErr('Destinasi wajib diisi'); return }
    setSaving(true)

    const itinData = activities
      .filter(a => a.activity.trim())
      .map(a => ({
        date:             a.date        || null,
        date_end:         a.date_end    || null,
        time_start:       a.time_start  || null,
        time_end:         a.time_end    || null,
        activity:         a.activity.trim(),
        location:         a.location.trim()  || '',
        category:         a.category    || 'aktivitas',
        price_per_person: parseRawNum(a.price_per_person),
        note:             a.note.trim() || '',
        status:           a.status      || 'upcoming',
        attachment_url:   a.attachment_url?.trim() || null,
      }))

    const actDates   = itinData.flatMap(a => [a.date, a.date_end].filter(Boolean)).sort()
    const start_date = actDates[0] || form.start_date || today
    const end_date   = actDates[actDates.length - 1] || form.end_date || form.start_date || today

    const payload = {
      user_id:               uid,
      destination:           form.destination.trim(),
      start_date,
      end_date,
      people_count:          parseInt(form.people_count) || 1,
      est_budget_per_person: itinData.reduce((s, a) => s + (a.price_per_person || 0), 0),
      status:                form.status,
      itinerary:             itinData.length ? itinData : null,
      notes:                 form.notes.trim() || null,
    }

    let error
    if (trip) {
      ;({ error } = await supabase.from('trips').update(payload).eq('id', trip.id).eq('user_id', uid))
    } else {
      ;({ error } = await supabase.from('trips').insert(payload))
    }

    if (error) { setSaving(false); setErr(error.message); return }
    showToast(trip ? 'Trip diperbarui' : 'Trip ditambahkan!')
    onClose()
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <span className="modal-title">{trip ? 'Edit Trip' : '+ Trip Baru'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: '0.5rem' }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Destinasi</label>
              <input type="text" placeholder="Bali, Yogyakarta, Tokyo…"
                value={form.destination} onChange={e => set('destination', e.target.value)} />
            </div>
            <div className="field" style={{ width: 90, flexShrink: 0, marginBottom: 0 }}>
              <label>Jumlah orang</label>
              <input
                type="text" inputMode="numeric" placeholder="1"
                value={form.people_count ? Number(String(form.people_count).replace(/\./g, '')).toLocaleString('id-ID') : ''}
                onChange={e => set('people_count', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: '0.75rem' }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Tanggal Mulai</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Tanggal Selesai</label>
              <input type="date" value={form.end_date}
                min={form.start_date || undefined}
                onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          {/* Activities */}
          <div style={{ marginTop: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                Aktivitas ({activities.length})
              </span>
            </div>
            <div className="itin-act-editor">
              {activities.map((a, i) => {
                const isOpen = expandedIdx === i
                const cat = catMap[a.category] || catMap.lainnya
                return isOpen ? (
                <div key={i} className="itin-act-wrap">
                  {/* Row 1: nama + lokasi + hapus */}
                  <div className="itin-act-row-1">
                    <input type="text" className="itin-act-input" style={{ flex: 2, minWidth: 0 }}
                      placeholder="Aktivitas*" value={a.activity}
                      onChange={e => setAct(i, 'activity', e.target.value)} />
                    <input type="text" className="itin-act-input" style={{ flex: 1, minWidth: 0 }}
                      placeholder="Lokasi" value={a.location}
                      onChange={e => setAct(i, 'location', e.target.value)} />
                    <button type="button" className="btn-icon" title="Tutup"
                      onClick={() => setExpandedIdx(null)}
                      style={{ fontSize: '0.7rem' }}>▴</button>
                    <button type="button" className="btn-icon del" onClick={() => delAct(i)}>✕</button>
                  </div>
                  {/* Row 2: kategori pills */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {ACT_CATEGORIES.map(c => (
                      <button key={c.value} type="button" onClick={() => setAct(i, 'category', c.value)}
                        style={{
                          padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem',
                          border: `1px solid ${a.category === c.value ? c.color : 'var(--border)'}`,
                          background: a.category === c.value ? `${c.color}22` : 'var(--bg3)',
                          color: a.category === c.value ? c.color : 'var(--muted)',
                          fontWeight: a.category === c.value ? 600 : 400,
                        }}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                  {/* Row 3: tanggal + jam + harga */}
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="date" className="itin-act-input" style={{ minWidth: 115, flex: '0 0 auto' }}
                      value={a.date || ''} onChange={e => setAct(i, 'date', e.target.value)} />
                    <input type="time" className="itin-act-input" style={{ minWidth: 78, flex: '0 0 auto' }}
                      value={a.time_start || ''} onChange={e => setAct(i, 'time_start', e.target.value)} />
                    <span className="itin-act-row-arrow">→</span>
                    <input type="time" className="itin-act-input" style={{ minWidth: 78, flex: '0 0 auto' }}
                      value={a.time_end || ''} onChange={e => setAct(i, 'time_end', e.target.value)} />
                    <button type="button" title="Multi-hari"
                      onClick={() => toggleMultiDay(i)}
                      style={{
                        padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.65rem',
                        border: `1px solid ${multiDay.has(i) ? '#4a90d9' : 'var(--border)'}`,
                        background: multiDay.has(i) ? 'rgba(74,144,217,0.15)' : 'var(--bg3)',
                        color: multiDay.has(i) ? '#4a90d9' : 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      +hari
                    </button>
                    {multiDay.has(i) && (
                      <input type="date" className="itin-act-input" style={{ minWidth: 115, flex: '0 0 auto' }}
                        value={a.date_end || ''} onChange={e => setAct(i, 'date_end', e.target.value)} />
                    )}
                    <input
                      type="text" inputMode="numeric" className="itin-act-input"
                      style={{ flex: 1, minWidth: 100 }}
                      placeholder="Harga/orang"
                      value={a.price_per_person ? Number(String(a.price_per_person).replace(/\./g, '')).toLocaleString('id-ID') : ''}
                      onChange={e => setAct(i, 'price_per_person', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
                    />
                    <button type="button"
                      className={`btn-icon${a.attachment_url ? ' itin-clip-active' : ''}`}
                      title="Lampiran" onClick={() => toggleFile(i)}>📎</button>
                  </div>
                  {/* File attachment row */}
                  {fileOpen.has(i) && (
                    <div className="itin-act-file">
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text" className="itin-act-input" style={{ flex: 1 }}
                          placeholder="URL lampiran (Google Drive, tiket online, dll.)"
                          value={a.attachment_url || ''}
                          onChange={e => setAct(i, 'attachment_url', e.target.value)}
                        />
                        <label className="itin-file-upload-btn" title="Upload file langsung">
                          {uploading[i] ? '⏳' : '📁'}
                          <input type="file" style={{ display: 'none' }}
                            disabled={!!uploading[i]}
                            onChange={e => handleFileUpload(i, e.target.files?.[0])} />
                        </label>
                        {a.attachment_url && (
                          <a href={a.attachment_url} target="_blank" rel="noopener noreferrer"
                            className="btn-icon" title="Buka lampiran">↗</a>
                        )}
                        {a.attachment_url && (
                          <button type="button" className="btn-icon del"
                            onClick={() => setAct(i, 'attachment_url', '')}>✕</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                ) : (
                <div key={i} className="itin-act-wrap" onClick={() => setExpandedIdx(i)}
                  style={{ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.activity || <span style={{ color: 'var(--muted)' }}>—</span>}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>
                      {[a.date && fmtDateShort(a.date), a.time_start, a.location].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {a.price_per_person > 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--amber)', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                      {fmtRp(a.price_per_person)}
                    </span>
                  )}
                  <button type="button" className="btn-icon del" onClick={e => { e.stopPropagation(); delAct(i) }}>✕</button>
                </div>
                )
              })}
              {activities.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>
                  Klik "+ Tambah" untuk menambahkan aktivitas
                </div>
              )}
            </div>
            <button type="button" className="btn-add" onClick={addAct}
              style={{ marginTop: 6, width: '100%' }}>+ Tambah Aktivitas</button>
          </div>

          {err && <div className="modal-error">{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={save} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
