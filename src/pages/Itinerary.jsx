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
  if (trip.status === 'cancelled' || trip.status === 'optional' || trip.status === 'done') return trip.status
  if (!trip.start_date) return trip.status || 'upcoming'
  const parse = d => { const [y,m,dd] = d.split('-'); return new Date(+y,+m-1,+dd) }
  const today = new Date(); today.setHours(0,0,0,0)
  const s = parse(trip.start_date)
  const e = trip.end_date ? parse(trip.end_date) : s
  if (e < today) return 'done'
  if (s <= today) return 'ongoing'
  return 'upcoming'
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

  const totalCostThisYear = trips
    .filter(t => t.start_date?.slice(0, 4) === String(CURRENT_YEAR) && t.est_budget_per_person > 0)
    .reduce((sum, t) => sum + t.est_budget_per_person * (t.people_count || 1), 0)

  const tripsWithBudget = trips.filter(t => t.est_budget_per_person > 0)
  const avgCostPerTrip = tripsWithBudget.length
    ? Math.round(tripsWithBudget.reduce((s, t) => s + t.est_budget_per_person, 0) / tripsWithBudget.length)
    : 0

  const destCount = {}
  trips.forEach(t => { if (t.destination) destCount[t.destination] = (destCount[t.destination] || 0) + 1 })
  const topDest = Object.entries(destCount).sort((a, b) => b[1] - a[1])[0]

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

      {loading ? (
        <div className="loading-state">Memuat data trip...</div>
      ) : (
        <main className="main-content">
          {/* Stats */}
          <div className="itin-stats">
            <div className="itin-stat">
              <div className="itin-stat-val">{trips.length}</div>
              <div className="itin-stat-label">Total Trip</div>
              <div className="itin-stat-sub">
                {tripDelta > 0 ? `+${tripDelta} dari bulan lalu` : tripDelta < 0 ? `${tripDelta} dari bulan lalu` : trips.length === 0 ? 'Belum ada trip' : 'Sama seperti bulan lalu'}
              </div>
            </div>
            <div className="itin-stat">
              <div className="itin-stat-val" style={{ color: '#4a90d9' }}>{ongoing.length}</div>
              <div className="itin-stat-label">Ongoing</div>
              <div className="itin-stat-sub">
                {ongoing.length === 0 ? 'Tidak ada aktif' : `${ongoing.length} sedang berjalan`}
              </div>
            </div>
            <div className="itin-stat">
              <div className="itin-stat-val" style={{ color: 'var(--amber)' }}>{upcoming.length}</div>
              <div className="itin-stat-label">Upcoming</div>
              <div className="itin-stat-sub">
                {upcoming.length === 0 ? 'Tidak ada terjadwal 😢' : `${upcoming.length} trip terjadwal`}
              </div>
            </div>
            <div className="itin-stat">
              <div className="itin-stat-val" style={{ color: 'var(--green)' }}>{done.length}</div>
              <div className="itin-stat-label">Selesai</div>
              <div className="itin-stat-sub">
                {done.length === 0 ? 'Belum ada' : `${done.length} destinasi dikunjungi`}
              </div>
            </div>
            <div className="itin-stat">
              <div className="itin-stat-val" style={{ color: 'var(--blue)' }}>
                {new Set(trips.map(t => t.destination)).size}
              </div>
              <div className="itin-stat-label">Destinasi</div>
              <div className="itin-stat-sub">Tempat unik</div>
            </div>
          </div>

          {/* Dashboard widgets */}
          {(ongoing.length > 0 || (nextTrip && nextTrip.status === 'upcoming')) && (
            <div className="itin-dashboard">
              {ongoing.map(t => {
                const pct = tripProgress(t.start_date, t.end_date)
                return (
                  <div key={t.id} className="itin-dash-widget" onClick={() => setDetail(t)}>
                    <div className="itin-dash-widget-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span className="itin-status-pill" style={{ background: TRIP_STATUS.ongoing.bg, color: TRIP_STATUS.ongoing.color, borderColor: TRIP_STATUS.ongoing.bd }}>
                          ● Ongoing
                        </span>
                        <span className="itin-dash-dest">{t.destination}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{pct}%</span>
                    </div>
                    <div className="itin-progress-bar">
                      <div className="itin-progress-fill" style={{ width: `${pct}%`, background: '#4a90d9' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--muted)' }}>
                      <span>{fmtDateShort(t.start_date)}</span>
                      <span>{fmtDateShort(t.end_date)}</span>
                    </div>
                  </div>
                )
              })}
              {nextTrip && nextTrip.status === 'upcoming' && (() => {
                const d = daysUntil(nextTrip.start_date)
                const col = d === null ? 'var(--muted)' : d <= 3 ? '#e05252' : d <= 14 ? '#e9a229' : '#3dba7e'
                return (
                  <div className="itin-dash-widget" onClick={() => setDetail(nextTrip)}>
                    <div className="itin-dash-widget-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span className="itin-status-pill" style={{ background: TRIP_STATUS.upcoming.bg, color: TRIP_STATUS.upcoming.color, borderColor: TRIP_STATUS.upcoming.bd }}>
                          ◷ Next Trip
                        </span>
                        <span className="itin-dash-dest">{nextTrip.destination}</span>
                      </div>
                    </div>
                    <div className="itin-dash-countdown">
                      <span className="itin-countdown-num" style={{ color: col }}>
                        {d === null ? '—' : Math.abs(d)}
                      </span>
                      <span className="itin-countdown-unit">hari lagi</span>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                      {fmtDate(nextTrip.start_date)} – {fmtDate(nextTrip.end_date)}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* 2026 Rundown */}
          {year2026.length > 0 && (
            <div className="itin-section">
              <div className="section-header">
                <div className="section-title">
                  Rundown {CURRENT_YEAR}
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
                    {year2026.length} trip
                  </span>
                </div>
              </div>
              <div className="itin-rundown">
                {year2026.map(t => {
                  const st = TRIP_STATUS[effectiveStatus(t)] || TRIP_STATUS.upcoming
                  return (
                    <div key={t.id} className="itin-rundown-item" onClick={() => setDetail(t)}>
                      <div className="itin-rundown-line" style={{ background: st.color }} />
                      <div className="itin-rundown-body">
                        <div className="itin-rundown-dest">{t.destination}</div>
                        <div className="itin-rundown-meta">
                          <span>{fmtDateShort(t.start_date)} – {fmtDateShort(t.end_date)}</span>
                          <span>·</span>
                          <span>{tripDuration(t.start_date, t.end_date)}</span>
                          {t.people_count > 1 && <><span>·</span><span>{t.people_count} orang</span></>}
                          <span className="itin-status-pill" style={{ background: st.bg, color: st.color, borderColor: st.bd }}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Travel Insight */}
          <div className="itin-section">
            <div className="section-header">
              <div className="section-title">📊 Travel Insight</div>
            </div>
            <div className="itin-insight-grid">
              <div className="itin-insight-card">
                <div className="itin-insight-label">Total biaya tahun ini</div>
                <div className="itin-insight-val">{totalCostThisYear > 0 ? fmtRp(totalCostThisYear) : '—'}</div>
              </div>
              <div className="itin-insight-card">
                <div className="itin-insight-label">Rata-rata cost per trip</div>
                <div className="itin-insight-val">{avgCostPerTrip > 0 ? fmtRp(avgCostPerTrip) + '/orang' : '—'}</div>
              </div>
              <div className="itin-insight-card">
                <div className="itin-insight-label">Kota paling sering dikunjungi</div>
                <div className="itin-insight-val">{topDest ? topDest[0] : '—'}</div>
                {topDest && topDest[1] > 1 && (
                  <div className="itin-insight-sub">{topDest[1]}× dikunjungi</div>
                )}
              </div>
            </div>
          </div>

          {/* Add button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button className="btn-add" onClick={() => { setEditTrip(null); setShowAdd(true) }}>+ Trip Baru</button>
          </div>

          <div className="itin-section">
            <div className="section-header">
              <div className="section-title" style={{ color: '#4a90d9' }}>Ongoing</div>
            </div>
            {ongoing.length > 0 ? (
              <div className="itin-upcoming-grid">
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

          {upcoming.length > 0 && (
            <div className="itin-section">
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
              </div>
            </div>
          )}

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
  const numDays = (() => {
    if (!trip.start_date || !trip.end_date) return 0
    const [y1,m1,d1] = trip.start_date.split('-'), [y2,m2,d2] = trip.end_date.split('-')
    return Math.round((new Date(+y2,+m2-1,+d2) - new Date(+y1,+m1-1,+d1)) / 86400000) + 1
  })()

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
      {numDays > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {Array.from({ length: numDays }, (_, i) => (
            <span key={i} style={{
              fontSize: '0.6rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(61,186,126,0.15)', color: '#3dba7e', border: '1px solid rgba(61,186,126,0.3)',
            }}>
              Day {i + 1} ✓
            </span>
          ))}
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

      {trip.status === 'ongoing' && (
        <div>
          <div className="itin-progress-bar" style={{ marginBottom: 2 }}>
            <div className="itin-progress-fill" style={{ width: `${tripProgress(trip.start_date, trip.end_date)}%`, background: st.color }} />
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textAlign: 'right' }}>
            {tripProgress(trip.start_date, trip.end_date)}% selesai
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
        <span className="itin-card-cta">Lihat detail →</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={onEdit}>✏</button>
          <button className="btn-icon del" onClick={onDelete}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function TripDetailModal({ trip, uid, onClose, onSaved }) {
  const [localActs,   setLocalActs]   = useState(() => parseActivities(trip.itinerary))
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
    return acts.map(a => ({
      ...blankActivity(),
      ...a,
      price_per_person: a.price_per_person?.toString() || '',
      time_start: a.time_start || '',
      time_end:   a.time_end   || '',
      date_end:   a.date_end   || '',
      category:   a.category   || 'aktivitas',
      attachment_url: a.attachment_url || '',
    }))
  }

  const [form, setForm] = useState({
    destination:  trip?.destination  || '',
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
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  const set    = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setAct = (i, k, v) => setActivities(prev => prev.map((a, idx) => idx === i ? { ...a, [k]: v } : a))
  const addAct = () => setActivities(prev => [...prev, blankActivity()])
  const delAct = i => setActivities(prev => prev.filter((_, idx) => idx !== i))
  const parseRawNum = v => parseInt(String(v).replace(/\./g, '')) || 0

  const toggleFile = i => setFileOpen(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
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
    const start_date = actDates[0] || today
    const end_date   = actDates[actDates.length - 1] || today

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
          <div className="field-row">
            <div className="field">
              <label>Destinasi</label>
              <input type="text" placeholder="Bali, Yogyakarta, Tokyo…"
                value={form.destination} onChange={e => set('destination', e.target.value)} />
            </div>
            <div className="field" style={{ maxWidth: 100 }}>
              <label>Orang</label>
              <input
                type="text" inputMode="numeric" placeholder="2"
                value={form.people_count ? Number(String(form.people_count).replace(/\./g, '')).toLocaleString('id-ID') : ''}
                onChange={e => set('people_count', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
              />
            </div>
            <div className="field" style={{ maxWidth: 140 }}>
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="upcoming">Belum Selesai</option>
                <option value="done">Selesai</option>
                <option value="cancelled">Batal</option>
                <option value="optional">Opsional</option>
              </select>
            </div>
          </div>

          {/* Activities */}
          <div style={{ marginTop: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                Aktivitas ({activities.length})
              </span>
              <button type="button" className="btn-add" onClick={addAct}>+ Tambah</button>
            </div>
            <div className="itin-act-editor">
              {activities.map((a, i) => (
                <div key={i} className="itin-act-wrap">
                  {/* Row 1: berangkat (tanggal + jam) → tiba (tanggal + jam) */}
                  <div className="itin-act-row-1">
                    <input type="date" className="itin-act-input"
                      value={a.date || ''} onChange={e => setAct(i, 'date', e.target.value)} />
                    <input type="time" className="itin-act-input"
                      value={a.time_start || ''} onChange={e => setAct(i, 'time_start', e.target.value)} />
                    <span className="itin-act-row-arrow">→</span>
                    <input type="date" className="itin-act-input"
                      title="Tiba (jika beda hari)"
                      value={a.date_end || ''} onChange={e => setAct(i, 'date_end', e.target.value)} />
                    <input type="time" className="itin-act-input"
                      value={a.time_end || ''} onChange={e => setAct(i, 'time_end', e.target.value)} />
                    <div style={{ flex: 1 }} />
                    <button type="button" className="btn-icon del" onClick={() => delAct(i)}>✕</button>
                  </div>
                  {/* Row 2: aktivitas + detail */}
                  <div className="itin-act-row-2">
                    <input type="text" className="itin-act-input"
                      placeholder="Aktivitas*" value={a.activity}
                      onChange={e => setAct(i, 'activity', e.target.value)} />
                    <input type="text" className="itin-act-input"
                      placeholder="Lokasi" value={a.location}
                      onChange={e => setAct(i, 'location', e.target.value)} />
                    <select className="itin-act-input" value={a.category} onChange={e => setAct(i, 'category', e.target.value)}>
                      {ACT_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                    <input
                      type="text" inputMode="numeric" className="itin-act-input"
                      placeholder="Harga/orang"
                      value={a.price_per_person ? Number(String(a.price_per_person).replace(/\./g, '')).toLocaleString('id-ID') : ''}
                      onChange={e => setAct(i, 'price_per_person', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
                    />
                    <input type="text" className="itin-act-input"
                      placeholder="Catatan" value={a.note}
                      onChange={e => setAct(i, 'note', e.target.value)} />
                    <button
                      type="button"
                      className={`btn-icon${a.attachment_url ? ' itin-clip-active' : ''}`}
                      title="Lampiran / Dokumen"
                      onClick={() => toggleFile(i)}
                    >📎</button>
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
              ))}
              {activities.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>
                  Klik "+ Tambah" untuk menambahkan aktivitas
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <label>Catatan Trip (opsional)</label>
            <input type="text" placeholder="Tips, info penting, dll."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
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
