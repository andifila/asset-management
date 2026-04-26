// src/pages/VehicleService.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'
import Toast from '../components/Toast'

const COMPONENTS = [
  { id: 'oli',    label: 'Oli Mesin',    icon: '⬥', keys: ['oli', 'oil'],             kmInt: 2000,  dayInt: 90,  color: 'var(--amber)'  },
  { id: 'filter', label: 'Filter Udara', icon: '▣', keys: ['filter'],                 kmInt: 15000, dayInt: 365, color: 'var(--blue)'   },
  { id: 'busi',   label: 'Busi',         icon: '◇', keys: ['busi', 'spark'],          kmInt: 12000, dayInt: 540, color: 'var(--purple)' },
  { id: 'ban',    label: 'Ban Belakang', icon: '◎', keys: ['ban belakang', 'rear'],   kmInt: 18000, dayInt: null, color: 'var(--green)' },
  { id: 'cvt',    label: 'CVT / V-Belt', icon: '⚙', keys: ['cvt', 'belt'],           kmInt: 8000,  dayInt: null, color: 'var(--red)'   },
]

const LVL = {
  ok:      { txt: 'OK',        color: '#3dba7e', bg: 'rgba(61,186,126,0.10)',  bd: 'rgba(61,186,126,0.22)'  },
  due:     { txt: 'Segera',    color: '#e9a229', bg: 'rgba(233,162,41,0.09)', bd: 'rgba(233,162,41,0.22)'  },
  overdue: { txt: 'Terlambat', color: '#e05252', bg: 'rgba(224,82,82,0.09)',  bd: 'rgba(224,82,82,0.22)'   },
  nodata:  { txt: 'Cek',       color: '#5a6b8a', bg: 'rgba(255,255,255,0.02)',bd: 'rgba(255,255,255,0.07)' },
}

function compStatus(comp, records, kmNow) {
  const hits = records
    .filter(r => comp.keys.some(k => (r.service_type || '').toLowerCase().includes(k)))
    .sort((a, b) => new Date(b.service_date) - new Date(a.service_date))
  if (!hits.length) return { lvl: 'nodata', last: null, kmAgo: null, dAgo: null, pct: null }
  const last = hits[0]
  const kmAgo = kmNow - (last.km_at_service || 0)
  const dAgo  = Math.floor((Date.now() - new Date(last.service_date)) / 86400000)
  const pKm   = comp.kmInt  ? kmAgo / comp.kmInt  : 0
  const pDay  = comp.dayInt ? dAgo  / comp.dayInt : 0
  const pct   = Math.max(pKm, pDay)
  const lvl   = pct >= 1 ? 'overdue' : pct >= 0.8 ? 'due' : 'ok'
  return { lvl, last, kmAgo, dAgo, pct }
}

const fmtRp   = n => n ? 'Rp ' + Number(n).toLocaleString('id-ID') : '—'
const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtKm   = k => k != null ? k.toLocaleString('id-ID') + ' km' : '—'

const DEFAULT_VEHICLE = { name: 'Honda Vario 125', plate: 'B 4829 XAD', year: null, km_current: 21350 }

const SEED_RECORDS = [
  { service_date: '2025-01-12', km_at_service: 18420, service_type: 'Ganti oli + filter udara', shop: 'Ahass Malang', cost: 185000, notes: null },
  { service_date: '2024-08-05', km_at_service: 16100, service_type: 'Tune up + ganti busi',     shop: 'Ahass',        cost: 270000, notes: null },
  { service_date: '2024-03-20', km_at_service: 13840, service_type: 'Ganti ban belakang',        shop: null,           cost: 320000, notes: null },
]

export default function VehicleService({ session, onHome }) {
  const [vehicle, setVehicle] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [kmEdit,  setKmEdit]  = useState(false)
  const [kmVal,   setKmVal]   = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editRec, setEditRec] = useState(null)
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [vRes, rRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('service_records').select('*').eq('user_id', uid).order('service_date', { ascending: false }),
    ])

    if (vRes.error || rRes.error) {
      showToast('Setup tabel Supabase dibutuhkan. Jalankan SQL migration terlebih dahulu.', 'error')
      setLoading(false)
      return
    }

    let v = vRes.data
    let r = rRes.data || []

    if (!v) {
      const { data: newV } = await supabase
        .from('vehicles').insert({ ...DEFAULT_VEHICLE, user_id: uid }).select().single()
      v = newV
      if (v && !r.length) {
        const { data: seeded } = await supabase
          .from('service_records')
          .insert(SEED_RECORDS.map(s => ({ ...s, user_id: uid, vehicle_id: v.id })))
          .select()
        r = seeded || []
      }
    }

    setVehicle(v)
    setRecords(r)
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchData() }, [fetchData])

  const updateKm = async () => {
    const km = parseInt(kmVal)
    if (!isNaN(km) && km >= 0 && vehicle) {
      setVehicle(prev => ({ ...prev, km_current: km }))
      await supabase.from('vehicles').update({ km_current: km }).eq('id', vehicle.id).eq('user_id', uid)
      showToast('KM diperbarui')
    }
    setKmEdit(false)
  }

  const handleDelete = async (id) => {
    await supabase.from('service_records').delete().eq('id', id).eq('user_id', uid)
    setRecords(prev => prev.filter(r => r.id !== id))
    showToast('Catatan dihapus')
  }

  const kmNow = vehicle?.km_current || 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand" style={{ cursor: 'pointer' }} onClick={onHome}>
          ⚙ <span>Service Kendaraan</span>
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
        <div className="loading-state">Memuat data servis...</div>
      ) : (
        <main className="main-content">
          {/* Vehicle Header */}
          <div className="svc-vehicle-card">
            <div className="svc-vehicle-left">
              <div className="svc-vehicle-icon">⚙</div>
              <div>
                <div className="svc-vehicle-name">{vehicle?.name || '—'}</div>
                <div className="svc-vehicle-meta">
                  <span className="badge badge-amber">{vehicle?.plate || '—'}</span>
                  {vehicle?.year && <span className="svc-vehicle-year">{vehicle.year}</span>}
                </div>
              </div>
            </div>
            <div className="svc-km-block">
              <div className="svc-km-label">KM Sekarang</div>
              {kmEdit ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    className="svc-km-input"
                    type="number"
                    value={kmVal}
                    onChange={e => setKmVal(e.target.value)}
                    onBlur={updateKm}
                    onKeyDown={e => {
                      if (e.key === 'Enter') updateKm()
                      if (e.key === 'Escape') setKmEdit(false)
                    }}
                    autoFocus
                  />
                  <span className="svc-km-unit">km</span>
                </div>
              ) : (
                <div
                  className="svc-km-val"
                  onClick={() => { setKmVal(kmNow.toString()); setKmEdit(true) }}
                  title="Klik untuk update KM"
                >
                  {kmNow.toLocaleString('id-ID')}
                  <span className="svc-km-unit">km</span>
                  <span className="svc-km-edit-hint">✏</span>
                </div>
              )}
            </div>
          </div>

          {/* Component Status Cards */}
          <div className="svc-status-grid">
            {COMPONENTS.map(comp => {
              const s  = compStatus(comp, records, kmNow)
              const lv = LVL[s.lvl]
              return (
                <div key={comp.id} className="svc-status-card" style={{ background: lv.bg, borderColor: lv.bd }}>
                  <div className="svc-status-top">
                    <span className="svc-status-icon" style={{ color: comp.color }}>{comp.icon}</span>
                    <span className="svc-status-badge" style={{ color: lv.color }}>{lv.txt}</span>
                  </div>
                  <div className="svc-status-name">{comp.label}</div>
                  <div className="svc-status-meta">
                    {s.last ? (
                      <>
                        <span>{fmtKm(s.kmAgo)} lalu</span>
                        {comp.dayInt && <span> · {s.dAgo}h</span>}
                      </>
                    ) : (
                      <span>Tidak ada data</span>
                    )}
                  </div>
                  {s.last && s.pct !== null && (
                    <div className="svc-status-progress">
                      <div className="svc-status-bar">
                        <div
                          className="svc-status-fill"
                          style={{ width: `${Math.min(s.pct * 100, 100)}%`, background: lv.color }}
                        />
                      </div>
                      <span className="svc-status-pct" style={{ color: lv.color }}>{Math.round(s.pct * 100)}%</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Service History */}
          <div className="section-header">
            <div className="section-title">Riwayat Servis</div>
            <button className="btn-add" onClick={() => { setEditRec(null); setShowAdd(true) }}>+ Catat Servis</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>KM</th>
                  <th>Jenis Servis</th>
                  <th>Bengkel</th>
                  <th className="num">Biaya</th>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">Belum ada catatan servis</td></tr>
                ) : records.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.service_date)}</td>
                    <td><span className="svc-km-cell">{r.km_at_service?.toLocaleString('id-ID')} km</span></td>
                    <td>{r.service_type}</td>
                    <td>{r.shop || <span className="muted">—</span>}</td>
                    <td className="num">{fmtRp(r.cost)}</td>
                    <td className="actions">
                      <div className="row-actions">
                        <button className="btn-icon" title="Edit" onClick={() => { setEditRec(r); setShowAdd(true) }}>✏</button>
                        <button className="btn-icon del" title="Hapus" onClick={() => handleDelete(r.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="muted" style={{ fontSize: '0.72rem' }}>{records.length} catatan</td>
                    <td className="num" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem', color: 'var(--text)' }}>
                      {fmtRp(records.reduce((s, r) => s + (r.cost || 0), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </main>
      )}

      {showAdd && (
        <ServiceModal
          record={editRec}
          vehicle={vehicle}
          uid={uid}
          onClose={() => setShowAdd(false)}
          onSaved={fetchData}
          showToast={showToast}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

function ServiceModal({ record, vehicle, uid, onClose, onSaved, showToast }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    service_date:  record?.service_date             || today,
    km_at_service: record?.km_at_service?.toString() || '',
    service_type:  record?.service_type             || '',
    shop:          record?.shop                     || '',
    cost:          record?.cost?.toString()         || '',
    notes:         record?.notes                    || '',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const QUICK = [
    'Ganti oli', 'Ganti oli + filter udara', 'Ganti busi',
    'Tune up', 'Servis CVT / belt', 'Ganti ban belakang', 'Ganti ban depan',
  ]

  const save = async () => {
    if (!form.service_date || !form.service_type.trim()) {
      setErr('Tanggal dan jenis servis wajib diisi')
      return
    }
    setSaving(true)
    const payload = {
      user_id:       uid,
      vehicle_id:    vehicle?.id,
      service_date:  form.service_date,
      km_at_service: parseInt(form.km_at_service) || null,
      service_type:  form.service_type.trim(),
      shop:          form.shop.trim()  || null,
      cost:          parseInt(form.cost) || 0,
      notes:         form.notes.trim() || null,
    }
    let error
    if (record) {
      ;({ error } = await supabase.from('service_records').update(payload).eq('id', record.id).eq('user_id', uid))
    } else {
      ;({ error } = await supabase.from('service_records').insert(payload))
    }
    if (error) { setSaving(false); setErr(error.message); return }

    if (payload.km_at_service && vehicle && payload.km_at_service > (vehicle.km_current || 0)) {
      await supabase.from('vehicles').update({ km_current: payload.km_at_service }).eq('id', vehicle.id).eq('user_id', uid)
    }

    showToast(record ? 'Catatan diperbarui' : 'Servis dicatat!')
    onClose()
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">{record ? 'Edit Catatan Servis' : '+ Catat Servis Baru'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field">
              <label>Tanggal Servis</label>
              <input type="date" value={form.service_date} onChange={e => set('service_date', e.target.value)} />
            </div>
            <div className="field">
              <label>KM Saat Servis</label>
              <input type="number" placeholder="mis. 21350" value={form.km_at_service} onChange={e => set('km_at_service', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Jenis Servis</label>
            <input
              type="text"
              placeholder="Ganti oli + filter udara"
              value={form.service_type}
              onChange={e => set('service_type', e.target.value)}
            />
            <div className="svc-quick-types">
              {QUICK.map(q => (
                <button key={q} type="button" className="svc-quick-type-btn"
                  onClick={() => set('service_type', q)}>{q}</button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Bengkel</label>
              <input type="text" placeholder="Ahass, bengkel, dll." value={form.shop} onChange={e => set('shop', e.target.value)} />
            </div>
            <div className="field">
              <label>Biaya (Rp)</label>
              <input type="number" placeholder="185000" value={form.cost} onChange={e => set('cost', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Catatan (opsional)</label>
            <input type="text" placeholder="Keterangan tambahan" value={form.notes} onChange={e => set('notes', e.target.value)} />
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
