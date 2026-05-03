// src/pages/MountainHiking.jsx
import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'
import Toast from '../components/Toast'
import Pagination, { paginate } from '../components/Pagination'
import { useHikes, useDeleteHike } from '../hooks/useHikes'

const STATUS = {
  summit: { label: 'Summit',  color: '#3dba7e', bg: 'rgba(61,186,126,0.12)',  bd: 'rgba(61,186,126,0.28)' },
  kawah:  { label: 'Kawah',   color: '#e9a229', bg: 'rgba(233,162,41,0.10)', bd: 'rgba(233,162,41,0.28)' },
  camp:   { label: 'Camp',    color: '#4a90d9', bg: 'rgba(74,144,217,0.10)',  bd: 'rgba(74,144,217,0.28)' },
  failed: { label: 'Failed',  color: '#e05252', bg: 'rgba(224,82,82,0.10)',   bd: 'rgba(224,82,82,0.28)'  },
}

const SEVEN_SUMMIT_JAVA = {
  semeru: 1, slamet: 2, sumbing: 3, arjuno: 4,
  lawu: 5, welirang: 6, merbabu: 7,
}

const INDONESIA_NOTABLE = {
  semeru:     '#1 Jawa',
  slamet:     '#2 Jawa',
  sumbing:    '#3 Jawa',
  kerinci:    '#1 Sumatera',
  rinjani:    '#1 NTB',
  binaiya:    '#1 Maluku',
  latimojong: '#1 Sulawesi',
  carstensz:  '#1 Indonesia',
}

function getHikeBadges(name) {
  const key = (name || '').toLowerCase().trim()
  const badges = []
  if (SEVEN_SUMMIT_JAVA[key] !== undefined)
    badges.push({ text: `7SJ #${SEVEN_SUMMIT_JAVA[key]}`, color: '#e9a229', bg: 'rgba(233,162,41,0.13)' })
  if (INDONESIA_NOTABLE[key])
    badges.push({ text: INDONESIA_NOTABLE[key], color: '#8b7de8', bg: 'rgba(139,125,232,0.13)' })
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

function parseHikeNotes(raw) {
  if (!raw) return { trail: '', notes: '' }
  const m = raw.match(/^Jalur: (.+?)(?:\n([\s\S]*))?$/)
  if (m) return { trail: (m[1] || '').trim(), notes: (m[2] || '').trim() }
  return { trail: '', notes: raw }
}

function buildHikeNotes(trail, notes) {
  const t = (trail || '').trim(), n = (notes || '').trim()
  if (t && n) return `Jalur: ${t}\n${n}`
  if (t) return `Jalur: ${t}`
  return n || null
}

function hikeDuration(start, end) {
  if (!start || !end) return '—'
  const parse = d => { const [y,m,dd] = d.split('-'); return new Date(+y,+m-1,+dd) }
  const days   = Math.round((parse(end) - parse(start)) / 86400000) + 1
  const nights = days - 1
  if (nights === 0) return 'TekTok'
  return `${days} hari ${nights} malam`
}


function HikeSkeleton() {
  return (
    <main className="main-content">
      <div className="stat-grid">
        {[1,2,3,4].map(i => (
          <div key={i} className="stat-card">
            <span className="skel-line skel-h-sm" style={{ width: '50%', marginBottom: 8, display: 'block' }} />
            <span className="skel-line skel-h-lg" style={{ width: '60%', marginBottom: 6, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: '40%', display: 'block' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        {[1,2,3].map(i => (
          <span key={i} className="skeleton" style={{ height: 32, width: 110, borderRadius: 8, display: 'block' }} />
        ))}
      </div>
      <div className="table-wrap">
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '0.75rem 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <span className="skel-line skel-h-md" style={{ width: 120, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 55, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 90, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ flex: 1, display: 'block' }} />
          </div>
        ))}
      </div>
    </main>
  )
}

function generateHikeInsights(hikes, summits, maxElevation, sevenSJCount, citiesVisited) {
  if (hikes.length === 0) return []
  const out = []
  const successRate = hikes.length ? Math.round(summits / hikes.length * 100) : 0

  if (sevenSJCount === 7)
    out.push({ icon: '🏆', text: '7 Summit of Java complete! Kamu sudah kuasai semua puncak tertinggi Jawa.', type: 'positive' })
  else if (sevenSJCount > 0)
    out.push({ icon: '⭐', text: `7SJ ${sevenSJCount}/7 — tinggal ${7 - sevenSJCount} gunung lagi untuk complete 7 Summit of Java!`, type: 'info' })

  if (maxElevation >= 3676)
    out.push({ icon: '🌋', text: `Puncak tertinggi ${maxElevation.toLocaleString('id-ID')} mdpl — Semeru! Pendaki kelas elite.`, type: 'positive' })
  else if (maxElevation >= 3000)
    out.push({ icon: '🏔', text: `Puncak tertinggi ${maxElevation.toLocaleString('id-ID')} mdpl — kelas gunung tinggi Indonesia!`, type: 'positive' })

  if (successRate === 100 && summits >= 3)
    out.push({ icon: '💪', text: `Summit rate ${successRate}% dari ${hikes.length} pendakian — konsistensi luar biasa!`, type: 'positive' })
  else if (successRate >= 80)
    out.push({ icon: '📈', text: `Summit rate ${successRate}% — sangat bagus! Terus pertahankan.`, type: 'positive' })

  if (citiesVisited >= 5)
    out.push({ icon: '🗺', text: `${citiesVisited} kota dikunjungi untuk mendaki — petualang sejati!`, type: 'info' })

  return out.slice(0, 3)
}

const SEVEN_SUMMITS_ORDER = [
  { key: 'semeru',   name: 'Semeru',   elev: 3676 },
  { key: 'slamet',   name: 'Slamet',   elev: 3428 },
  { key: 'sumbing',  name: 'Sumbing',  elev: 3371 },
  { key: 'arjuno',   name: 'Arjuno',   elev: 3339 },
  { key: 'lawu',     name: 'Lawu',     elev: 3265 },
  { key: 'welirang', name: 'Welirang', elev: 3156 },
  { key: 'merbabu',  name: 'Merbabu', elev: 3145 },
]

function SevenSummitTracker({ hikes }) {
  const hikedNames = hikes.map(h => (h.mountain || '').toLowerCase().trim())
  const matchesSj  = key => hikedNames.some(n => n === key || n.includes(key))
  const count = SEVEN_SUMMITS_ORDER.filter(s => matchesSj(s.key)).length

  return (
    <div className="hike-7sj-wrap">
      <div className="hike-7sj-header">
        <span className="hike-7sj-title">7 Summit of Java</span>
        <span className="hike-7sj-count">{count}/7 puncak</span>
      </div>
      <div className="hike-7sj-nodes">
        {SEVEN_SUMMITS_ORDER.map((s, i) => {
          const done = matchesSj(s.key)
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: '0 0 auto' }}>
                <div className={`hike-7sj-node ${done ? 'done' : 'pending'}`} title={`${s.name} (${s.elev.toLocaleString('id-ID')} mdpl)`}>
                  {done ? '✓' : i + 1}
                </div>
                <div className={`hike-7sj-mountain ${done ? 'done' : ''}`}>{s.name}</div>
              </div>
              {i < SEVEN_SUMMITS_ORDER.length - 1 && (
                <div className={`hike-7sj-connector ${done ? 'done' : ''}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MountainHiking({ session }) {
  const [page,     setPage]     = useState(1)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editHike, setEditHike] = useState(null)
  const [toast,    setToast]    = useState(null)
  const toastKey = useRef(0)

  const uid    = session.user.id
  const { t } = useLang()

  const { data: hikes = [], isLoading: loading, refetch: refetchHikes } = useHikes(uid)
  const deleteHike = useDeleteHike(uid)

  const showToast = useCallback((msg, type = 'success') => {
    toastKey.current += 1
    setToast({ message: msg, type, key: toastKey.current })
  }, [])

  const handleDelete = async (id) => {
    await deleteHike.mutateAsync(id)
    showToast(t('hikeDeletedToast'))
  }

  const parse     = d => { if (!d) return 0; const [y,m,dd]=d.split('-'); return new Date(+y,+m-1,+dd) }
  const summits   = hikes.filter(h => h.status === 'summit').length
  const sorted    = [...hikes].sort((a, b) => parse(b.start_date) - parse(a.start_date))
  const top5      = [...hikes].filter(h => h.elevation).sort((a, b) => (b.elevation||0) - (a.elevation||0)).slice(0, 5)
  const maxTop5   = top5[0]?.elevation || 1

  const maxElevation  = hikes.length ? Math.max(0, ...hikes.filter(h => h.elevation).map(h => h.elevation)) : 0
  const citiesVisited = [...new Set(hikes.filter(h => h.city).map(h => h.city))].length
  const matchesSjKey  = (mountain, key) => { const n = (mountain || '').toLowerCase().trim(); return n === key || n.includes(key) }
  const sevenSJCount  = SEVEN_SUMMITS_ORDER.filter(s => hikes.some(h => matchesSjKey(h.mountain, s.key))).length

  const achievements = [
    hikes.length >= 1     && { icon: '🏔', title: 'Pendaki Perdana',  sub: 'Mulai perjalanan mendaki!' },
    summits >= 1          && { icon: '⛰',  title: 'First Summit',     sub: 'Puncak pertama berhasil!' },
    summits >= 5          && { icon: '🏆', title: '5 Puncak',          sub: '5 summit berhasil' },
    summits >= 10         && { icon: '👑', title: 'Legenda',            sub: '10 summit tercatat' },
    maxElevation >= 1000  && { icon: '📍', title: '1000 mdpl+',        sub: 'Tembus 1000 mdpl' },
    maxElevation >= 3000  && { icon: '🌋', title: '3000 mdpl+',        sub: 'Kelas gunung tinggi' },
    maxElevation >= 3500  && { icon: '🌟', title: '3500 mdpl+',        sub: 'Elite climber Indonesia' },
    sevenSJCount >= 7     && { icon: '💫', title: '7SJ Complete!',     sub: '7 puncak Jawa dikuasai!' },
    sevenSJCount >= 1 && sevenSJCount < 7 && { icon: '⭐', title: `7SJ ${sevenSJCount}/7`, sub: '7 Summit of Java' },
  ].filter(Boolean)

  return (
    <>
      {loading ? <HikeSkeleton /> : (
        <main className="main-content">
          {/* Summary stat cards */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card-label">{t('hikeTotalHikes')}</div>
              <div className="stat-card-value">{hikes.length}</div>
              <div className="stat-card-sub">{t('hikeMountainsSub')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">{t('hikeSummitSuccess')}</div>
              <div className="stat-card-value" style={{ color: 'var(--green)' }}>{summits}</div>
              <div className="stat-card-sub">
                {hikes.length ? `${Math.round(summits / hikes.length * 100)}% ${t('hikeSuccessRate')}` : '—'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">{t('hikeHighest')}</div>
              <div className="stat-card-value" style={{ color: 'var(--blue)' }}>
                {maxElevation ? maxElevation.toLocaleString('id-ID') : '—'}
              </div>
              <div className="stat-card-sub">{t('hikeElevationUnit')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">{t('hikeCitiesVisited')}</div>
              <div className="stat-card-value">{citiesVisited}</div>
              <div className="stat-card-sub">{t('hikeCitiesSub')}</div>
            </div>
          </div>

          {/* Smart Insights Strip */}
          {(() => {
            const chips = generateHikeInsights(hikes, summits, maxElevation, sevenSJCount, citiesVisited)
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

          {/* 7 Summit of Java Tracker */}
          {hikes.length > 0 && <SevenSummitTracker hikes={hikes} />}

          {/* Achievements */}
          {achievements.length > 0 && (
            <div className="achievement-row">
              {achievements.map((a, i) => (
                <div key={i} className="achievement-chip">
                  <span className="achievement-icon">{a.icon}</span>
                  <div className="achievement-info">
                    <span className="achievement-title">{a.title}</span>
                    <span className="achievement-sub">{a.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Log Pendakian */}
          <div className="action-bar">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div className="section-title">{t('hikeLogTitle')}</div>
              {hikes.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: "'DM Mono', monospace" }}>{hikes.length}</span>
                  {' '}{t('hikeRecords')} &middot;{' '}
                  <span style={{ fontWeight: 700, color: 'var(--green)', fontFamily: "'DM Mono', monospace" }}>{summits}</span> summit
                </span>
              )}
            </div>
            <button className="btn-primary" onClick={() => { setEditHike(null); setShowAdd(true) }}>
              {t('hikeAddBtn')}
            </button>
          </div>

          <div className="hike-layout">
            <div className="table-wrap" style={{ marginBottom: 0 }}>
              {sorted.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>▲</div>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t('hikeEmpty')}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>{t('hikeEmptySub')}</div>
                  <button className="btn-primary" onClick={() => { setEditHike(null); setShowAdd(true) }}>
                    {t('hikeAddFirst')}
                  </button>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{t('hikeThMountain')}</th>
                      <th className="num">{t('hikeElevationUnit')}</th>
                      <th>{t('hikeThDate')}</th>
                      <th>{t('hikeThDuration')}</th>
                      <th>{t('hikeThStatus')}</th>
                      <th className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginate(sorted, page).map(h => {
                      const st     = STATUS[h.status] || STATUS.summit
                      const badges = getHikeBadges(h.mountain)
                      const { trail: hTrail, notes: hNotesText } = parseHikeNotes(h.notes)
                      return (
                        <tr key={h.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 3, height: 16, background: st.color, borderRadius: 2, flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{h.mountain}</span>
                              {badges.map(b => (
                                <span key={b.text} className="hike-summit-badge" style={{ color: b.color, background: b.bg }}>{b.text}</span>
                              ))}
                            </div>
                            {(h.city || hTrail || hNotesText) && (
                              <div style={{ paddingLeft: 10, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {h.city     && <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{h.city}</span>}
                                {hTrail     && <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>↑ {hTrail}</span>}
                                {hNotesText && <span style={{ fontSize: '0.67rem', color: 'var(--muted)', fontStyle: 'italic' }}>{hNotesText}</span>}
                              </div>
                            )}
                          </td>
                          <td className="num" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {h.elevation ? h.elevation.toLocaleString('id-ID') : '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDateRange(h.start_date, h.end_date)}</td>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.78rem' }}>{hikeDuration(h.start_date, h.end_date)}</td>
                          <td>
                            <span className="hike-status-badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.bd}` }}>
                              {st.label}
                            </span>
                          </td>
                          <td className="actions">
                            <div className="row-actions">
                              {h.photos_url && (
                                <a href={h.photos_url} target="_blank" rel="noopener noreferrer" className="hike-photos-link" onClick={e => e.stopPropagation()}>📷</a>
                              )}
                              <button className="btn-icon" onClick={() => { setEditHike(h); setShowAdd(true) }}>✏</button>
                              <button className="btn-icon del" onClick={() => handleDelete(h.id)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              <Pagination total={sorted.length} page={page} onChange={setPage} />
            </div>

            {/* Top-5 Elevation Panel */}
            {top5.length > 0 && (
              <div className="hike-rank-panel">
                <div className="physical-rank-title" style={{ marginBottom: 12 }}>5 Tertinggi</div>
                {top5.map((h, i) => {
                  const st     = STATUS[h.status] || STATUS.summit
                  const badges = getHikeBadges(h.mountain)
                  const pct    = Math.round((h.elevation / maxTop5) * 100)
                  return (
                    <div key={h.id} className="physical-rank-item">
                      <span className={`rank-badge rank-${i < 3 ? i + 1 : 'n'}`}>#{i + 1}</span>
                      <div className="physical-rank-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="physical-rank-name">
                          {h.mountain}
                          {badges.slice(0, 1).map(b => (
                            <span key={b.text} className="hike-summit-badge" style={{ color: b.color, background: b.bg, marginLeft: 4 }}>{b.text}</span>
                          ))}
                        </div>
                        <div className="physical-rank-val" style={{ color: st.color }}>
                          {h.elevation?.toLocaleString('id-ID')} mdpl
                        </div>
                        <div className="hike-elev-bar-wrap">
                          <div className="hike-elev-bar" style={{ width: `${pct}%`, background: st.color }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {showAdd && (
        <HikeModal
          hike={editHike} uid={uid}
          onClose={() => setShowAdd(false)}
          onSaved={refetchHikes}
          showToast={showToast}
        />
      )}

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </>
  )
}

function HikeModal({ hike, uid, onClose, onSaved, showToast }) {
  const { t } = useLang()
  const today = new Date().toISOString().split('T')[0]
  const parsed = parseHikeNotes(hike?.notes)
  const [form, setForm] = useState({
    mountain:   hike?.mountain              || '',
    elevation:  hike?.elevation?.toString() || '',
    city:       hike?.city                  || '',
    trail:      parsed.trail,
    notes:      parsed.notes,
    start_date: hike?.start_date            || today,
    end_date:   hike?.end_date              || today,
    status:     hike?.status                || 'summit',
    photos_url: hike?.photos_url            || '',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.mountain.trim() || !form.start_date) {
      setErr(t('errNama')); return
    }
    if (form.end_date && form.end_date < form.start_date) {
      setErr(t('wpErrTanggal')); return
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
      notes:      buildHikeNotes(form.trail, form.notes),
    }
    let error
    if (hike) {
      ;({ error } = await supabase.from('hikes').update(payload).eq('id', hike.id).eq('user_id', uid))
    } else {
      ;({ error } = await supabase.from('hikes').insert(payload))
    }
    if (error) { setSaving(false); setErr(error.message); return }
    showToast(hike ? t('toastUpdated') : t('toastAdded'))
    onClose()
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">{hike ? t('hikeEditTitle') : t('hikeAddTitle')}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="field">
            <label>{t('hikeLabelMountain')}</label>
            <input type="text" placeholder="Semeru, Rinjani, Merbabu…" value={form.mountain} onChange={e => set('mountain', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('hikeLabelElevation')}</label>
              <input type="number" placeholder="3676" value={form.elevation} onChange={e => set('elevation', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('hikeLabelCity')}</label>
              <input type="text" placeholder="Lumajang, Malang…" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>{t('hikeLabelTrail')}</label>
            <input type="text" placeholder="Ranu Pane, Cemoro Sewu, Wekas…" value={form.trail} onChange={e => set('trail', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('hikeLabelStartDate')}</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('hikeLabelEndDate')}</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>{t('hikeLabelStatus')}</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="summit">{t('hikeStatusSummit')}</option>
              <option value="kawah">{t('hikeStatusKawah')}</option>
              <option value="camp">{t('hikeStatusCamp')}</option>
              <option value="failed">{t('hikeStatusFailed')}</option>
            </select>
          </div>

          <div className="field">
            <label>{t('hikeLabelPhotos')}</label>
            <input
              type="url"
              placeholder={t('hikePhotosPlaceholder')}
              value={form.photos_url}
              onChange={e => set('photos_url', e.target.value)}
            />
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 4 }}>
              {t('hikePhotosHint')}
            </div>
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
