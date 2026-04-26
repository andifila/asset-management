// src/pages/Itinerary.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'
import Toast from '../components/Toast'

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

// Parse activities from itinerary column (supports both old and new format)
function parseActivities(raw) {
  if (!raw) return []
  const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return null } })() : raw
  if (!data || !Array.isArray(data) || !data.length) return []
  // New format: items have 'activity' key
  if (data[0]?.activity !== undefined) return data
  // Old format (day-based): convert to display format
  return data.flatMap(d => (d.activities || []).map(act => ({
    date: null, activity: act, location: '', price_per_person: 0, note: '', status: 'done'
  })))
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
      { date: '2025-05-03', activity: 'Tiba Ngurah Rai',    location: 'Bandara Ngurah Rai', price_per_person: 500000, note: 'Pesawat pagi', status: 'upcoming' },
      { date: '2025-05-03', activity: 'Check-in Hotel',     location: 'Seminyak',           price_per_person: 450000, note: '',            status: 'upcoming' },
      { date: '2025-05-04', activity: 'Tegallalang Rice',   location: 'Ubud',               price_per_person: 50000,  note: '',            status: 'upcoming' },
      { date: '2025-05-04', activity: 'Tirta Empul',        location: 'Ubud',               price_per_person: 50000,  note: '',            status: 'upcoming' },
      { date: '2025-05-05', activity: 'Kelingking Beach',   location: 'Nusa Penida',        price_per_person: 300000, note: 'Speed boat',  status: 'upcoming' },
    ],
    notes: null,
  },
  {
    destination: 'Bromo',
    start_date: '2024-12-14', end_date: '2024-12-15',
    people_count: 3, est_budget_per_person: 0, status: 'done',
    itinerary: null, notes: null,
  },
  {
    destination: 'Yogyakarta',
    start_date: '2024-08-20', end_date: '2024-08-23',
    people_count: 1, est_budget_per_person: 0, status: 'done',
    itinerary: null, notes: null,
  },
  {
    destination: 'Lombok',
    start_date: '2024-03-10', end_date: '2024-03-14',
    people_count: 4, est_budget_per_person: 0, status: 'done',
    itinerary: null, notes: null,
  },
]

export default function Itinerary({ session, onHome }) {
  const [trips,   setTrips]   = useState([])
  const [loading, setLoading] = useState(true)
  const [detail,  setDetail]  = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editTrip,setEditTrip]= useState(null)
  const [toast,   setToast]   = useState(null)
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

  const upcoming = trips.filter(t => t.status === 'upcoming')
  const done     = trips.filter(t => t.status === 'done')

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
            </div>
            <div className="itin-stat">
              <div className="itin-stat-val" style={{ color: 'var(--amber)' }}>{upcoming.length}</div>
              <div className="itin-stat-label">Upcoming</div>
            </div>
            <div className="itin-stat">
              <div className="itin-stat-val" style={{ color: 'var(--green)' }}>{done.length}</div>
              <div className="itin-stat-label">Selesai</div>
            </div>
            <div className="itin-stat">
              <div className="itin-stat-val" style={{ color: 'var(--blue)' }}>
                {new Set(trips.map(t => t.destination)).size}
              </div>
              <div className="itin-stat-label">Destinasi</div>
            </div>
          </div>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="itin-section">
              <div className="section-header">
                <div className="section-title">Upcoming</div>
                <button className="btn-add" onClick={() => { setEditTrip(null); setShowAdd(true) }}>+ Trip Baru</button>
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

          {/* Milestone — tempat yang pernah dikunjungi */}
          <div className="itin-section">
            <div className="section-header">
              <div className="section-title">
                {upcoming.length === 0 ? 'Semua Trip' : 'Milestone Perjalanan'}
                <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
                  {done.length} destinasi
                </span>
              </div>
              {upcoming.length === 0 && (
                <button className="btn-add" onClick={() => { setEditTrip(null); setShowAdd(true) }}>+ Trip Baru</button>
              )}
            </div>
            {done.length === 0 ? (
              <div className="empty-state">Belum ada trip selesai</div>
            ) : (
              <div className="itin-milestone-grid">
                {done.map(trip => (
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

          {upcoming.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: -8, marginBottom: '1rem' }}>
              <button className="btn-add" onClick={() => { setEditTrip(null); setShowAdd(true) }}>+ Trip Baru</button>
            </div>
          )}
        </main>
      )}

      {detail && <TripDetailModal trip={detail} onClose={() => setDetail(null)} />}

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

function TripMilestoneCard({ trip, onView, onEdit, onDelete }) {
  const activities = parseActivities(trip.itinerary)
  return (
    <div className="itin-milestone-card" onClick={onView}>
      <div className="itin-milestone-top">
        <div className="itin-milestone-dest">{trip.destination}</div>
        <span className="badge badge-teal" style={{ flexShrink: 0 }}>Selesai</span>
      </div>
      <div className="itin-milestone-meta">
        <span>📅 {fmtDateShort(trip.start_date)} – {fmtDateShort(trip.end_date)}</span>
        <span>⏱ {tripDuration(trip.start_date, trip.end_date)}</span>
        {activities.length > 0 && <span>📋 {activities.length} aktivitas</span>}
      </div>
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
  const days  = daysUntil(trip.start_date)
  const activities = parseActivities(trip.itinerary)

  const daysLabel = days === null ? null
    : days > 0  ? `${days} hari lagi`
    : days === 0 ? 'Hari ini!'
    : 'Sudah lewat'

  return (
    <div className="itin-card-upcoming" onClick={onView}>
      <div className="itin-card-top">
        <div className="itin-card-dest">{trip.destination}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {daysLabel && <span className="itin-days-badge">{daysLabel}</span>}
          <span className="badge badge-amber">Upcoming</span>
        </div>
      </div>

      <div className="itin-card-meta">
        <span>📅 {fmtDateShort(trip.start_date)} – {fmtDate(trip.end_date)}</span>
        <span>⏱ {tripDuration(trip.start_date, trip.end_date)}</span>
        {trip.people_count > 1 && <span>👤 {trip.people_count} orang</span>}
        {activities.length > 0 && <span>📋 {activities.length} aktivitas</span>}
      </div>

      {activities.length > 0 && (
        <div className="itin-card-preview">
          {activities.slice(0, 3).map((a, i) => (
            <div key={i} className="itin-preview-day">
              {a.date && <span className="itin-preview-label">{fmtDateShort(a.date)}</span>}
              <span className="itin-preview-acts">{a.activity}{a.location ? ` — ${a.location}` : ''}</span>
            </div>
          ))}
          {activities.length > 3 && (
            <div className="itin-preview-more">+{activities.length - 3} aktivitas lagi →</div>
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

function TripDetailModal({ trip, onClose }) {
  const activities = parseActivities(trip.itinerary)
  const totalAct   = activities.reduce((s, a) => s + Number(a.price_per_person || 0), 0)
  const pax        = trip.people_count || 1

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ fontSize: '1.05rem' }}>{trip.destination}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 3 }}>
              {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
              &nbsp;·&nbsp;{tripDuration(trip.start_date, trip.end_date)}
              {trip.people_count > 1 && <>&nbsp;·&nbsp;{trip.people_count} orang</>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '1rem' }}>
          {activities.length > 0 ? (
            <>
              <div className="table-wrap" style={{ marginBottom: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Aktivitas</th>
                      <th>Lokasi</th>
                      <th className="num">Harga/orang</th>
                      <th className="num">Total</th>
                      <th>Status</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a, i) => {
                      const s = ACT_STATUS[a.status] || ACT_STATUS.upcoming
                      const total = Number(a.price_per_person || 0) * pax
                      return (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{a.date ? fmtDateShort(a.date) : '—'}</td>
                          <td style={{ fontWeight: 500 }}>{a.activity}</td>
                          <td className="muted">{a.location || '—'}</td>
                          <td className="num">{a.price_per_person ? fmtRp(a.price_per_person) : '—'}</td>
                          <td className="num">{total ? fmtRp(total) : '—'}</td>
                          <td>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: s.color }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="muted" style={{ fontSize: '0.72rem' }}>{a.note || ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {totalAct > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="muted" style={{ fontSize: '0.7rem' }}>Total {activities.length} aktivitas</td>
                        <td className="num" style={{ fontSize: '0.78rem' }}>{fmtRp(totalAct)}</td>
                        <td className="num" style={{ fontSize: '0.78rem', color: 'var(--amber)' }}>{fmtRp(totalAct * pax)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
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
    </div>
  )
}

// Blank activity row
const blankActivity = (date = '') => ({
  date, activity: '', location: '', price_per_person: '', note: '', status: 'upcoming'
})

function TripModal({ trip, uid, onClose, onSaved, showToast }) {
  const today = new Date().toISOString().split('T')[0]

  const initActivities = () => {
    if (!trip?.itinerary) return [blankActivity(trip?.start_date || today)]
    const acts = parseActivities(trip.itinerary)
    if (!acts.length) return [blankActivity(trip?.start_date || today)]
    return acts.map(a => ({ ...a, price_per_person: a.price_per_person?.toString() || '' }))
  }

  const [form, setForm] = useState({
    destination:  trip?.destination  || '',
    start_date:   trip?.start_date   || today,
    end_date:     trip?.end_date     || today,
    people_count: trip?.people_count?.toString() || '1',
    status:       trip?.status       || 'upcoming',
    notes:        trip?.notes        || '',
  })
  const [activities, setActivities] = useState(initActivities)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set    = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setAct = (i, k, v) => setActivities(prev => prev.map((a, idx) => idx === i ? { ...a, [k]: v } : a))
  const addAct = () => setActivities(prev => [...prev, blankActivity(form.start_date)])
  const delAct = i => setActivities(prev => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!form.destination.trim() || !form.start_date || !form.end_date) {
      setErr('Destinasi dan tanggal wajib diisi'); return
    }
    if (form.end_date < form.start_date) {
      setErr('Tanggal selesai harus setelah tanggal mulai'); return
    }
    setSaving(true)

    const itinData = activities
      .filter(a => a.activity.trim())
      .map(a => ({
        date:             a.date             || null,
        activity:         a.activity.trim(),
        location:         a.location.trim()  || '',
        price_per_person: parseInt(a.price_per_person) || 0,
        note:             a.note.trim()      || '',
        status:           a.status           || 'upcoming',
      }))

    const payload = {
      user_id:               uid,
      destination:           form.destination.trim(),
      start_date:            form.start_date,
      end_date:              form.end_date,
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
      <div className="modal-box" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <span className="modal-title">{trip ? 'Edit Trip' : '+ Trip Baru'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
          <div className="field">
            <label>Destinasi</label>
            <input type="text" placeholder="Bali, Yogyakarta, Tokyo…" value={form.destination} onChange={e => set('destination', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Tanggal Mulai</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="field">
              <label>Tanggal Selesai</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Jumlah Orang</label>
              <input type="number" min="1" placeholder="2" value={form.people_count} onChange={e => set('people_count', e.target.value)} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="upcoming">Upcoming</option>
                <option value="done">Selesai</option>
              </select>
            </div>
          </div>

          {/* Activities Table */}
          <div style={{ marginTop: '0.5rem', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                Aktivitas ({activities.length})
              </span>
              <button type="button" className="btn-add" onClick={addAct}>+ Tambah</button>
            </div>
            <div className="itin-act-editor">
              {activities.map((a, i) => (
                <div key={i} className="itin-act-row">
                  <input
                    type="date" className="itin-act-input itin-act-date"
                    value={a.date || ''} onChange={e => setAct(i, 'date', e.target.value)}
                  />
                  <input
                    type="text" className="itin-act-input itin-act-activity"
                    placeholder="Aktivitas*" value={a.activity}
                    onChange={e => setAct(i, 'activity', e.target.value)}
                  />
                  <input
                    type="text" className="itin-act-input"
                    placeholder="Lokasi" value={a.location}
                    onChange={e => setAct(i, 'location', e.target.value)}
                  />
                  <input
                    type="number" className="itin-act-input itin-act-price"
                    placeholder="Harga/orang" value={a.price_per_person}
                    onChange={e => setAct(i, 'price_per_person', e.target.value)}
                  />
                  <select
                    className="itin-act-input itin-act-status"
                    value={a.status} onChange={e => setAct(i, 'status', e.target.value)}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="done">Selesai</option>
                    <option value="cancelled">Batal</option>
                    <option value="optional">Opsional</option>
                  </select>
                  <input
                    type="text" className="itin-act-input"
                    placeholder="Catatan" value={a.note}
                    onChange={e => setAct(i, 'note', e.target.value)}
                  />
                  <button type="button" className="btn-icon del" onClick={() => delAct(i)} style={{ flexShrink: 0 }}>✕</button>
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
            <input type="text" placeholder="Tips, info penting, dll." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {err && <div className="modal-error">{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
