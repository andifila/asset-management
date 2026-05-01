// src/components/Summary.jsx — Premium Asset Dashboard v3
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'
import NumInput from './NumInput'
import { useLang } from '../lib/LangContext'

// ── Count-up animation ────────────────────────────────────────────────────────
function useCountUp(target, duration = 950) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    const start = performance.now()
    const tick  = (ts) => {
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

// ── SVG Line Chart (interactive) ──────────────────────────────────────────────
function LineChart({ points, width = 280, height = 72, color = '#4a90d9' }) {
  const [hov, setHov] = useState(null)
  if (!points || points.length < 2) return null

  const vals = points.map(p => p.value)
  const min  = Math.min(...vals)
  const max  = Math.max(...vals)
  const rng  = max - min || 1
  const PAD  = 8

  const toX = i => (i / (points.length - 1)) * width
  const toY = v => height - PAD - ((v - min) / rng) * (height - PAD * 2)

  const pts     = points.map((p, i) => ({ x: toX(i), y: toY(p.value), ...p }))
  const linePth = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPth = `${linePth} L ${width} ${height} L 0 ${height} Z`

  const hovPt = hov !== null ? pts[hov] : null
  const tipX  = hovPt ? Math.min(hovPt.x + 6, width - 88) : 0

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }} onMouseLeave={() => setHov(null)}>
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPth} fill="url(#lc-fill)" />
      <path d={linePth} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <rect key={i} x={p.x - 8} y={0} width={16} height={height}
          fill="transparent" style={{ cursor: 'crosshair' }}
          onMouseEnter={() => setHov(i)} />
      ))}
      {hovPt && (
        <>
          <line x1={hovPt.x} y1={0} x2={hovPt.x} y2={height}
            stroke={color} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3,3" />
          <circle cx={hovPt.x} cy={hovPt.y} r={4} fill={color} stroke="var(--bg)" strokeWidth="2" />
          <rect x={tipX} y={Math.max(2, hovPt.y - 28)} width={84} height={22}
            rx={5} fill="var(--bg3)" stroke="var(--border2)" />
          <text x={tipX + 7} y={Math.max(2, hovPt.y - 28) + 14}
            fill="var(--text)" fontSize="10" fontFamily="'DM Mono',monospace">
            {fmt(hovPt.value)}
          </text>
        </>
      )}
    </svg>
  )
}

// ── SVG Donut Chart (interactive) ─────────────────────────────────────────────
function DonutChart({ slices, size = 164, thickness = 26 }) {
  const [hov, setHov] = useState(null)
  const r    = (size - thickness) / 2
  const cx   = size / 2
  const cy   = size / 2
  const circ = 2 * Math.PI * r
  const GAP  = 2
  let   cumArc = 0
  const vis = slices.filter(s => s.pct > 0.8)

  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg4)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {vis.map((s, i) => {
          const arc    = (s.pct / 100) * circ
          const dash   = Math.max(0, arc - GAP)
          const offset = -cumArc
          cumArc += arc
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color}
              strokeWidth={hov === i ? thickness + 5 : thickness}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset} strokeLinecap="butt"
              style={{ cursor: 'pointer', transition: 'stroke-width 0.18s ease' }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            />
          )
        })}
      </g>
      <text x={cx} y={cy - 6} textAnchor="middle"
        fill="var(--text)" fontSize="14" fontWeight="700" fontFamily="'DM Mono',monospace">
        {hov !== null && vis[hov] ? `${vis[hov].pct.toFixed(1)}%` : ''}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle"
        fill="var(--muted)" fontSize="9" fontFamily="'Sora',sans-serif">
        {hov !== null && vis[hov] ? vis[hov].label : ''}
      </text>
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const CAT_STYLE = {
  'BIBIT':      { bg: 'rgba(74,144,217,0.15)',  color: '#6baee0' },
  'Binance':    { bg: 'rgba(233,162,41,0.15)',  color: '#e9b86a' },
  'Kas Liquid': { bg: 'rgba(61,186,126,0.15)',  color: '#5dcc9a' },
  'JHT':        { bg: 'rgba(139,125,232,0.15)', color: '#a99bf0' },
  'Fisik':      { bg: 'rgba(90,107,138,0.15)',  color: '#8b9ab0' },
}

const relTime = d => {
  if (!d) return null
  const n = Math.floor((Date.now() - new Date(d)) / 86400000)
  if (n === 0) return 'hari ini'
  if (n === 1) return 'kemarin'
  if (n < 30)  return `${n} hari lalu`
  if (n < 365) return `${Math.floor(n / 30)} bln lalu`
  return `${Math.floor(n / 365)} thn lalu`
}

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 5)  return 'Selamat malam'
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 19) return 'Selamat sore'
  return 'Selamat malam'
}

function exportCSV(rows, total) {
  const hdr  = ['Nama Aset', 'Kategori', 'Nilai (IDR)', 'Modal (IDR)', 'Return %']
  const body = rows.map(r => {
    const ret = r.invested > 0 && r.value !== r.invested
      ? ((r.value - r.invested) / r.invested * 100).toFixed(2) + '%' : '—'
    return [r.name, r.category, r.value, r.invested, ret].join(',')
  })
  body.push(`TOTAL,,${total},,`)
  const blob = new Blob([[hdr.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: `aset-${new Date().toISOString().slice(0, 10)}.csv` })
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

function generateInsights({ tAsset, tLiquid, tInvest, tFisik, tKas, tJHT, pnlPct, donutSlices }) {
  if (tAsset === 0) return []
  const out  = []
  const lR   = tLiquid / tAsset
  const iR   = tInvest / tAsset
  const cats = donutSlices.filter(s => s.val > 0).length

  if (pnlPct > 10)      out.push({ icon: '🚀', text: `Investasi cuan ${pnlPct.toFixed(1)}%! Portfolio outperforming.`, type: 'positive' })
  else if (pnlPct > 2)  out.push({ icon: '📈', text: `Return investasi +${pnlPct.toFixed(1)}% — terus pertahankan!`, type: 'positive' })
  else if (pnlPct < -5) out.push({ icon: '📉', text: `Investasi −${Math.abs(pnlPct).toFixed(1)}%. Pertimbangkan rebalancing.`, type: 'warning' })

  if (lR > 0.5)  out.push({ icon: '💰', text: `Cash ${(lR*100).toFixed(0)}% dari portofolio — terlalu tinggi. Pertimbangkan investasi.`, type: 'info' })
  if (lR < 0.1)  out.push({ icon: '⚠', text: 'Dana liquid rendah. Pastikan ada dana darurat 3-6 bulan.', type: 'warning' })
  if (iR > 0.6)  out.push({ icon: '🎯', text: `Investasi ${(iR*100).toFixed(0)}% portofolio — diversifikasi solid!`, type: 'positive' })
  if (cats < 3)  out.push({ icon: '📊', text: 'Diversifikasi masih rendah. Tambah jenis aset untuk kurangi risiko.', type: 'info' })
  if (tJHT > 0)  out.push({ icon: '🛡', text: `JHT Rp ${(tJHT/1e6).toFixed(1)}jt terlindungi — bagus untuk jaring pengaman.`, type: 'positive' })

  return out.slice(0, 3)
}

// ── Quick Add Modal ────────────────────────────────────────────────────────────
function QuickAddModal({ onClose, onTab }) {
  const TYPES = [
    { type: 'bibit',   icon: '↗', label: 'Reksa Dana',  sub: 'via BIBIT',   color: 'var(--blue)'  },
    { type: 'binance', icon: '◆', label: 'Crypto',       sub: 'via Binance', color: 'var(--amber)' },
    { type: 'kas',     icon: '◎', label: 'Kas Liquid',   sub: 'tabungan & JHT', color: 'var(--green)' },
    { type: 'fisik',   icon: '⬡', label: 'Aset Fisik',   sub: 'properti & barang', color: '#8b9ab0' },
  ]
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">+ Tambah Aset</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.875rem' }}>
            Pilih jenis aset — kamu akan diarahkan ke tab yang sesuai.
          </p>
          <div className="asset-qa-grid">
            {TYPES.map(t => (
              <button key={t.type} className="asset-qa-btn" onClick={() => { onTab(t.type); onClose() }}>
                <span className="asset-qa-icon" style={{ color: t.color }}>{t.icon}</span>
                <div className="asset-qa-info">
                  <span className="asset-qa-label">{t.label}</span>
                  <span className="asset-qa-sub">{t.sub}</span>
                </div>
                <span className="asset-qa-arrow">→</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.875rem', textAlign: 'center' }}>
            Tekan <kbd className="asset-kbd">Esc</kbd> untuk tutup
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Loading ────────────────────────────────────────────────────────────
export function SummarySkeletonContent() {
  return (
    <div className="asset-premium">
      <div className="asset-action-bar">
        <span className="skeleton" style={{ height: 32, width: 200, borderRadius: 8, display: 'block' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="skeleton" style={{ height: 32, width: 120, borderRadius: 8, display: 'block' }} />
          <span className="skeleton" style={{ height: 32, width: 100, borderRadius: 8, display: 'block' }} />
        </div>
      </div>
      <div className="asset-hero-card">
        <div style={{ flex: 1 }}>
          <span className="skel-line skel-h-sm" style={{ width: 80, display: 'block', marginBottom: 8 }} />
          <span className="skel-line skel-h-lg" style={{ width: 240, display: 'block', marginBottom: 12 }} />
          <span className="skel-line skel-h-sm" style={{ width: 160, display: 'block' }} />
        </div>
        <span className="skeleton" style={{ width: 280, height: 72, borderRadius: 8, display: 'block' }} />
      </div>
      <div className="asset-insight-row">
        {[1,2,3,4].map(i => (
          <div key={i} className="asset-insight-card" style={{ pointerEvents: 'none' }}>
            <span className="skel-line skel-h-sm" style={{ width: '60%', display: 'block', marginBottom: 10 }} />
            <span className="skel-line skel-h-md" style={{ width: '80%', display: 'block', marginBottom: 6 }} />
            <span className="skel-line skel-h-sm" style={{ width: '50%', display: 'block' }} />
          </div>
        ))}
      </div>
      <div className="asset-chart-row">
        <div className="asset-chart-card">
          <span className="skel-line skel-h-sm" style={{ width: 120, display: 'block', marginBottom: 14 }} />
          <span className="skeleton" style={{ width: '100%', height: 120, borderRadius: 8, display: 'block' }} />
        </div>
        <div className="asset-progress-card">
          <span className="skel-line skel-h-sm" style={{ width: 80, display: 'block', marginBottom: 12 }} />
          <span className="skel-line skel-h-lg" style={{ width: 90, display: 'block', marginBottom: 10 }} />
          <span className="skel-line skel-h-sm" style={{ width: '100%', display: 'block' }} />
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Summary({ data, uid, onRefresh, showToast, onTab, userName }) {
  const { t } = useLang()
  const { bibit, binance, fisik, kas, jht, target } = data

  const [editTarget,   setEditTarget]   = useState(false)
  const [newTarget,    setNewTarget]    = useState(target)
  const [sortCol,      setSortCol]      = useState('value')
  const [sortDir,      setSortDir]      = useState(-1)
  const [search,       setSearch]       = useState('')
  const [filterCat,    setFilterCat]    = useState('all')
  const [showAll,      setShowAll]      = useState(false)
  const [editingRowId, setEditingRowId] = useState(null)
  const [editingVal,   setEditingVal]   = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const searchRef = useRef(null)

  // ── totals ──────────────────────────────────────────────────────────────────
  const tBibitSaldo  = bibit.reduce((s, r) => s + Number(r.saldo     || 0), 0)
  const tBibitAktual = bibit.reduce((s, r) => s + Number(r.aktual    || 0), 0)
  const tBinSaldo    = binance.reduce((s,r) => s + Number(r.saldo    || 0), 0)
  const tBinAktual   = binance.reduce((s,r) => s + Number(r.aktual   || 0), 0)
  const tKas         = kas.reduce((s, r)   => s + Number(r.jumlah   || 0), 0)
  const tFisik       = fisik.reduce((s, r) => s + Number(r.buy_price || 0), 0)
  const tJHT         = Number(jht) || 0
  const tLiquid      = tKas + tJHT
  const tInvest      = tBibitAktual + tBinAktual
  const tAsset       = tLiquid + tInvest + tFisik
  const prog         = target > 0 ? Math.min((tAsset / target) * 100, 100) : 0
  const tSaldo       = tBibitSaldo + tBinSaldo
  const tPnl         = tInvest - tSaldo
  const pnlPct       = tSaldo > 0 ? (tPnl / tSaldo) * 100 : 0
  const pnlPos       = tPnl >= 0

  const animTotal = useCountUp(tAsset, 950)

  // ── donut slices ────────────────────────────────────────────────────────────
  const donutSlices = useMemo(() => [
    { label: 'BIBIT',   val: tBibitAktual, color: 'var(--blue)'   },
    { label: 'Binance', val: tBinAktual,   color: 'var(--amber)'  },
    { label: 'Kas',     val: tKas,         color: 'var(--green)'  },
    { label: 'JHT',     val: tJHT,         color: 'var(--purple)' },
    { label: 'Fisik',   val: tFisik,       color: '#8b9ab0'       },
  ].map(s => ({ ...s, pct: tAsset > 0 ? (s.val / tAsset) * 100 : 0 }))
   .sort((a, b) => b.val - a.val),
  [tBibitAktual, tBinAktual, tKas, tJHT, tFisik, tAsset])

  // ── monthly line chart ──────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const items = [
      ...bibit.map(r => ({ value: Number(r.aktual || 0), date: r.created_at })),
      ...binance.map(r => ({ value: Number(r.aktual || 0), date: r.created_at })),
      ...kas.map(r => ({ value: Number(r.jumlah || 0), date: r.created_at })),
      ...fisik.map(r => ({ value: Number(r.buy_price || 0), date: r.buy_date || r.created_at })),
    ].filter(i => i.date)
    const now = new Date()
    return Array.from({ length: 12 }, (_, idx) => {
      const d  = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1)
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const value = items
        .filter(i => { const di = new Date(i.date); return `${di.getFullYear()}-${String(di.getMonth()+1).padStart(2,'0')}` <= mk })
        .reduce((s, i) => s + i.value, 0)
      return { value, label: d.toLocaleDateString('id-ID', { month: 'short' }), month: mk }
    })
  }, [bibit, binance, kas, fisik])

  // ── smart insights ───────────────────────────────────────────────────────────
  const insights = useMemo(() => generateInsights({ tAsset, tLiquid, tInvest, tFisik, tKas, tJHT, pnlPct, donutSlices }),
    [tAsset, tLiquid, tInvest, tFisik, tKas, tJHT, pnlPct, donutSlices])

  // ── unified rows ─────────────────────────────────────────────────────────────
  const assetRows = useMemo(() => [
    ...bibit.map(r => ({ id: r.id, name: r.nama_aset || '—', category: 'BIBIT',
      value: Number(r.aktual || 0), invested: Number(r.saldo || 0),
      date: r.created_at, color: 'var(--blue)', table: 'bibit_assets', field: 'aktual' })),
    ...binance.map(r => ({ id: r.id, name: r.symbol || '—', category: 'Binance',
      value: Number(r.aktual || 0), invested: Number(r.saldo || 0),
      date: r.created_at, color: 'var(--amber)', table: 'binance_assets', field: 'aktual' })),
    ...kas.map(r => ({ id: r.id, name: r.nama || 'Kas', category: 'Kas Liquid',
      value: Number(r.jumlah || 0), invested: Number(r.jumlah || 0),
      date: r.created_at, color: 'var(--green)', table: 'liquid_assets', field: 'jumlah' })),
    ...fisik.map(r => ({ id: r.id, name: r.asset_name || '—', category: 'Fisik',
      value: Number(r.buy_price || 0), invested: Number(r.buy_price || 0),
      date: r.buy_date || r.created_at, color: '#8b9ab0', table: 'physical_assets', field: 'buy_price' })),
    ...(tJHT > 0 ? [{ id: 'jht', name: 'JHT BPJS', category: 'JHT', value: tJHT, invested: tJHT,
      date: null, color: 'var(--purple)', table: 'jht_assets', field: 'jumlah' }] : []),
  ], [bibit, binance, kas, fisik, tJHT])

  // ── filter + sort ────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = filterCat !== 'all' ? assetRows.filter(r => r.category === filterCat) : assetRows
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
    }
    return [...rows].sort((a, b) => {
      if (sortCol === 'value')  return sortDir * (b.value - a.value)
      if (sortCol === 'growth') return sortDir * ((b.value - b.invested) - (a.value - a.invested))
      if (sortCol === 'name')   return sortDir * a.name.localeCompare(b.name)
      if (sortCol === 'cat')    return sortDir * a.category.localeCompare(b.category)
      return 0
    })
  }, [assetRows, filterCat, search, sortCol, sortDir])

  const SHOW_N = 8
  const visRows = showAll ? filteredRows : filteredRows.slice(0, SHOW_N)

  const recentActivity = useMemo(() =>
    [...assetRows].filter(r => r.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
  [assetRows])

  // ── inline edit ──────────────────────────────────────────────────────────────
  const handleInlineEdit = useCallback(async (row) => {
    const val = parseFloat(String(editingVal).replace(/[^0-9.]/g, ''))
    if (isNaN(val) || val < 0) { setEditingRowId(null); return }
    setSaving(true)
    const { error } = await supabase.from(row.table).update({ [row.field]: val })
      .eq('id', row.id).eq('user_id', uid)
    setSaving(false)
    if (!error) { showToast('Nilai diperbarui'); onRefresh() }
    setEditingRowId(null)
  }, [editingVal, uid, showToast, onRefresh])

  // ── keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = e => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); setShowQuickAdd(true) }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const saveTarget = async () => {
    const { data: ex } = await supabase.from('financial_goals').select('id').eq('user_id', uid).maybeSingle()
    if (ex) await supabase.from('financial_goals').update({ target_amount: newTarget }).eq('id', ex.id)
    else     await supabase.from('financial_goals').insert({ user_id: uid, target_amount: newTarget })
    setEditTarget(false); onRefresh(); showToast(t('toastUpdated'))
  }

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(-1) }
  }

  const cats      = ['all', ...new Set(assetRows.map(r => r.category))]
  const isEmpty   = assetRows.length === 0
  const firstName = (userName || '').split(' ')[0] || 'Kamu'

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="asset-premium">

      {/* ── STICKY ACTION BAR ──────────────────────────────────────────────── */}
      <div className="asset-action-bar">
        <div className="asset-action-greeting">
          <span className="asset-action-hi">{getGreeting()}, {firstName} 👋</span>
          <span className="asset-action-date">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="asset-action-right">
          <div className="asset-search-wrap">
            <span className="asset-search-icon">⌕</span>
            <input ref={searchRef} type="text" placeholder="Cari aset… (F)"
              value={search} onChange={e => { setSearch(e.target.value); setShowAll(false) }}
              className="asset-search-input" />
            {search && <button className="asset-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <button className="asset-btn-secondary" onClick={() => exportCSV(filteredRows, tAsset)} title="Export ke CSV">
            ↓ CSV
          </button>
          <button className="asset-btn-primary" onClick={() => setShowQuickAdd(true)}>
            + Tambah Aset <span className="asset-kbd-hint">A</span>
          </button>
        </div>
      </div>

      {/* ── HERO SECTION ───────────────────────────────────────────────────── */}
      <div className="asset-hero-card">
        <div className="asset-hero-left">
          <div className="asset-hero-eyebrow">Portfolio Overview</div>
          <div className="asset-hero-label">Total Nilai Aset</div>
          <div className="asset-hero-val">Rp {animTotal.toLocaleString('id-ID')}</div>
          <div className="asset-hero-sub">
            <span className="asset-hero-badge" style={{
              color: pnlPos ? 'var(--green)' : 'var(--red)',
              background: pnlPos ? 'rgba(61,186,126,0.12)' : 'rgba(224,82,82,0.12)',
              borderColor: pnlPos ? 'rgba(61,186,126,0.3)'  : 'rgba(224,82,82,0.3)',
            }}>
              {pnlPos ? '▲' : '▼'} {pnlPos ? '+' : ''}{pnlPct.toFixed(2)}% return investasi
            </span>
            {tSaldo > 0 && (
              <span className="asset-hero-sub-text">
                {pnlPos ? '+' : ''}{fmt(tPnl)} dari modal
              </span>
            )}
          </div>
        </div>

        <div className="asset-hero-right">
          <div className="asset-hero-chart-label">Pertumbuhan Portofolio (12 bln)</div>
          <LineChart points={monthlyData} width={280} height={72} color="#4a90d9" />
          <div className="asset-hero-month-row">
            {monthlyData.filter((_, i) => i % 3 === 0 || i === 11).map((p, i) => (
              <span key={i} className="asset-hero-month-lbl">{p.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── SMART INSIGHTS STRIP ───────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="asset-insights-strip">
          {insights.map((ins, i) => (
            <div key={i} className={`asset-insight-chip asset-chip-${ins.type}`}>
              <span className="asset-chip-icon">{ins.icon}</span>
              <span className="asset-chip-text">{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── SUMMARY CARDS ──────────────────────────────────────────────────── */}
      <div className="asset-insight-row">
        {[
          { label: 'Total Aset',    val: fmt(tAsset),  sub: `${prog.toFixed(1)}% target`,   color: 'var(--blue)',  icon: '◈', subColor: 'var(--blue)',  trend: prog > 50 ? 'up' : null },
          { label: 'Liquid & JHT', val: fmt(tLiquid), sub: tAsset > 0 ? `${((tLiquid/tAsset)*100).toFixed(1)}% portofolio` : '—', color: 'var(--green)', icon: '◎', trend: null },
          { label: 'Investasi',     val: fmt(tInvest), sub: tPnl !== 0 ? `${pnlPos?'+':''}${fmtPnl(tPnl)}` : '—',              color: 'var(--amber)', icon: '↗', subColor: pnlPos ? 'var(--green)' : 'var(--red)', trend: pnlPos ? 'up' : 'down' },
          { label: 'Aset Fisik',   val: fmt(tFisik),  sub: `${fisik.length} item`,           color: '#8b9ab0',     icon: '⬡', trend: null },
        ].map((c, i) => (
          <div key={i} className="asset-insight-card">
            <div className="asset-insight-top">
              <span className="asset-insight-icon" style={{ color: c.color }}>{c.icon}</span>
              <span className="asset-insight-label">{c.label}</span>
              {c.trend && <span className={`asset-trend-dot ${c.trend}`} />}
            </div>
            <div className="asset-insight-val">{c.val}</div>
            <div className="asset-insight-sub" style={{ color: c.subColor || 'var(--muted)' }}>{c.sub}</div>
            <div className="asset-insight-accent" style={{ background: c.color }} />
          </div>
        ))}
      </div>

      {isEmpty ? (
        /* ── EMPTY STATE ─────────────────────────────────────────────────── */
        <div className="asset-empty">
          <div className="asset-empty-glow" />
          <div className="asset-empty-icon">📊</div>
          <div className="asset-empty-title">Belum ada aset, yuk mulai!</div>
          <div className="asset-empty-sub">
            Tambahkan aset pertama dan mulai lacak portofolio kamu secara real-time.
          </div>
          <button className="asset-btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}
            onClick={() => setShowQuickAdd(true)}>
            + Tambah Aset Pertama
          </button>
          <div className="asset-empty-cats">
            {[['↗','BIBIT','var(--blue)'],['◆','Binance','var(--amber)'],['◎','Kas','var(--green)'],['⬡','Fisik','#8b9ab0']]
              .map(([ic, lb, cl]) => (
                <div key={lb} className="asset-empty-cat">
                  <span style={{ color: cl }}>{ic}</span><span>{lb}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── CHARTS ────────────────────────────────────────────────────── */}
          <div className="asset-chart-row">
            <div className="asset-chart-card">
              <div className="asset-section-title">Distribusi Portofolio</div>
              <div className="asset-chart-body">
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <DonutChart slices={donutSlices} size={164} thickness={26} />
                  <div className="asset-donut-center">
                    <div className="asset-donut-pct">
                      {tAsset > 0 ? `${((tInvest/tAsset)*100).toFixed(0)}%` : '—'}
                    </div>
                    <div className="asset-donut-label">Invest</div>
                  </div>
                </div>
                <div className="asset-legend">
                  {donutSlices.filter(s => s.val > 0).map(s => (
                    <div key={s.label} className="asset-legend-row">
                      <span className="asset-legend-dot" style={{ background: s.color }} />
                      <span className="asset-legend-name">{s.label}</span>
                      <span className="asset-legend-val">{fmt(s.val)}</span>
                      <span className="asset-legend-pct">{s.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="asset-progress-card">
              <div className="asset-section-title">Target Progress</div>
              <div className="asset-progress-big">{prog.toFixed(1)}%</div>
              <div className="asset-progress-track-lg">
                <div className="asset-progress-fill-lg" style={{ width: `${prog}%` }} />
              </div>
              <div className="asset-progress-meta">
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:'0.82rem' }}>{fmt(tAsset)}</span>
                <span style={{ color:'var(--muted)', fontSize:'0.72rem' }}>dari {fmt(target)}</span>
              </div>
              <div className="asset-progress-remaining">
                {prog >= 100
                  ? <span style={{ color:'var(--green)' }}>🎉 Target tercapai!</span>
                  : <>Sisa <strong style={{ fontFamily:"'DM Mono',monospace" }}>{fmt(Math.max(0, target - tAsset))}</strong></>}
              </div>
              <div className="asset-alloc-mini">
                {donutSlices.filter(s => s.val > 0).map(s => (
                  <div key={s.label} className="asset-alloc-mini-row">
                    <span className="asset-alloc-mini-dot" style={{ background: s.color }} />
                    <span className="asset-alloc-mini-name">{s.label}</span>
                    <div className="asset-alloc-mini-track">
                      <div className="asset-alloc-mini-bar" style={{ width:`${s.pct}%`, background: s.color }} />
                    </div>
                    <span className="asset-alloc-mini-pct">{s.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              {editTarget ? (
                <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:10 }}>
                  <NumInput value={newTarget} onChange={v => setNewTarget(v)} className="target-input" />
                  <button className="btn-xs btn-primary" onClick={saveTarget}>OK</button>
                  <button className="btn-xs" onClick={() => setEditTarget(false)}>✕</button>
                </div>
              ) : (
                <button className="asset-hero-target-btn" style={{ marginTop:10 }}
                  onClick={() => { setNewTarget(target); setEditTarget(true) }}>
                  Target: {fmt(target)} ✏
                </button>
              )}
            </div>
          </div>

          {/* ── ASSET TABLE ───────────────────────────────────────────────── */}
          <div style={{ marginTop:'1.5rem' }}>
            <div className="asset-table-header">
              <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                <div className="section-title">Semua Aset</div>
                <span style={{ fontSize:'0.7rem', color:'var(--muted)' }}>
                  {filteredRows.length}{filteredRows.length !== assetRows.length ? `/${assetRows.length}` : ''} item
                  {' · '}{fmt(filteredRows.reduce((s, r) => s + r.value, 0))}
                </span>
              </div>
              <div className="asset-filter-chips">
                {cats.map(cat => (
                  <button key={cat}
                    className={`asset-filter-chip${filterCat === cat ? ' active' : ''}`}
                    onClick={() => { setFilterCat(cat); setShowAll(false) }}>
                    {cat === 'all' ? 'Semua' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      { col:'name',   label:'Nama Aset', cls:'' },
                      { col:'cat',    label:'Kategori',  cls:'' },
                      { col:'value',  label:'Nilai',     cls:'num' },
                      { col:'growth', label:'Return',    cls:'num' },
                    ].map(({ col, label, cls }) => (
                      <th key={col}
                        className={`sortable${cls?' '+cls:''}${sortCol===col?' sorted':''}`}
                        onClick={() => toggleSort(col)}>
                        {label}
                        <span className="sort-icon" style={{ marginLeft:4 }}>
                          {sortCol===col ? (sortDir===-1?'↓':'↑') : '↕'}
                        </span>
                      </th>
                    ))}
                    <th style={{ width:'1%' }} />
                  </tr>
                </thead>
                <tbody>
                  {visRows.length === 0 ? (
                    <tr><td colSpan={5} className="empty-state">
                      {search ? `Tidak ada hasil untuk "${search}"` : 'Tidak ada aset'}
                    </td></tr>
                  ) : visRows.map((r, i) => {
                    const pnl      = r.value - r.invested
                    const pnlP     = r.invested > 0 && r.value !== r.invested ? (pnl / r.invested) * 100 : null
                    const isPos    = pnl >= 0
                    const catStyle = CAT_STYLE[r.category] || { bg:'rgba(255,255,255,0.06)', color:'var(--muted)' }
                    const isEdit   = editingRowId === r.id
                    const canEdit  = r.id !== 'jht'

                    return (
                      <tr key={i} className={isEdit ? 'asset-row-editing' : ''}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ width:3, height:16, background:r.color, borderRadius:2, display:'inline-block', flexShrink:0 }} />
                            <div>
                              <div style={{ fontWeight:600, fontSize:'0.83rem' }}>{r.name}</div>
                              {r.date && <div style={{ fontSize:'0.66rem', color:'var(--muted)', marginTop:1 }}>{relTime(r.date)}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={{ background:catStyle.bg, color:catStyle.color }}>{r.category}</span>
                        </td>
                        <td className="num">
                          {isEdit ? (
                            <div style={{ display:'flex', gap:4, alignItems:'center', justifyContent:'flex-end' }}>
                              <input className="asset-inline-input" type="text" inputMode="numeric"
                                value={editingVal} autoFocus
                                onChange={e => setEditingVal(e.target.value.replace(/\D/g,''))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleInlineEdit(r)
                                  if (e.key === 'Escape') setEditingRowId(null)
                                }} />
                              <button className="btn-icon" disabled={saving} onClick={() => handleInlineEdit(r)}>✓</button>
                              <button className="btn-icon del" onClick={() => setEditingRowId(null)}>✕</button>
                            </div>
                          ) : (
                            <span
                              style={{ fontFamily:"'DM Mono',monospace", fontWeight:600, fontSize:'0.82rem', cursor: canEdit?'pointer':'default' }}
                              onClick={() => { if (!canEdit) return; setEditingRowId(r.id); setEditingVal(String(r.value)) }}
                              title={canEdit ? 'Klik untuk edit nilai' : undefined}>
                              {fmt(r.value)}
                            </span>
                          )}
                        </td>
                        <td className="num">
                          {pnlP !== null ? (
                            <span style={{ color: isPos?'var(--green)':'var(--red)', fontFamily:"'DM Mono',monospace", fontSize:'0.78rem', fontWeight:600 }}>
                              {isPos ? '▲ +' : '▼ '}{pnlP.toFixed(2)}%
                            </span>
                          ) : <span style={{ color:'var(--muted)', fontSize:'0.75rem' }}>—</span>}
                        </td>
                        <td className="actions">
                          <div className="row-actions">
                            {canEdit && (
                              <button className="btn-icon" title="Edit nilai"
                                onClick={() => { setEditingRowId(r.id); setEditingVal(String(r.value)) }}>✏</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredRows.length > SHOW_N && (
                <button className="asset-show-more" onClick={() => setShowAll(v => !v)}>
                  {showAll ? 'Sembunyikan ↑' : `Tampilkan ${filteredRows.length - SHOW_N} lainnya ↓`}
                </button>
              )}
            </div>
          </div>

          {/* ── ACTIVITY TIMELINE ─────────────────────────────────────────── */}
          {recentActivity.length > 0 && (
            <div className="asset-timeline-card">
              <div className="asset-section-title" style={{ marginBottom:'0.875rem' }}>Aktivitas Terbaru</div>
              <div className="asset-timeline">
                {recentActivity.map((r, i) => {
                  const cs = CAT_STYLE[r.category] || { bg:'rgba(255,255,255,0.06)', color:'var(--muted)' }
                  return (
                    <div key={i} className="asset-tl-item">
                      <div className="asset-tl-dot" style={{ background: r.color }} />
                      <div className="asset-tl-line" style={{ opacity: i === recentActivity.length-1 ? 0 : 1 }} />
                      <div className="asset-tl-content">
                        <div className="asset-tl-top">
                          <span className="asset-tl-action">Tambah aset</span>
                          <span className="badge" style={{ background:cs.bg, color:cs.color, fontSize:'0.62rem' }}>{r.category}</span>
                        </div>
                        <div className="asset-tl-name">{r.name}</div>
                        <div className="asset-tl-meta">
                          <span style={{ fontFamily:"'DM Mono',monospace", color:'var(--text)', fontSize:'0.75rem' }}>{fmt(r.value)}</span>
                          {r.date && <span style={{ color:'var(--muted)', fontSize:'0.7rem' }}>{relTime(r.date)}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {showQuickAdd && (
        <QuickAddModal onClose={() => setShowQuickAdd(false)} onTab={onTab || (() => {})} />
      )}
    </div>
  )
}
