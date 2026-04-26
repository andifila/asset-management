// src/pages/Itinerary.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'
import Toast from '../components/Toast'

const parseItin = raw => {
  if (!raw) return null
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return null } }
  return raw
}

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

const SEED_TRIPS = [
  {
    destination: 'Bali',
    start_date: '2025-05-03', end_date: '2025-05-06',
    people_count: 2, est_budget_per_person: 3200000, status: 'upcoming',
    itinerary: [
      { day: 1, activities: ['Tiba Ngurah Rai', 'Check-in Seminyak', 'Sarong Restaurant'] },
      { day: 2, activities: ['Tegallalang', 'Tirta Empul', 'Monkey Forest', 'Locavore'] },
      { day: 3, activities: ['Speed boat Sanur', 'Kelingking', "Angel's Billabong", 'Crystal Bay'] },
      { day: 4, activities: ['Check-out', 'Oleh-oleh', 'Flight 14.30'] },
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

          {/* Done */}
          <div className="itin-section">
            <div className="section-header">
              <div className="section-title">{upcoming.length === 0 ? 'Semua Trip' : 'Selesai'}</div>
              {upcoming.length === 0 && (
                <button className="btn-add" onClick={() => { setEditTrip(null); setShowAdd(true) }}>+ Trip Baru</button>
              )}
            </div>
            {done.length === 0 ? (
              <div className="empty-state">Belum ada trip selesai</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Destinasi</th>
                      <th>Tanggal</th>
                      <th>Durasi</th>
                      <th>Orang</th>
                      <th>Budget/orang</th>
                      <th className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {done.map(trip => (
                      <tr key={trip.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(trip)}>
                        <td><strong>{trip.destination}</strong></td>
                        <td style={{ whiteSpace: 'nowrap' }} className="muted">
                          {fmtDateShort(trip.start_date)} – {fmtDateShort(trip.end_date)}
                        </td>
                        <td className="muted">{tripDuration(trip.start_date, trip.end_date)}</td>
                        <td className="muted">{trip.people_count} orang</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem' }}>
                          {trip.est_budget_per_person ? fmtRp(trip.est_budget_per_person) : <span className="muted">—</span>}
                        </td>
                        <td className="actions" onClick={e => e.stopPropagation()}>
                          <div className="row-actions">
                            <button className="btn-icon" onClick={() => { setEditTrip(trip); setShowAdd(true) }}>✏</button>
                            <button className="btn-icon del" onClick={() => handleDelete(trip.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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

function TripCardUpcoming({ trip, onView, onEdit, onDelete }) {
  const days  = daysUntil(trip.start_date)
  const itin  = parseItin(trip.itinerary)

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
        <span>👤 {trip.people_count} orang</span>
        {trip.est_budget_per_person > 0 && (
          <span>💰 {fmtRp(trip.est_budget_per_person)}/orang</span>
        )}
      </div>

      {itin && itin.length > 0 && (
        <div className="itin-card-preview">
          {itin.slice(0, 2).map(d => (
            <div key={d.day} className="itin-preview-day">
              <span className="itin-preview-label">Hari {d.day}</span>
              <span className="itin-preview-acts">{d.activities.join(' → ')}</span>
            </div>
          ))}
          {itin.length > 2 && (
            <div className="itin-preview-more">+{itin.length - 2} hari lagi →</div>
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
  const itin       = parseItin(trip.itinerary)
  const totalBudget = (trip.est_budget_per_person || 0) * (trip.people_count || 1)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ fontSize: '1.05rem' }}>{trip.destination}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 3 }}>
              {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
              &nbsp;·&nbsp;{tripDuration(trip.start_date, trip.end_date)}
              &nbsp;·&nbsp;{trip.people_count} orang
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {trip.est_budget_per_person > 0 && (
            <div className="itin-budget-bar">
              <div>
                <div className="itin-budget-label">Estimasi / orang</div>
                <div className="itin-budget-val">{fmtRp(trip.est_budget_per_person)}</div>
              </div>
              {trip.people_count > 1 && (
                <div style={{ textAlign: 'right' }}>
                  <div className="itin-budget-label">Total {trip.people_count} orang</div>
                  <div className="itin-budget-val" style={{ color: 'var(--amber)' }}>{fmtRp(totalBudget)}</div>
                </div>
              )}
            </div>
          )}

          {itin && itin.length > 0 ? (
            <div className="itin-timeline">
              {itin.map(d => (
                <div key={d.day} className="itin-tl-day">
                  <div className="itin-tl-label">
                    <div className="itin-tl-dot" />
                    Hari {d.day}
                  </div>
                  <div className="itin-tl-acts">
                    {d.activities.map((act, i) => (
                      <div key={i} className="itin-tl-act">
                        <span className="itin-tl-arrow">{i < d.activities.length - 1 ? '→' : '◎'}</span>
                        {act}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '2rem 0' }}>Belum ada detail itinerary</div>
          )}

          {trip.notes && (
            <div className="itin-notes">
              <div className="itin-notes-label">Catatan</div>
              <div className="itin-notes-body">{trip.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TripModal({ trip, uid, onClose, onSaved, showToast }) {
  const today = new Date().toISOString().split('T')[0]

  const initDays = () => {
    if (!trip?.itinerary) return [{ day: 1, activities: '' }]
    const raw = parseItin(trip.itinerary) || []
    return raw.map(d => ({ day: d.day, activities: d.activities.join('\n') }))
  }

  const [form, setForm] = useState({
    destination:           trip?.destination                   || '',
    start_date:            trip?.start_date                    || today,
    end_date:              trip?.end_date                      || today,
    people_count:          trip?.people_count?.toString()      || '1',
    est_budget_per_person: trip?.est_budget_per_person?.toString() || '',
    status:                trip?.status                        || 'upcoming',
    notes:                 trip?.notes                         || '',
  })
  const [days,   setDays]   = useState(initDays)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const calcDuration = (s, e) => {
    if (!s || !e || e < s) return 0
    const [y1,m1,d1] = s.split('-')
    const [y2,m2,d2] = e.split('-')
    return Math.round((new Date(+y2,+m2-1,+d2) - new Date(+y1,+m1-1,+d1)) / 86400000) + 1
  }

  const duration = calcDuration(form.start_date, form.end_date)

  const syncDays = (start, end) => {
    const n = calcDuration(start, end)
    if (n > 0) {
      setDays(prev => Array.from({ length: n }, (_, i) => ({
        day: i + 1,
        activities: prev[i]?.activities || '',
      })))
    }
  }

  const setDate = (k, v) => {
    const updated = { ...form, [k]: v }
    set(k, v)
    if (updated.start_date && updated.end_date && updated.end_date >= updated.start_date) {
      syncDays(updated.start_date, updated.end_date)
    }
  }

  const save = async () => {
    if (!form.destination.trim() || !form.start_date || !form.end_date) {
      setErr('Destinasi dan tanggal wajib diisi'); return
    }
    if (form.end_date < form.start_date) {
      setErr('Tanggal selesai harus setelah tanggal mulai'); return
    }
    setSaving(true)

    const itinData = days
      .map(d => ({ day: d.day, activities: d.activities.split('\n').map(a => a.trim()).filter(Boolean) }))
      .filter(d => d.activities.length)

    const payload = {
      user_id:               uid,
      destination:           form.destination.trim(),
      start_date:            form.start_date,
      end_date:              form.end_date,
      people_count:          parseInt(form.people_count)          || 1,
      est_budget_per_person: parseInt(form.est_budget_per_person) || 0,
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
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">{trip ? 'Edit Trip' : '+ Trip Baru'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div className="field">
            <label>Destinasi</label>
            <input type="text" placeholder="Bali, Yogyakarta, Tokyo…" value={form.destination} onChange={e => set('destination', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Tanggal Mulai</label>
              <input type="date" value={form.start_date} onChange={e => setDate('start_date', e.target.value)} />
            </div>
            <div className="field">
              <label>Tanggal Selesai</label>
              <input type="date" value={form.end_date} onChange={e => setDate('end_date', e.target.value)} />
            </div>
          </div>

          {duration > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: -6, marginBottom: 12 }}>
              {duration} hari
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>Jumlah Orang</label>
              <input type="number" min="1" placeholder="2" value={form.people_count} onChange={e => set('people_count', e.target.value)} />
            </div>
            <div className="field">
              <label>Est. Budget / orang (Rp)</label>
              <input type="number" placeholder="3200000" value={form.est_budget_per_person} onChange={e => set('est_budget_per_person', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="upcoming">Upcoming</option>
              <option value="done">Selesai</option>
            </select>
          </div>

          {duration > 0 && (
            <div className="itin-day-editor">
              <div className="itin-day-editor-title">Itinerary per hari (opsional)</div>
              {days.map((d, i) => (
                <div key={d.day} className="field">
                  <label>Hari {d.day}</label>
                  <textarea
                    className="itin-day-textarea"
                    placeholder={'Satu aktivitas per baris:\nTiba bandara\nCheck-in hotel\nMakan malam'}
                    value={d.activities}
                    rows={3}
                    onChange={e => {
                      const next = [...days]
                      next[i] = { ...next[i], activities: e.target.value }
                      setDays(next)
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="field">
            <label>Catatan (opsional)</label>
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
