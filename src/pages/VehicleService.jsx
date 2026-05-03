// src/pages/VehicleService.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'
import Toast from '../components/Toast'
import Pagination from '../components/Pagination'

const DEFAULT_COMPONENTS = [
  { id: 'oli',        label: 'Oli Mesin',      icon: '⬥', keys: ['oli', 'oil'],                    kmInt: 2000,  dayInt: 90,  color: 'var(--amber)'  },
  { id: 'service',    label: 'Service',         icon: '⚙', keys: ['service', 'servis', 'tune up'], kmInt: 4000,  dayInt: 90,  color: 'var(--blue)'   },
  { id: 'finaldrive', label: 'Oli Final Drive', icon: '◎', keys: ['final drive', 'gardan'],        kmInt: 8000,  dayInt: 180, color: 'var(--purple)' },
  { id: 'roller',     label: 'Roller',          icon: '◇', keys: ['roller'],                       kmInt: 24000, dayInt: null, color: 'var(--green)' },
  { id: 'belt',       label: 'Drive Belt',      icon: '▣', keys: ['belt', 'drive belt', 'cvt'],   kmInt: 24000, dayInt: null, color: 'var(--red)'   },
]

const LVL = {
  ok:      { key: 'svcStatusOk',      color: '#3dba7e', bg: 'rgba(61,186,126,0.10)',  bd: 'rgba(61,186,126,0.22)'  },
  due:     { key: 'svcStatusDue',     color: '#e9a229', bg: 'rgba(233,162,41,0.09)', bd: 'rgba(233,162,41,0.22)'  },
  overdue: { key: 'svcStatusOverdue', color: '#e05252', bg: 'rgba(224,82,82,0.09)',  bd: 'rgba(224,82,82,0.22)'   },
  nodata:  { key: 'svcStatusNodata',  color: '#5a6b8a', bg: 'rgba(255,255,255,0.02)',bd: 'rgba(255,255,255,0.07)' },
}

function getComponents(vehicle) {
  const cfg = vehicle?.parts_config || {}
  return DEFAULT_COMPONENTS.map(c => ({
    ...c,
    kmInt:  cfg[c.id]?.kmInt  !== undefined ? cfg[c.id].kmInt  : c.kmInt,
    dayInt: cfg[c.id]?.dayInt !== undefined ? cfg[c.id].dayInt : c.dayInt,
  }))
}

function tryParseItems(st) {
  try { const p = JSON.parse(st); if (Array.isArray(p)) return p } catch {}
  return [{ nama: st || '', biaya: '' }]
}

function fmtItems(st) {
  try {
    const p = JSON.parse(st)
    if (Array.isArray(p) && p.length) return p.map(i => i.nama).filter(Boolean).join(' · ')
  } catch {}
  return st || '—'
}

function getServiceText(r) {
  try { const p = JSON.parse(r.service_type || ''); if (Array.isArray(p)) return p.map(i => i.nama || '').join(' ') } catch {}
  return r.service_type || ''
}

function compStatus(comp, records, kmNow) {
  const hits = records
    .filter(r => comp.keys.some(k => getServiceText(r).toLowerCase().includes(k)))
    .sort((a, b) => new Date(b.service_date) - new Date(a.service_date))
  if (!hits.length) return { lvl: 'nodata', last: null, kmAgo: null, dAgo: null, nextKm: null, history: [] }
  const last = hits[0]
  const kmAgo = kmNow - (last.km_at_service || 0)
  const dAgo  = Math.floor((Date.now() - new Date(last.service_date)) / 86400000)
  const pKm   = comp.kmInt  ? kmAgo / comp.kmInt  : 0
  const pDay  = comp.dayInt ? dAgo  / comp.dayInt : 0
  const pct   = Math.max(pKm, pDay)
  const lvl   = pct >= 1 ? 'overdue' : pct >= 0.8 ? 'due' : 'ok'
  const nextKm  = comp.kmInt && last.km_at_service ? last.km_at_service + comp.kmInt : null
  const history = hits.slice(0, 4).map(r => r.km_at_service).filter(Boolean)
  return { lvl, last, kmAgo, dAgo, pct, nextKm, history }
}

const fmtRp   = n => n ? 'Rp ' + Number(n).toLocaleString('id-ID') : '—'
const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtKm   = k => k != null ? k.toLocaleString('id-ID') + ' km' : '—'

const VEHICLE_TYPES = [
  { value: 'motor', label: 'Motor', icon: '🏍' },
  { value: 'mobil', label: 'Mobil', icon: '🚗' },
]

function SvcSkeleton() {
  return (
    <main className="main-content">
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        {[1, 2].map(i => (
          <span key={i} className="skeleton" style={{ height: 40, width: 160, borderRadius: 10, display: 'block' }} />
        ))}
      </div>
      <div className="svc-vehicle-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="skel-line skel-h-lg" style={{ width: 40, borderRadius: 8 }} />
          <div>
            <span className="skel-line skel-h-md" style={{ width: 160, marginBottom: 6, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 100, display: 'block' }} />
          </div>
        </div>
      </div>
      <div className="svc-status-grid" style={{ marginBottom: '1rem' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="svc-status-card">
            <span className="skel-line skel-h-sm" style={{ width: '60%', marginBottom: 6, display: 'block' }} />
            <span className="skel-line skel-h-md" style={{ width: '80%', marginBottom: 4, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: '50%', display: 'block' }} />
          </div>
        ))}
      </div>
      <div className="table-wrap">
        {[1,2,3,4].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '0.75rem 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <span className="skel-line skel-h-sm" style={{ width: 80, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 70, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ flex: 1, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 80, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 70, display: 'block' }} />
          </div>
        ))}
      </div>
    </main>
  )
}

function generateSvcInsights(overdueComps, dueComps, lastServiceRec, totalBiaya, vehicleRecords) {
  const out = []
  if (overdueComps.length > 0)
    out.push({ icon: '🚨', text: `${overdueComps.map(c => c.label).join(', ')} terlambat servis — segera ke bengkel!`, type: 'danger' })
  else if (dueComps.length > 0)
    out.push({ icon: '🔔', text: `${dueComps.map(c => c.label).join(', ')} mendekati batas interval — jadwalkan servis.`, type: 'warning' })
  else if (vehicleRecords.length > 0)
    out.push({ icon: '✅', text: 'Semua komponen dalam kondisi baik. Terus rawat kendaraanmu!', type: 'positive' })

  if (lastServiceRec) {
    const days = Math.floor((Date.now() - new Date(lastServiceRec.service_date)) / 86400000)
    if (days > 120)
      out.push({ icon: '📅', text: `Servis terakhir ${days} hari lalu — saatnya cek kendaraan!`, type: 'warning' })
    else if (days < 7)
      out.push({ icon: '🔧', text: `Baru servis ${days === 0 ? 'hari ini' : days + ' hari lalu'} — bagus!`, type: 'positive' })
  }
  if (totalBiaya > 0)
    out.push({ icon: '💰', text: `Total Rp ${totalBiaya.toLocaleString('id-ID')} tercatat untuk kendaraan ini.`, type: 'info' })
  return out.slice(0, 3)
}

export default function VehicleService({ session }) {
  const [vehicles,  setVehicles]  = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [kmEdit,    setKmEdit]    = useState(false)
  const [kmVal,     setKmVal]     = useState('')
  const [showAdd,   setShowAdd]   = useState(false)
  const [editRec,   setEditRec]   = useState(null)
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [editVehicle, setEditVehicle] = useState(null)
  const [toast,     setToast]     = useState(null)
  const [expandedComp, setExpandedComp] = useState(null)
  const [svcPage,   setSvcPage]   = useState(1)
  const [svcSearch, setSvcSearch] = useState('')
  const toastKey = useRef(0)

  const uid    = session.user.id
  const { t } = useLang()

  const showToast = useCallback((msg, type = 'success') => {
    toastKey.current += 1
    setToast({ message: msg, type, key: toastKey.current })
  }, [])

  const vehicle = vehicles.find(v => v.id === selectedId) || null

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [vRes, rRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('service_records').select('*').eq('user_id', uid).order('service_date', { ascending: false }),
    ])

    if (vRes.error || rRes.error) {
      showToast('Setup tabel Supabase dibutuhkan. Jalankan SQL migration terlebih dahulu.', 'error')
      setLoading(false)
      return
    }

    let vs = vRes.data || []
    const rs = rRes.data || []

    if (!vs.length) {
      const { data: newV } = await supabase
        .from('vehicles')
        .insert({ name: 'Honda Vario 125', type: 'motor', plate: 'B 4829 XAD', year: null, km_current: 21350, user_id: uid })
        .select().single()
      if (newV) {
        vs = [newV]
        const SEED = [
          { service_date: '2025-01-12', km_at_service: 18420, service_type: 'Ganti oli + filter udara', shop: 'Ahass Malang', cost: 185000, notes: null, product_used: null },
          { service_date: '2024-08-05', km_at_service: 16100, service_type: 'Tune up + ganti busi',     shop: 'Ahass',        cost: 270000, notes: null, product_used: null },
          { service_date: '2024-03-20', km_at_service: 13840, service_type: 'Ganti ban belakang',        shop: null,           cost: 320000, notes: null, product_used: null },
        ]
        await supabase.from('service_records').insert(SEED.map(s => ({ ...s, user_id: uid, vehicle_id: newV.id })))
      }
    }

    setVehicles(vs)
    setSelectedId(prev => (prev && vs.find(v => v.id === prev)) ? prev : (vs[0]?.id || null))
    setRecords(rs)
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchData() }, [fetchData])

  const vehicleRecords = records.filter(r => r.vehicle_id === selectedId)
  const kmNow = vehicle?.km_current || 0

  const components    = vehicle ? getComponents(vehicle) : []
  const compStatuses  = components.map(comp => compStatus(comp, vehicleRecords, kmNow))
  const overdueComps  = components.filter((_, i) => compStatuses[i]?.lvl === 'overdue')
  const dueComps      = components.filter((_, i) => compStatuses[i]?.lvl === 'due')
  const totalBiaya    = vehicleRecords.reduce((s, r) => s + (r.cost || 0), 0)
  const lastServiceRec = vehicleRecords[0] || null

  const PAGE_SIZE = 10
  const filteredRecords = svcSearch.trim()
    ? vehicleRecords.filter(r => {
        const q = svcSearch.toLowerCase()
        return fmtItems(r.service_type).toLowerCase().includes(q)
          || (r.shop || '').toLowerCase().includes(q)
          || fmtDate(r.service_date).toLowerCase().includes(q)
      })
    : vehicleRecords
  const pagedRecords = filteredRecords.slice((svcPage - 1) * PAGE_SIZE, svcPage * PAGE_SIZE)

  useEffect(() => { setSvcPage(1); setSvcSearch('') }, [selectedId])

  const updateKm = async () => {
    const km = parseInt(kmVal)
    if (!isNaN(km) && km >= 0 && vehicle) {
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, km_current: km } : v))
      await supabase.from('vehicles').update({ km_current: km }).eq('id', vehicle.id).eq('user_id', uid)
      showToast(t('svcKmUpdated'))
    }
    setKmEdit(false)
  }

  const handleDeleteRecord = async (id) => {
    await supabase.from('service_records').delete().eq('id', id).eq('user_id', uid)
    setRecords(prev => prev.filter(r => r.id !== id))
    showToast(t('svcRecordDeleted'))
  }

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm(t('svcConfirmDeleteVehicle'))) return
    await supabase.from('service_records').delete().eq('vehicle_id', id).eq('user_id', uid)
    await supabase.from('vehicles').delete().eq('id', id).eq('user_id', uid)
    setVehicles(prev => {
      const next = prev.filter(v => v.id !== id)
      setSelectedId(next[0]?.id || null)
      return next
    })
    setRecords(prev => prev.filter(r => r.vehicle_id !== id))
    showToast(t('svcVehicleDeleted'))
  }

  const typeInfo = VEHICLE_TYPES.find(t => t.value === vehicle?.type) || VEHICLE_TYPES[0]

  return (
    <>
      {loading ? <SvcSkeleton /> : (
        <main className="main-content">
          {/* Vehicle Selector */}
          <div className="svc-vehicle-selector">
            <div className="svc-vehicle-tabs">
              {vehicles.map(v => {
                const vt = VEHICLE_TYPES.find(x => x.value === v.type) || VEHICLE_TYPES[0]
                return (
                  <button
                    key={v.id}
                    className={`svc-vehicle-tab${selectedId === v.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(v.id)}
                  >
                    <span>{vt.icon}</span>
                    <span>{v.name}</span>
                    {v.plate && <span className="svc-tab-plate">{v.plate}</span>}
                  </button>
                )
              })}
            </div>
            <button
              className="btn-primary"
              onClick={() => { setEditVehicle(null); setShowVehicleModal(true) }}
            >
              {t('svcAddVehicle')}
            </button>
          </div>

          {vehicle && (
            <>
              {/* Vehicle Header */}
              <div className="svc-vehicle-card">
                <div className="svc-vehicle-left">
                  <div className="svc-vehicle-icon">{typeInfo.icon}</div>
                  <div>
                    <div className="svc-vehicle-name">{vehicle.name}</div>
                    <div className="svc-vehicle-meta">
                      <span className="badge badge-amber">{vehicle.plate || '—'}</span>
                      {vehicle.year && <span className="svc-vehicle-year">{vehicle.year}</span>}
                      <span className="badge">{typeInfo.label}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="svc-km-block">
                    <div className="svc-km-label">{t('svcKmNow')}</div>
                    {kmEdit ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          className="svc-km-input"
                          type="text" inputMode="numeric"
                          value={kmVal ? Number(kmVal).toLocaleString('id-ID') : ''}
                          onChange={e => setKmVal(e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
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
                        title={t('svcKmUpdate')}
                      >
                        {kmNow.toLocaleString('id-ID')}
                        <span className="svc-km-unit">km</span>
                        <span className="svc-km-edit-hint">✏</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" title={t('svcEditVehicle')} onClick={() => { setEditVehicle(vehicle); setShowVehicleModal(true) }}>✏</button>
                    {vehicles.length > 1 && (
                      <button className="btn-icon del" title={t('svcDeleteVehicle')} onClick={() => handleDeleteVehicle(vehicle.id)}>✕</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Urgency Alert Banner */}
              {overdueComps.length > 0 && (
                <div className="svc-alert-banner svc-alert-overdue">
                  <span className="svc-alert-icon">⚠</span>
                  <div>
                    <span className="svc-alert-title">{t('svcAlertOverdue')}</span>
                    <span className="svc-alert-sub">
                      {overdueComps.map(c => c.label).join(', ')} {t('svcAlertOverdueSub')}
                    </span>
                  </div>
                </div>
              )}
              {overdueComps.length === 0 && dueComps.length > 0 && (
                <div className="svc-alert-banner svc-alert-due">
                  <span className="svc-alert-icon">🔔</span>
                  <div>
                    <span className="svc-alert-title">{t('svcAlertDue')}</span>
                    <span className="svc-alert-sub">
                      {dueComps.map(c => c.label).join(', ')} {t('svcAlertDueSub')}
                    </span>
                  </div>
                </div>
              )}

              {/* Smart Insights Strip */}
              {(() => {
                const chips = generateSvcInsights(overdueComps, dueComps, lastServiceRec, totalBiaya, vehicleRecords)
                return chips.length > 0 ? (
                  <div className="insight-strip">
                    {chips.map((c, i) => (
                      <div key={i} className={`insight-chip chip-${c.type}`}>
                        <span className="chip-icon">{c.icon}</span>
                        <span className="chip-text">{c.text}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}

              {/* Summary Stat Cards */}
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">{t('svcTotalRecords')}</div>
                  <div className="stat-card-value">{vehicleRecords.length}</div>
                  <div className="stat-card-sub">{t('svcHistorySub')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">{t('svcTotalCost')}</div>
                  <div className="stat-card-value" style={{ fontSize: vehicleRecords.length ? '1rem' : '1.25rem', color: 'var(--amber)' }}>
                    {totalBiaya ? 'Rp ' + totalBiaya.toLocaleString('id-ID') : '—'}
                  </div>
                  <div className="stat-card-sub">{t('svcAllService')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">{t('svcLastService')}</div>
                  <div className="stat-card-value" style={{ fontSize: '0.92rem', color: 'var(--blue)' }}>
                    {lastServiceRec ? fmtDate(lastServiceRec.service_date) : '—'}
                  </div>
                  <div className="stat-card-sub">
                    {lastServiceRec ? fmtKm(lastServiceRec.km_at_service) : t('svcNoDataSub')}
                  </div>
                </div>
              </div>

              {/* Component Status Cards */}
              <div className="svc-status-grid">
                {getComponents(vehicle).map(comp => {
                  const s  = compStatus(comp, vehicleRecords, kmNow)
                  const lv = LVL[s.lvl]
                  return (
                    <div key={comp.id} className={`svc-status-card${expandedComp === comp.id ? ' svc-status-card-active' : ''}`} style={{ background: lv.bg, borderColor: lv.bd, cursor: 'pointer' }} onClick={() => setExpandedComp(prev => prev === comp.id ? null : comp.id)}>
                      <div className="svc-status-top">
                        <span className="svc-status-icon" style={{ color: comp.color }}>{comp.icon}</span>
                        <span className="svc-status-badge" style={{ color: lv.color }}>{t(lv.key)}</span>
                      </div>
                      <div className="svc-status-name">{comp.label}</div>
                      {s.last ? (
                        <>
                          <div className="svc-status-meta">
                            <span>KM {(s.last.km_at_service||0).toLocaleString('id-ID')}</span>
                            {comp.dayInt && <span> · {s.dAgo}h lalu</span>}
                          </div>
                          {s.nextKm && (
                            <div style={{ fontSize: '0.7rem', marginTop: 4 }}>
                              <span style={{ color: 'var(--muted)' }}>Next </span>
                              <span style={{ fontFamily: "'DM Mono', monospace", color: lv.color, fontWeight: 600 }}>
                                {s.nextKm.toLocaleString('id-ID')} km
                              </span>
                            </div>
                          )}
                          {s.history.length > 1 && (
                            <div style={{ fontSize: '0.59rem', color: 'var(--muted)', marginTop: 5, borderTop: '1px solid var(--border)', paddingTop: 4, lineHeight: 1.7 }}>
                              {s.history.map(k => k.toLocaleString('id-ID')).join(' · ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="svc-status-meta"><span>{t('svcNoDataComp')}</span></div>
                      )}
                      <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: 5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
                        {t('svcInterval')} {comp.kmInt ? `${comp.kmInt.toLocaleString('id-ID')} km` : ''}
                        {comp.kmInt && comp.dayInt ? ' / ' : ''}
                        {comp.dayInt ? `${comp.dayInt} ${t('svcDays')}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Service History */}
              <div className="action-bar">
                <div className="section-title">{t('svcSectionHistory')}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={t('svcSearchPlaceholder')}
                    value={svcSearch}
                    onChange={e => { setSvcSearch(e.target.value); setSvcPage(1) }}
                    style={{ fontSize: '0.75rem', padding: '0.28rem 0.6rem', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', width: 170, outline: 'none' }}
                  />
                  <button className="btn-primary" onClick={() => { setEditRec(null); setShowAdd(true) }}>{t('svcAddRecord')}</button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('svcThDate')}</th>
                      <th>{t('svcThKm')}</th>
                      <th>{t('svcThService')}</th>
                      <th>{t('svcThShop')}</th>
                      <th className="num">{t('svcThCost')}</th>
                      <th className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr><td colSpan={6} className="empty-state">{svcSearch ? t('svcNoResults') : t('svcNoRecords')}</td></tr>
                    ) : pagedRecords.map(r => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.service_date)}</td>
                        <td><span className="svc-km-cell">{r.km_at_service?.toLocaleString('id-ID')} km</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{fmtItems(r.service_type)}</td>
                        <td>{r.shop || <span className="muted">—</span>}</td>
                        <td className="num">{fmtRp(r.cost)}</td>
                        <td className="actions">
                          <div className="row-actions">
                            <button className="btn-icon" title="Edit" onClick={() => { setEditRec(r); setShowAdd(true) }}>✏</button>
                            <button className="btn-icon del" title="Hapus" onClick={() => handleDeleteRecord(r.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredRecords.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="muted" style={{ fontSize: '0.72rem' }}>
                          {filteredRecords.length} {t('svcFooterRecords')}{svcSearch ? ` (${t('svcFooterFrom')} ${vehicleRecords.length})` : ''} · {t('svcFooterTotal')}
                        </td>
                        <td className="num" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem', color: 'var(--text)' }}>
                          {fmtRp(filteredRecords.reduce((s, r) => s + (r.cost || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <Pagination total={filteredRecords.length} page={svcPage} onChange={setSvcPage} />

              {/* Service Timeline */}
              {vehicleRecords.length > 0 && (
                <div className="svc-timeline-section">
                  <div className="svc-timeline-title">{t('svcTimelineTitle')}</div>
                  <div className="svc-tl">
                    {vehicleRecords.slice(0, 4).map((r, i) => (
                      <div key={r.id} className="svc-tl-item">
                        <div className="svc-tl-dot" style={{ background: i === 0 ? 'var(--blue)' : 'var(--border2)' }} />
                        <div className="svc-tl-line" style={{ opacity: i === Math.min(3, vehicleRecords.length - 1) ? 0 : 1 }} />
                        <div className="svc-tl-content">
                          <div className="svc-tl-date">{fmtDate(r.service_date)}{r.km_at_service ? ` · ${r.km_at_service.toLocaleString('id-ID')} km` : ''}</div>
                          <div className="svc-tl-service">{fmtItems(r.service_type)}</div>
                          <div className="svc-tl-meta">
                            {r.shop && <span className="svc-tl-shop">{r.shop}</span>}
                            {r.cost ? <span className="svc-tl-cost">{fmtRp(r.cost)}</span> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {vehicles.length === 0 && !loading && (
            <div className="empty-state" style={{ padding: '3rem' }}>
              {t('svcNoVehicles')}
            </div>
          )}
        </main>
      )}

      {showAdd && vehicle && (
        <ServiceModal
          record={editRec}
          vehicle={vehicle}
          uid={uid}
          onClose={() => setShowAdd(false)}
          onSaved={fetchData}
          showToast={showToast}
        />
      )}

      {showVehicleModal && (
        <VehicleModal
          vehicle={editVehicle}
          uid={uid}
          onClose={() => setShowVehicleModal(false)}
          onSaved={fetchData}
          showToast={showToast}
        />
      )}

      {expandedComp && vehicle && (() => {
        const comp = getComponents(vehicle).find(c => c.id === expandedComp)
        if (!comp) return null
        const recs = vehicleRecords
          .filter(r => comp.keys.some(k => getServiceText(r).toLowerCase().includes(k)))
          .sort((a, b) => new Date(b.service_date) - new Date(a.service_date))
        return <CompHistoryModal comp={comp} recs={recs} onClose={() => setExpandedComp(null)} />
      })()}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </>
  )
}

function CompHistoryModal({ comp, recs, onClose }) {
  const { t } = useLang()
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)
  const PAGE = 10

  const filtered = search.trim()
    ? recs.filter(r =>
        fmtItems(r.service_type).toLowerCase().includes(search.toLowerCase()) ||
        (r.shop || '').toLowerCase().includes(search.toLowerCase()) ||
        fmtDate(r.service_date).toLowerCase().includes(search.toLowerCase())
      )
    : recs
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: comp.color }}>{comp.icon}</span>
            {t('svcHistoryTitle')} {comp.label}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {recs.length > 0 && (
              <input
                type="text"
                placeholder={t('svcSearchShort')}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                style={{ fontSize: '0.75rem', padding: '0.26rem 0.55rem', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', width: 130, outline: 'none' }}
              />
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {recs.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>{t('svcNoHistory')} {comp.label}</div>
          ) : (
            <>
              <div className="table-wrap" style={{ marginBottom: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('svcThDate')}</th>
                      <th>{t('svcThKm')}</th>
                      <th>{t('svcThService')}</th>
                      <th>{t('svcThShop')}</th>
                      <th className="num">{t('svcThCost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={5} className="empty-state">{t('svcNoResults2')}</td></tr>
                    ) : paged.map(r => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.service_date)}</td>
                        <td><span className="svc-km-cell">{r.km_at_service?.toLocaleString('id-ID')} km</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{fmtItems(r.service_type)}</td>
                        <td>{r.shop || <span className="muted">—</span>}</td>
                        <td className="num">{fmtRp(r.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="muted" style={{ fontSize: '0.72rem' }}>
                          {filtered.length} {t('svcFooterRecords')}{search ? ` (${t('svcFooterFrom')} ${recs.length})` : ''}
                        </td>
                        <td className="num" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem', color: 'var(--text)' }}>
                          {fmtRp(filtered.reduce((s, r) => s + (r.cost || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <Pagination total={filtered.length} page={page} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function VehicleModal({ vehicle, uid, onClose, onSaved, showToast }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    name:       vehicle?.name        || '',
    type:       vehicle?.type        || 'motor',
    plate:      vehicle?.plate       || '',
    year:       vehicle?.year?.toString() || '',
    km_current: vehicle?.km_current?.toString() || '0',
  })
  const [partsConfig, setPartsConfig] = useState(() => {
    const cfg = vehicle?.parts_config || {}
    return DEFAULT_COMPONENTS.map(c => ({
      id:     c.id,
      label:  c.label,
      kmInt:  (cfg[c.id]?.kmInt  !== undefined ? cfg[c.id].kmInt  : c.kmInt)?.toString()  || '',
      dayInt: (cfg[c.id]?.dayInt !== undefined ? cfg[c.id].dayInt : c.dayInt)?.toString() || '',
    }))
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set    = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setPart = (i, k, v) => setPartsConfig(prev => prev.map((p, idx) => idx === i ? { ...p, [k]: v } : p))

  const save = async () => {
    if (!form.name.trim() || !form.plate.trim()) {
      setErr(t('svcErrNamePlate')); return
    }
    setSaving(true)

    const cfg = {}
    partsConfig.forEach(p => {
      cfg[p.id] = {
        kmInt:  p.kmInt  ? parseInt(p.kmInt)  : null,
        dayInt: p.dayInt ? parseInt(p.dayInt) : null,
      }
    })

    const payload = {
      user_id:    uid,
      name:       form.name.trim(),
      type:       form.type,
      plate:      form.plate.trim(),
      year:       parseInt(form.year) || null,
      km_current: parseInt(form.km_current) || 0,
      parts_config: cfg,
    }

    let error
    if (vehicle) {
      ;({ error } = await supabase.from('vehicles').update(payload).eq('id', vehicle.id).eq('user_id', uid))
    } else {
      ;({ error } = await supabase.from('vehicles').insert(payload))
    }
    if (error) { setSaving(false); setErr(error.message); return }
    showToast(vehicle ? t('svcVehicleUpdated') : t('svcVehicleAdded'))
    onClose()
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">{vehicle ? t('svcEditVehicleTitle') : t('svcAddVehicleTitle')}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div className="field">
            <label>{t('svcLabelName')}</label>
            <input type="text" placeholder="Honda Vario 125, Avanza…" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('svcLabelType')}</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                {VEHICLE_TYPES.map(vt => <option key={vt.value} value={vt.value}>{vt.icon} {vt.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('svcLabelPlate')}</label>
              <input type="text" placeholder="B 1234 ABC" value={form.plate} onChange={e => set('plate', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('svcLabelYear')}</label>
              <input type="number" placeholder="2020" value={form.year} onChange={e => set('year', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('svcKmNow')}</label>
              <input
                type="text" inputMode="numeric" placeholder="0"
                value={form.km_current ? Number(String(form.km_current).replace(/\./g, '')).toLocaleString('id-ID') : ''}
                onChange={e => set('km_current', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
              />
            </div>
          </div>

          {/* Parts Config */}
          <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.75rem' }}>
              {t('svcPartsTitle')}
            </div>
            {partsConfig.map((p, i) => (
              <div key={p.id} className="svc-parts-row">
                <span className="svc-parts-label">{p.label}</span>
                <div className="svc-parts-inputs">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="text" inputMode="numeric" className="svc-parts-input"
                      placeholder="km"
                      value={p.kmInt ? Number(p.kmInt).toLocaleString('id-ID') : ''}
                      onChange={e => setPart(i, 'kmInt', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
                    />
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>km</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="text" inputMode="numeric" className="svc-parts-input"
                      placeholder="hari"
                      value={p.dayInt ? Number(p.dayInt).toLocaleString('id-ID') : ''}
                      onChange={e => setPart(i, 'dayInt', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
                    />
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>hari</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {err && <div className="modal-error">{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  )
}

function ServiceModal({ record, vehicle, uid, onClose, onSaved, showToast }) {
  const { t } = useLang()
  const today = new Date().toISOString().split('T')[0]
  const [date,  setDate]  = useState(record?.service_date || today)
  const [km,    setKm]    = useState(record?.km_at_service?.toString() || '')
  const [shop,  setShop]  = useState(record?.shop || '')
  const [items, setItems] = useState(() =>
    record?.service_type ? tryParseItems(record.service_type) : [{ nama: '', biaya: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const setItem = (i, k, v) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addItem = () => setItems(prev => [...prev, { nama: '', biaya: '' }])
  const delItem = i  => setItems(prev => prev.filter((_, idx) => idx !== i))

  const parseRaw = v => parseInt(String(v).replace(/\./g, '')) || 0
  const total = items.reduce((s, it) => s + parseRaw(it.biaya), 0)

  const save = async () => {
    if (!date) { setErr(t('svcErrDate')); return }
    const valid = items.filter(it => it.nama.trim())
    if (!valid.length) { setErr(t('svcErrMinItem')); return }
    setSaving(true)
    const payload = {
      user_id:       uid,
      vehicle_id:    vehicle?.id,
      service_date:  date,
      km_at_service: parseInt(km) || null,
      service_type:  JSON.stringify(valid.map(it => ({ nama: it.nama.trim(), biaya: parseRaw(it.biaya) }))),
      product_used:  null,
      shop:          shop.trim() || null,
      cost:          total,
      notes:         null,
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

    showToast(record ? t('svcRecordUpdated') : t('svcServiceRecorded'))
    onClose()
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">{record ? t('svcEditRecordTitle') : `${t('svcAddRecordFor')} ${vehicle?.name || ''}`}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div className="field-row">
            <div className="field">
              <label>{t('svcLabelDate')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('svcLabelKmAtService')}</label>
              <input
                type="text" inputMode="numeric"
                placeholder="mis. 21.350"
                value={km ? Number(km).toLocaleString('id-ID') : ''}
                onChange={e => setKm(e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="field">
            <label>{t('svcLabelShop')}</label>
            <input type="text" placeholder="Ahass, bengkel umum, dll." value={shop} onChange={e => setShop(e.target.value)} />
          </div>

          <div className="svc-items-section">
            <div className="svc-items-header">
              <span className="svc-items-title">{t('svcLabelItems')}</span>
              <button type="button" className="btn-secondary" style={{ padding: '0.18rem 0.55rem', fontSize: '0.72rem' }} onClick={() => addItem()}>{t('svcAddItem')}</button>
            </div>
            <div className="svc-quick-types" style={{ marginBottom: '0.55rem' }}>
              {DEFAULT_COMPONENTS.map(c => (
                <button key={c.id} type="button" className="svc-quick-type-btn"
                  onClick={() => {
                    const emptyIdx = items.findIndex(it => !it.nama.trim())
                    if (emptyIdx >= 0) setItem(emptyIdx, 'nama', c.label)
                    else setItems(prev => [...prev, { nama: c.label, biaya: '' }])
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
            {items.map((it, i) => (
              <div key={i} className="svc-item-row">
                <input
                  type="text"
                  className="svc-item-nama"
                  placeholder={t('svcItemName')}
                  value={it.nama}
                  onChange={e => setItem(i, 'nama', e.target.value)}
                />
                <input
                  type="text" inputMode="numeric"
                  className="svc-item-biaya"
                  placeholder={t('svcItemCost')}
                  value={it.biaya ? Number(String(it.biaya).replace(/\./g, '')).toLocaleString('id-ID') : ''}
                  onChange={e => setItem(i, 'biaya', e.target.value.replace(/\./g, '').replace(/\D/g, ''))}
                />
                {items.length > 1 && (
                  <button type="button" className="btn-icon del" style={{ flexShrink: 0 }} onClick={() => delItem(i)}>✕</button>
                )}
              </div>
            ))}
            <div className="svc-item-total">
              <span>{t('svcFooterTotal')}</span>
              <span className="svc-item-total-val">{fmtRp(total)}</span>
            </div>
          </div>

          {err && <div className="modal-error">{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
