// src/pages/MountainHiking.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'
import Toast from '../components/Toast'

const STATUS = {
  summit: { label: 'Summit',  color: '#3dba7e', bg: 'rgba(61,186,126,0.12)',  bd: 'rgba(61,186,126,0.28)' },
  kawah:  { label: 'Kawah',   color: '#e9a229', bg: 'rgba(233,162,41,0.10)', bd: 'rgba(233,162,41,0.28)' },
  camp:   { label: 'Camp',    color: '#4a90d9', bg: 'rgba(74,144,217,0.10)',  bd: 'rgba(74,144,217,0.28)' },
  failed: { label: 'Failed',  color: '#e05252', bg: 'rgba(224,82,82,0.10)',   bd: 'rgba(224,82,82,0.28)'  },
}

// 7 Summit of Java (ranked by elevation)
const SEVEN_SUMMIT_JAVA = {
  semeru: 1, slamet: 2, sumbing: 3, arjuno: 4,
  lawu: 5, welirang: 6, merbabu: 7,
}

// Notable peaks in Indonesia
const INDONESIA_NOTABLE = {
  semeru:   '#1 Jawa',
  slamet:   '#2 Jawa',
  sumbing:  '#3 Jawa',
  kerinci:  '#1 Sumatera',
  rinjani:  '#1 NTB',
  binaiya:  '#1 Maluku',
  latimojong: '#1 Sulawesi',
  carstensz: '#1 Indonesia',
}

function getHikeBadges(name) {
  const key = (name || '').toLowerCase().trim()
  const badges = []
  if (SEVEN_SUMMIT_JAVA[key] !== undefined) {
    badges.push({ text: `7SJ #${SEVEN_SUMMIT_JAVA[key]}`, color: '#e9a229', bg: 'rgba(233,162,41,0.13)' })
  }
  if (INDONESIA_NOTABLE[key]) {
    badges.push({ text: INDONESIA_NOTABLE[key], color: '#8b7de8', bg: 'rgba(139,125,232,0.13)' })
  }
  return badges
}

const fmtDateRange = (s, e) => {
  if (!s) return '—'
  const parse = d => { const [y,m,dd] = d.split('-'); return new Date(+y, +m-1, +dd) }
  const dS = parse(s), dE = e ? parse(e) : dS
  const optShort = { day: 'numeric', month: 'short' }
  const optFull  = { day: 'numeric', month: 'short', year: 'numeric' }
  if (s === e || !e) return dS.toLocaleDateString('id-ID', optFull)
  const sameMonth = s.slice(0,7) === e.slice(0,7)
  if (sameMonth) return `${dS.getDate()}–${dE.getDate()} ${dS.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`
  return `${dS.toLocaleDateString('id-ID', optShort)} – ${dE.toLocaleDateString('id-ID', optFull)}`
}

function hikeDuration(start, end) {
  if (!start || !end) return '—'
  const parse = d => { const [y,m,dd] = d.split('-'); return new Date(+y,+m-1,+dd) }
  const days   = Math.round((parse(end) - parse(start)) / 86400000) + 1
  const nights = days - 1
  if (nights === 0) return '1 hari (PP)'
  return `${days}h ${nights}m`
}

const SEED_HIKES = [
  { mountain: 'Semeru',       elevation: 3676, city: 'Lumajang',    start_date: '2023-10-12', end_date: '2023-10-15', status: 'summit', notes: null },
  { mountain: 'Arjuno',       elevation: 3339, city: 'Pasuruan',    start_date: '2023-06-03', end_date: '2023-06-05', status: 'summit', notes: 'Traverse sekaligus Welirang' },
  { mountain: 'Welirang',     elevation: 3156, city: 'Pasuruan',    start_date: '2023-06-03', end_date: '2023-06-05', status: 'summit', notes: 'Satu trip traverse bersama Arjuno' },
  { mountain: 'Lawu',         elevation: 3265, city: 'Karanganyar', start_date: '2023-01-14', end_date: '2023-01-15', status: 'summit', notes: null },
  { mountain: 'Bromo',        elevation: 2329, city: 'Probolinggo', start_date: '2024-12-14', end_date: '2024-12-15', status: 'kawah',  notes: null },
  { mountain: 'Penanggungan', elevation: 1653, city: 'Mojokerto',   start_date: '2022-04-17', end_date: '2022-04-17', status: 'summit', notes: null },
]

function ElevationChart({ hikes }) {
  if (!hikes.length) return null
  const sorted = [...hikes].sort((a, b) => (b.elevation||0) - (a.elevation||0))
  const maxE = Math.max(...sorted.map(h => h.elevation || 0), 100)

  return (
    <div className="hike-chart-wrap">
      <div className="hike-chart">
        {sorted.map(h => {
          const pct = ((h.elevation||0) / maxE) * 100
          const st = STATUS[h.status] || STATUS.summit
          return (
            <div key={h.id || h.mountain} className="hike-chart-col" title={`${h.mountain} — ${(h.elevation||0).toLocaleString('id-ID')} mdpl`}>
              <div className="hike-chart-elev-num">{((h.elevation||0)/1000).toFixed(1)}k</div>
              <div className="hike-chart-bar-wrap">
                <div className="hike-chart-bar" style={{ height: `${pct}%`, background: st.color }} />
              </div>
              <div className="hike-chart-label">{h.mountain}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MountainHiking({ session, onHome }) {
  const [hikes,    setHikes]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sort,     setSort]     = useState('date')
  const [showAdd,  setShowAdd]  = useState(false)
  const [editHike, setEditHike] = useState(null)
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

  const fetchHikes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('hikes').select('*').eq('user_id', uid).order('start_date', { ascending: false })

    if (error) {
      showToast('Setup tabel Supabase dibutuhkan. Jalankan SQL migration.', 'error')
      setLoading(false)
      return
    }

    if (!data.length) {
      const { data: seeded } = await supabase
        .from('hikes').insert(SEED_HIKES.map(h => ({ ...h, user_id: uid }))).select()
      setHikes(seeded || [])
    } else {
      setHikes(data)
    }
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchHikes() }, [fetchHikes])

  const handleDelete = async (id) => {
    await supabase.from('hikes').delete().eq('id', id).eq('user_id', uid)
    setHikes(prev => prev.filter(h => h.id !== id))
    showToast('Catatan dihapus')
  }

  const parse = d => { if (!d) return 0; const [y,m,dd]=d.split('-'); return new Date(+y,+m-1,+dd) }
  const totalDays = hikes.reduce((s, h) => s + Math.round((parse(h.end_date) - parse(h.start_date)) / 86400000) + 1, 0)
  const summits   = hikes.filter(h => h.status === 'summit').length
  const highest   = hikes.length ? hikes.reduce((a,b) => (a.elevation||0) > (b.elevation||0) ? a : b) : null

  const sorted  = [...hikes].sort((a, b) =>
    sort === 'elev'
      ? (b.elevation||0) - (a.elevation||0)
      : parse(b.start_date) - parse(a.start_date)
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand" style={{ cursor: 'pointer' }} onClick={onHome}>
          ▲ <span>Mountain Hiking</span>
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
        <div className="loading-state">Memuat data pendakian...</div>
      ) : (
        <main className="main-content">
          {/* Stats */}
          <div className="hike-stats">
            <div className="hike-stat">
              <div className="hike-stat-val">{hikes.length}</div>
              <div className="hike-stat-label">Gunung</div>
            </div>
            <div className="hike-stat">
              <div className="hike-stat-val" style={{ color: 'var(--green)' }}>{summits}</div>
              <div className="hike-stat-label">Summit</div>
            </div>
            <div className="hike-stat">
              <div className="hike-stat-val" style={{ color: 'var(--purple)' }}>
                {highest ? (highest.elevation||0).toLocaleString('id-ID') : '—'}
              </div>
              <div className="hike-stat-label">Tertinggi (mdpl)</div>
            </div>
            <div className="hike-stat">
              <div className="hike-stat-val" style={{ color: 'var(--blue)' }}>{totalDays}</div>
              <div className="hike-stat-label">Total Hari</div>
            </div>
          </div>

          {/* Elevation Chart */}
          {hikes.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                <div className="section-title">Elevation Chart</div>
              </div>
              <ElevationChart hikes={hikes} />
            </div>
          )}

          {/* Log Pendakian */}
          <div className="section-header">
            <div className="section-title">Log Pendakian</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="hike-sort-wrap">
                <button className={`hike-sort-btn${sort === 'date' ? ' active' : ''}`} onClick={() => setSort('date')}>
                  Terbaru
                </button>
                <button className={`hike-sort-btn${sort === 'elev' ? ' active' : ''}`} onClick={() => setSort('elev')}>
                  Tertinggi
                </button>
              </div>
              <button className="btn-add" onClick={() => { setEditHike(null); setShowAdd(true) }}>
                + Catat Pendakian
              </button>
            </div>
          </div>

          <div className="hike-list">
            {sorted.map(h => {
              const st     = STATUS[h.status] || STATUS.summit
              const badges = getHikeBadges(h.mountain)
              return (
                <div key={h.id} className="hike-card">
                  <div className="hike-card-accent" style={{ background: st.color }} />
                  <div className="hike-card-body">
                    <div className="hike-card-row1">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="hike-card-name">{h.mountain}</div>
                        {badges.map(b => (
                          <span key={b.text} className="hike-summit-badge" style={{ color: b.color, background: b.bg }}>
                            {b.text}
                          </span>
                        ))}
                      </div>
                      <span className="hike-status-badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.bd}`, flexShrink: 0 }}>
                        {st.label}
                      </span>
                    </div>
                    <div className="hike-card-elev-row">
                      <span className="hike-card-elev-num">▲ {(h.elevation||0).toLocaleString('id-ID')} mdpl</span>
                      {h.city && <span className="hike-card-city">📍 {h.city}</span>}
                    </div>
                    <div className="hike-card-meta">
                      <span>📅 {fmtDateRange(h.start_date, h.end_date)}</span>
                      <span>⏱ {hikeDuration(h.start_date, h.end_date)}</span>
                    </div>
                    {h.notes && <div className="hike-card-notes">{h.notes}</div>}
                    {h.photos_url && (
                      <a
                        href={h.photos_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hike-photos-link"
                        onClick={e => e.stopPropagation()}
                      >
                        📷 Lihat Foto →
                      </a>
                    )}
                  </div>
                  <div className="hike-card-actions">
                    <button className="btn-icon" onClick={() => { setEditHike(h); setShowAdd(true) }}>✏</button>
                    <button className="btn-icon del" onClick={() => handleDelete(h.id)}>✕</button>
                  </div>
                </div>
              )
            })}
            {hikes.length === 0 && (
              <div className="empty-state">Belum ada catatan pendakian</div>
            )}
          </div>
        </main>
      )}

      {showAdd && (
        <HikeModal
          hike={editHike} uid={uid}
          onClose={() => setShowAdd(false)}
          onSaved={fetchHikes}
          showToast={showToast}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

function HikeModal({ hike, uid, onClose, onSaved, showToast }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    mountain:   hike?.mountain              || '',
    elevation:  hike?.elevation?.toString() || '',
    city:       hike?.city                  || '',
    start_date: hike?.start_date            || today,
    end_date:   hike?.end_date              || today,
    status:     hike?.status                || 'summit',
    photos_url: hike?.photos_url            || '',
    notes:      hike?.notes                 || '',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const QUICK_MOUNTAINS = [
    'Semeru', 'Arjuno', 'Welirang', 'Lawu', 'Bromo', 'Penanggungan',
    'Raung', 'Argopuro', 'Ijen', 'Rinjani', 'Merbabu', 'Merapi', 'Slamet',
  ]

  const save = async () => {
    if (!form.mountain.trim() || !form.start_date) {
      setErr('Nama gunung dan tanggal berangkat wajib diisi'); return
    }
    if (form.end_date && form.end_date < form.start_date) {
      setErr('Tanggal pulang harus setelah tanggal berangkat'); return
    }
    setSaving(true)
    const payload = {
      user_id:    uid,
      mountain:   form.mountain.trim(),
      elevation:  parseInt(form.elevation)   || null,
      city:       form.city.trim()           || null,
      start_date: form.start_date,
      end_date:   form.end_date || form.start_date,
      status:     form.status,
      photos_url: form.photos_url.trim()     || null,
      notes:      form.notes.trim()          || null,
    }
    let error
    if (hike) {
      ;({ error } = await supabase.from('hikes').update(payload).eq('id', hike.id).eq('user_id', uid))
    } else {
      ;({ error } = await supabase.from('hikes').insert(payload))
    }
    if (error) { setSaving(false); setErr(error.message); return }
    showToast(hike ? 'Catatan diperbarui' : 'Pendakian dicatat!')
    onClose()
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">{hike ? 'Edit Pendakian' : '+ Catat Pendakian Baru'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="field">
            <label>Nama Gunung</label>
            <input type="text" placeholder="Semeru, Rinjani, Merbabu…" value={form.mountain} onChange={e => set('mountain', e.target.value)} />
            <div className="svc-quick-types">
              {QUICK_MOUNTAINS.map(m => (
                <button key={m} type="button" className="svc-quick-type-btn" onClick={() => set('mountain', m)}>{m}</button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Ketinggian (mdpl)</label>
              <input type="number" placeholder="3676" value={form.elevation} onChange={e => set('elevation', e.target.value)} />
            </div>
            <div className="field">
              <label>Kota / Lokasi</label>
              <input type="text" placeholder="Lumajang, Malang…" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Tanggal Berangkat</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="field">
              <label>Tanggal Pulang</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Status Pendakian</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="summit">Summit</option>
              <option value="kawah">Kawah</option>
              <option value="camp">Camp saja</option>
              <option value="failed">Tidak berhasil</option>
            </select>
          </div>

          <div className="field">
            <label>Link Google Photos Album (opsional)</label>
            <input
              type="url"
              placeholder="https://photos.google.com/album/…"
              value={form.photos_url}
              onChange={e => set('photos_url', e.target.value)}
            />
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 4 }}>
              Paste link album Google Photos untuk akses cepat dari kartu gunung
            </div>
          </div>

          <div className="field">
            <label>Catatan (opsional)</label>
            <input type="text" placeholder="Kondisi jalur, cerita singkat, dll." value={form.notes} onChange={e => set('notes', e.target.value)} />
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
