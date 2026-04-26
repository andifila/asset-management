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

const RECO = [
  { mountain: 'Raung',    elevation: 3332, province: 'Jawa Timur',  diff: 'Expert', note: 'Kawah aktif raksasa, jalur pasir sempit ekstrem. Satu-satunya gunung 3000+ di Jatim yang belum kamu taklukkan.' },
  { mountain: 'Argopuro', elevation: 3088, province: 'Jawa Timur',  diff: 'Hard',   note: 'Rute terpanjang di Pulau Jawa (~50 km). Padang savana, danau, dan jalur super sepi. Epic banget.' },
  { mountain: 'Rinjani',  elevation: 3726, province: 'Lombok (NTB)', diff: 'Hard',   note: 'Level berikutnya setelah Semeru. Danau Segara Anak di kaldera. Puncak tertinggi ke-2 di Indonesia.' },
  { mountain: 'Ijen',     elevation: 2386, province: 'Jawa Timur',  diff: 'Medium', note: 'Blue fire & kawah belerang terbesar di dunia. Aksesibel dari Malang, cocok untuk weekend trip.' },
]

const fmtDateRange = (s, e) => {
  if (!s) return '—'
  const parse = d => { const [y,m,dd] = d.split('-'); return new Date(+y, +m-1, +dd) }
  const dS = parse(s), dE = parse(e)
  const optShort = { day: 'numeric', month: 'short' }
  const optFull  = { day: 'numeric', month: 'short', year: 'numeric' }
  if (s === e) return dS.toLocaleDateString('id-ID', optFull)
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
  { mountain: 'Semeru',       elevation: 3676, start_date: '2023-10-12', end_date: '2023-10-15', route: 'Via Ranu Pani',     status: 'summit', members: 1, notes: null },
  { mountain: 'Arjuno',       elevation: 3339, start_date: '2023-06-03', end_date: '2023-06-05', route: 'Via Tretes',        status: 'summit', members: 1, notes: 'Traverse sekaligus Welirang' },
  { mountain: 'Welirang',     elevation: 3156, start_date: '2023-06-03', end_date: '2023-06-05', route: 'Traverse Arjuno',   status: 'summit', members: 1, notes: 'Satu trip traverse bersama Arjuno' },
  { mountain: 'Lawu',         elevation: 3265, start_date: '2023-01-14', end_date: '2023-01-15', route: 'Via Cemoro Sewu',   status: 'summit', members: 1, notes: null },
  { mountain: 'Bromo',        elevation: 2329, start_date: '2024-12-14', end_date: '2024-12-15', route: 'Via Cemoro Lawang', status: 'kawah',  members: 3, notes: null },
  { mountain: 'Penanggungan', elevation: 1653, start_date: '2022-04-17', end_date: '2022-04-17', route: 'Via Jolotundo',     status: 'summit', members: 1, notes: null },
]

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
  const totalElev = hikes.reduce((s,h) => s + (h.elevation||0), 0)

  const maxElev = 4000
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
              const st      = STATUS[h.status] || STATUS.summit
              const elevPct = Math.round(((h.elevation || 0) / maxElev) * 100)
              return (
                <div key={h.id} className="hike-card">
                  <div className="hike-card-accent" style={{ background: st.color }} />
                  <div className="hike-card-body">
                    <div className="hike-card-row1">
                      <div className="hike-card-name">{h.mountain}</div>
                      <span className="hike-status-badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.bd}` }}>
                        {st.label}
                      </span>
                    </div>
                    <div className="hike-card-row2">
                      <span className="hike-card-elev-num">▲ {(h.elevation||0).toLocaleString('id-ID')} mdpl</span>
                      <div className="hike-elev-track">
                        <div className="hike-elev-fill" style={{ width: `${elevPct}%`, background: st.color }} />
                      </div>
                      <span className="hike-elev-pct" style={{ color: st.color }}>{elevPct}%</span>
                    </div>
                    <div className="hike-card-meta">
                      <span>📅 {fmtDateRange(h.start_date, h.end_date)}</span>
                      <span>⏱ {hikeDuration(h.start_date, h.end_date)}</span>
                      {h.route && <span>↑ {h.route}</span>}
                      {h.members > 1 && <span>👤 {h.members} orang</span>}
                    </div>
                    {h.notes && <div className="hike-card-notes">{h.notes}</div>}
                  </div>
                  <div className="hike-card-actions">
                    <button className="btn-icon" onClick={() => { setEditHike(h); setShowAdd(true) }}>✏</button>
                    <button className="btn-icon del" onClick={() => handleDelete(h.id)}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Rekomendasi */}
          <div className="section-header" style={{ marginTop: '0.5rem' }}>
            <div className="section-title">Rekomendasi Berikutnya</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Dari Malang · Level kamu: Expert</span>
          </div>
          <div className="hike-reco-grid">
            {RECO.map(r => (
              <div key={r.mountain} className="hike-reco-card">
                <div className="hike-reco-top">
                  <div className="hike-reco-name">{r.mountain}</div>
                  <span className={`hike-reco-diff hike-diff-${r.diff.toLowerCase()}`}>{r.diff}</span>
                </div>
                <div className="hike-reco-elev">▲ {r.elevation.toLocaleString('id-ID')} mdpl · {r.province}</div>
                <div className="hike-reco-note">{r.note}</div>
              </div>
            ))}
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
    start_date: hike?.start_date            || today,
    end_date:   hike?.end_date              || today,
    route:      hike?.route                 || '',
    status:     hike?.status                || 'summit',
    members:    hike?.members?.toString()   || '1',
    notes:      hike?.notes                 || '',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const QUICK_MOUNTAINS = [
    'Semeru', 'Arjuno', 'Welirang', 'Lawu', 'Bromo', 'Penanggungan',
    'Raung', 'Argopuro', 'Ijen', 'Rinjani', 'Merbabu', 'Merapi',
  ]

  const save = async () => {
    if (!form.mountain.trim() || !form.start_date) {
      setErr('Nama gunung dan tanggal berangkat wajib diisi'); return
    }
    if (form.end_date < form.start_date) {
      setErr('Tanggal pulang harus setelah tanggal berangkat'); return
    }
    setSaving(true)
    const payload = {
      user_id:    uid,
      mountain:   form.mountain.trim(),
      elevation:  parseInt(form.elevation)   || null,
      start_date: form.start_date,
      end_date:   form.end_date || form.start_date,
      route:      form.route.trim()          || null,
      status:     form.status,
      members:    parseInt(form.members)     || 1,
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
        <div className="modal-body">
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
              <label>Status Pendakian</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="summit">Summit</option>
                <option value="kawah">Kawah</option>
                <option value="camp">Camp saja</option>
                <option value="failed">Tidak berhasil</option>
              </select>
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

          <div className="field-row">
            <div className="field">
              <label>Rute / Jalur</label>
              <input type="text" placeholder="Via Ranu Pani, Via Tretes…" value={form.route} onChange={e => set('route', e.target.value)} />
            </div>
            <div className="field">
              <label>Jumlah Orang</label>
              <input type="number" min="1" placeholder="1" value={form.members} onChange={e => set('members', e.target.value)} />
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
