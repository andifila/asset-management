// src/pages/WeddingPlanner.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/format'
import Toast from '../components/Toast'
import Pagination, { paginate } from '../components/Pagination'

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Gedung/Venue', 'Catering', 'Dekorasi', 'Wedding Organizer',
  'Foto & Video', 'Busana & Gaun', 'Cincin', 'Undangan',
  'Entertainment', 'Honeymoon', 'Lain-lain',
]

const TX_TYPES = ['DP', 'Pelunasan', 'Cicilan', 'Lainnya']

const CAT_COLORS = {
  'Gedung/Venue':        'var(--blue)',
  'Catering':            'var(--amber)',
  'Dekorasi':            'var(--purple)',
  'Wedding Organizer':   'var(--green)',
  'Foto & Video':        '#e05252',
  'Busana & Gaun':       '#e9a229',
  'Cincin':              '#f0c040',
  'Undangan':            '#5a6b8a',
  'Entertainment':       'var(--blue)',
  'Honeymoon':           'var(--green)',
  'Lain-lain':           'var(--muted)',
}

const STATUS_CFG = {
  over:   { label: 'Over Budget', color: 'var(--red)',   bg: 'rgba(224,82,82,0.10)',   bd: 'rgba(224,82,82,0.25)'   },
  near:   { label: 'Hampir',      color: 'var(--amber)', bg: 'rgba(233,162,41,0.09)',  bd: 'rgba(233,162,41,0.22)'  },
  ok:     { label: 'On Track',    color: 'var(--green)', bg: 'rgba(61,186,126,0.09)',  bd: 'rgba(61,186,126,0.22)'  },
  nodata: { label: 'Belum Ada',   color: 'var(--muted)', bg: 'rgba(255,255,255,0.03)', bd: 'rgba(255,255,255,0.08)' },
}

function getItemStatus(budgetMax, actual) {
  if (actual === 0) return 'nodata'
  const pct = actual / (budgetMax || 1)
  if (pct > 1)   return 'over'
  if (pct >= 0.8) return 'near'
  return 'ok'
}

// ── Count-up animation ───────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    const start = performance.now()
    const tick = ts => {
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtRp = n => n ? 'Rp ' + Number(n).toLocaleString('id-ID') : '—'
const relTime = d => {
  if (!d) return ''
  const n = Math.floor((Date.now() - new Date(d)) / 86400000)
  if (n === 0) return 'hari ini'
  if (n === 1) return 'kemarin'
  if (n < 30)  return `${n} hari lalu`
  return `${Math.floor(n / 30)} bln lalu`
}

// ── Smart Insights ───────────────────────────────────────────────────────────
function generateInsights(items, totalBudget, totalSpent, totalRemaining) {
  if (items.length === 0) return []
  const out = []
  const pct        = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const overItems  = items.filter(it => it.actual > 0 && it.actual > (it.budget_max || 0))
  const nearItems  = items.filter(it => it.actual > 0 && it.actual >= (it.budget_max || 0) * 0.8 && it.actual <= (it.budget_max || 0))

  if (overItems.length > 0)
    out.push({ icon: '⚠', text: `${overItems.map(i => i.category).join(', ')} melebihi budget!`, type: 'danger' })

  if (pct >= 90)
    out.push({ icon: '🔥', text: `Budget hampir habis! Tersisa ${fmtRp(totalRemaining)}.`, type: 'warning' })
  else if (pct >= 70)
    out.push({ icon: '📊', text: `${pct.toFixed(0)}% budget terpakai. Pantau pengeluaran berikutnya.`, type: 'info' })
  else if (pct < 60 && totalSpent > 0)
    out.push({ icon: '✅', text: `Pengeluaran masih aman di ${pct.toFixed(0)}% dari total budget 👍`, type: 'positive' })

  if (nearItems.length > 0 && !overItems.some(o => nearItems.includes(o)))
    out.push({ icon: '🔔', text: `${nearItems.map(i => i.category).join(', ')} mendekati batas budget.`, type: 'warning' })

  if (totalRemaining > 0 && pct >= 20)
    out.push({ icon: '💰', text: `Sisa budget ${fmtRp(totalRemaining)} dari total ${fmtRp(totalBudget)}.`, type: 'info' })

  return out.slice(0, 3)
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function WeddingSkeleton() {
  return (
    <main className="main-content">
      <div className="wp-hero-card">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="skel-line skel-h-sm" style={{ width: 130, display: 'block' }} />
          <span className="skel-line skel-h-lg" style={{ width: 240, display: 'block' }} />
          <span className="skel-line skel-h-sm" style={{ width: '100%', display: 'block' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {[1, 2].map(i => (
            <div key={i} className="wp-stat-card" style={{ minWidth: 140 }}>
              <span className="skel-line skel-h-sm" style={{ width: '55%', display: 'block', marginBottom: 8 }} />
              <span className="skel-line skel-h-lg" style={{ width: '75%', display: 'block', marginBottom: 6 }} />
              <span className="skel-line skel-h-sm" style={{ width: '45%', display: 'block' }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mod-stat-row">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="mod-stat-card">
            <span className="skel-line skel-h-sm" style={{ width: '55%', display: 'block', marginBottom: 8 }} />
            <span className="skel-line skel-h-lg" style={{ width: '70%', display: 'block', marginBottom: 6 }} />
            <span className="skel-line skel-h-sm" style={{ width: '40%', display: 'block' }} />
          </div>
        ))}
      </div>
      <div className="table-wrap">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '0.75rem 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <span className="skel-line skel-h-sm" style={{ width: 100, display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 90,  display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 80,  display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ flex: 1,    display: 'block' }} />
            <span className="skel-line skel-h-sm" style={{ width: 70,  display: 'block' }} />
          </div>
        ))}
      </div>
    </main>
  )
}

// ── Add Budget Item Modal ─────────────────────────────────────────────────────
function AddItemModal({ item, uid, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    category:   item?.category   || CATEGORIES[0],
    vendor:     item?.vendor     || '',
    budget_max: item?.budget_max ? String(item.budget_max) : '',
    estimate:   item?.estimate   ? String(item.estimate)   : '',
    notes:      item?.notes      || '',
  })
  const [err,    setErr]    = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.vendor.trim())        { setErr('Nama vendor wajib diisi'); return }
    if (!form.budget_max)           { setErr('Budget maksimal wajib diisi'); return }
    const bMax = Number(form.budget_max.replace(/\D/g, ''))
    if (!bMax)                      { setErr('Budget maksimal harus angka'); return }
    setSaving(true)
    const payload = {
      user_id:    uid,
      category:   form.category,
      vendor:     form.vendor.trim(),
      budget_max: bMax,
      estimate:   form.estimate ? Number(form.estimate.replace(/\D/g, '')) : null,
      notes:      form.notes.trim() || null,
    }
    const { error } = item?.id
      ? await supabase.from('wedding_budget_items').update(payload).eq('id', item.id).eq('user_id', uid)
      : await supabase.from('wedding_budget_items').insert(payload)
    if (error) { setErr(error.message); setSaving(false); return }
    showToast(item?.id ? 'Item diperbarui' : 'Budget item ditambahkan')
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">{item ? 'Edit Budget Item' : '+ Tambah Budget Item'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Kategori</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Vendor / Nama</label>
            <input value={form.vendor} onChange={e => set('vendor', e.target.value)}
              placeholder="e.g. Venus Garden, Pak Budi WO" autoFocus />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Budget Maksimal (Rp)</label>
              <input inputMode="numeric" value={form.budget_max}
                onChange={e => set('budget_max', e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 15000000" />
            </div>
            <div className="field">
              <label>Estimasi (Rp) <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none' }}>opsional</span></label>
              <input inputMode="numeric" value={form.estimate}
                onChange={e => set('estimate', e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 12000000" />
            </div>
          </div>
          <div className="field">
            <label>Catatan <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none' }}>opsional</span></label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Info tambahan tentang vendor..." />
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

// ── Add Transaction Modal ─────────────────────────────────────────────────────
function AddTxModal({ tx, uid, items, defaultItemId, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    budget_item_id: tx?.budget_item_id || defaultItemId || items[0]?.id || '',
    amount: tx?.amount ? String(tx.amount) : '',
    type:   tx?.type   || 'DP',
    date:   tx?.date   || new Date().toISOString().slice(0, 10),
    note:   tx?.note   || '',
  })
  const [err,    setErr]    = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const selItem = items.find(it => it.id === form.budget_item_id)

  const save = async () => {
    if (!form.budget_item_id)        { setErr('Pilih kategori'); return }
    if (!form.amount)                { setErr('Jumlah pembayaran wajib diisi'); return }
    const amt = Number(form.amount.replace(/\D/g, ''))
    if (!amt)                        { setErr('Jumlah harus berupa angka'); return }
    if (!form.date)                  { setErr('Tanggal wajib diisi'); return }
    setSaving(true)
    const payload = {
      user_id:        uid,
      budget_item_id: form.budget_item_id,
      category:       selItem?.category || '',
      amount:         amt,
      type:           form.type,
      date:           form.date,
      note:           form.note.trim() || null,
    }
    const { error } = tx?.id
      ? await supabase.from('wedding_transactions').update(payload).eq('id', tx.id).eq('user_id', uid)
      : await supabase.from('wedding_transactions').insert(payload)
    if (error) { setErr(error.message); setSaving(false); return }
    showToast(tx?.id ? 'Pembayaran diperbarui' : 'Pembayaran dicatat')
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">{tx ? 'Edit Pembayaran' : '+ Tambah Pembayaran'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Kategori</label>
            <select value={form.budget_item_id} onChange={e => set('budget_item_id', e.target.value)}>
              {items.map(it => (
                <option key={it.id} value={it.id}>{it.category} — {it.vendor}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Jumlah (Rp)</label>
            <input inputMode="numeric" value={form.amount}
              onChange={e => set('amount', e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 5000000" autoFocus />
          </div>
          <div className="field">
            <label>Tipe Pembayaran</label>
            <div className="wp-type-pills">
              {TX_TYPES.map(tp => (
                <button key={tp} type="button"
                  className={`wp-type-pill${form.type === tp ? ' active' : ''}`}
                  onClick={() => set('type', tp)}>
                  {tp}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Tanggal</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label>Catatan <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none' }}>opsional</span></label>
            <input value={form.note} onChange={e => set('note', e.target.value)}
              placeholder="e.g. DP pertama, transfer BCA" />
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function WeddingPlanner({ session, onHome }) {
  const [items,        setItems]        = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedId,   setSelectedId]   = useState(null)
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [editItem,     setEditItem]     = useState(null)
  const [showAddTx,    setShowAddTx]    = useState(false)
  const [editTx,       setEditTx]       = useState(null)
  const [txItemId,     setTxItemId]     = useState(null)
  const [txPage,       setTxPage]       = useState(1)
  const [toast,        setToast]        = useState(null)
  const toastKey = useRef(0)

  const uid  = session.user.id
  const name = session.user.user_metadata?.full_name?.split(' ')[0] || 'Kamu'

  const showToast = useCallback((msg, type = 'success') => {
    toastKey.current += 1
    setToast({ message: msg, type, key: toastKey.current })
  }, [])

  const fetchAll = useCallback(async () => {
    const [itemsRes, txRes] = await Promise.all([
      supabase.from('wedding_budget_items').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('wedding_transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
    ])
    setItems(itemsRes.data || [])
    setTransactions(txRes.data || [])
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Computed ────────────────────────────────────────────────────────────────
  const itemsWithStats = useMemo(() => items.map(it => {
    const txs    = transactions.filter(t => t.budget_item_id === it.id)
    const actual = txs.reduce((s, t) => s + Number(t.amount || 0), 0)
    const diff   = (it.budget_max || 0) - actual
    const status = getItemStatus(it.budget_max || 0, actual)
    const color  = CAT_COLORS[it.category] || 'var(--muted)'
    return { ...it, actual, diff, status, txs, color }
  }), [items, transactions])

  const totalBudget    = itemsWithStats.reduce((s, it) => s + (it.budget_max || 0), 0)
  const totalEstimate  = itemsWithStats.reduce((s, it) => s + (it.estimate   || 0), 0)
  const totalSpent     = itemsWithStats.reduce((s, it) => s + it.actual, 0)
  const totalRemaining = Math.max(0, totalBudget - totalSpent)
  const progress       = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0
  const isOverBudget   = totalSpent > totalBudget && totalBudget > 0

  const animBudget  = useCountUp(totalBudget)
  const animSpent   = useCountUp(totalSpent)
  const animRemain  = useCountUp(totalRemaining)

  const selectedItem = itemsWithStats.find(it => it.id === selectedId) || null
  const detailTxs    = selectedItem
    ? [...selectedItem.txs].sort((a, b) => new Date(b.date) - new Date(a.date))
    : []
  const pagedTxs = paginate(detailTxs, txPage)

  const recentActivity = useMemo(() =>
    [...transactions]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 7)
      .map(tx => {
        const it = items.find(i => i.id === tx.budget_item_id)
        return { ...tx, catLabel: it?.category || tx.category, vendor: it?.vendor || '' }
      }),
  [transactions, items])

  const insights = useMemo(() =>
    generateInsights(itemsWithStats, totalBudget, totalSpent, totalRemaining),
  [itemsWithStats, totalBudget, totalSpent, totalRemaining])

  const isEmpty = items.length === 0

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openAddTx = (itemId = null) => {
    setTxItemId(itemId); setEditTx(null); setShowAddTx(true)
  }

  const handleDeleteItem = async id => {
    if (!confirm('Hapus budget item ini? Semua transaksi terkait juga akan dihapus.')) return
    await supabase.from('wedding_transactions').delete().eq('budget_item_id', id).eq('user_id', uid)
    const { error } = await supabase.from('wedding_budget_items').delete().eq('id', id).eq('user_id', uid)
    if (error) { showToast(error.message, 'error'); return }
    if (selectedId === id) setSelectedId(null)
    showToast('Item dihapus')
    fetchAll()
  }

  const handleDeleteTx = async id => {
    if (!confirm('Hapus transaksi ini?')) return
    const { error } = await supabase.from('wedding_transactions').delete().eq('id', id).eq('user_id', uid)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Transaksi dihapus')
    fetchAll()
  }

  const progressColor = isOverBudget ? 'var(--red)' : progress >= 80 ? 'var(--amber)' : 'var(--purple)'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── TOPBAR ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span style={{ color: 'var(--purple)', fontSize: '1.1rem' }}>💒</span>
          <span>Wedding Planner</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isEmpty && (
            <button className="asset-btn-primary" onClick={() => openAddTx(null)}
              style={{ padding: '0.38rem 0.875rem', fontSize: '0.78rem' }}>
              + Pembayaran
            </button>
          )}
          <button className="btn-back" onClick={onHome}>← Beranda</button>
        </div>
      </header>

      {/* ── LOADING ── */}
      {loading ? <WeddingSkeleton /> : isEmpty ? (

        /* ── EMPTY STATE ── */
        <main className="main-content">
          <div className="asset-empty">
            <div className="asset-empty-glow" />
            <div className="asset-empty-icon">💒</div>
            <div className="asset-empty-title">Belum ada data wedding 👀</div>
            <div className="asset-empty-sub">
              Rencanakan pernikahan impianmu. Catat setiap kategori, vendor, dan pembayaran di satu tempat.
            </div>
            <button className="asset-btn-primary"
              style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}
              onClick={() => setShowAddItem(true)}>
              + Tambah Budget Pertama
            </button>
            <div className="asset-empty-cats" style={{ marginTop: '1.5rem' }}>
              {[['💒','Gedung','var(--blue)'],['🍽','Catering','var(--amber)'],['💍','Cincin','#f0c040'],['📸','Foto','var(--red)']].map(([ic, lb, cl]) => (
                <div key={lb} className="asset-empty-cat">
                  <span style={{ color: cl }}>{ic}</span>
                  <span>{lb}</span>
                </div>
              ))}
            </div>
          </div>
        </main>

      ) : (
        <main className="main-content">

          {/* ── HERO CARD ── */}
          <div className="wp-hero-card">
            <div className="wp-hero-left">
              <div className="wp-hero-eyebrow">💒 Wedding Budget — {name}</div>
              <div className="wp-hero-label">Total Budget</div>
              <div className="wp-hero-val">Rp {animBudget.toLocaleString('id-ID')}</div>
              <div className="wp-progress-wrap">
                <div className="wp-progress-track">
                  <div className="wp-progress-fill" style={{ width: `${progress}%`, background: progressColor }} />
                </div>
                <div className="wp-progress-meta">
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                    {progress.toFixed(1)}% terpakai
                  </span>
                  <span className={`wp-status-badge ${isOverBudget ? 'danger' : 'ok'}`}>
                    {isOverBudget ? '⚠ Over Budget' : '✓ On Track'}
                  </span>
                </div>
              </div>
            </div>

            <div className="wp-hero-right">
              <div className="wp-stat-card">
                <div className="wp-stat-eyebrow">Sudah Dibayar</div>
                <div className="wp-stat-val" style={{ color: 'var(--amber)' }}>
                  Rp {animSpent.toLocaleString('id-ID')}
                </div>
                <div className="wp-stat-sub">
                  {itemsWithStats.filter(it => it.actual > 0).length}/{items.length} kategori aktif
                </div>
              </div>
              <div className="wp-stat-card">
                <div className="wp-stat-eyebrow">Sisa Budget</div>
                <div className="wp-stat-val" style={{ color: totalRemaining > 0 ? 'var(--green)' : 'var(--red)' }}>
                  Rp {animRemain.toLocaleString('id-ID')}
                </div>
                <div className="wp-stat-sub">{totalRemaining > 0 ? 'tersisa' : '⚠ over budget!'}</div>
              </div>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="mod-stat-row">
            {[
              { label: 'Total Budget',  val: fmt(totalBudget),   sub: `${items.length} kategori`,              color: 'var(--blue)'   },
              { label: 'Estimasi',      val: totalEstimate > 0 ? fmt(totalEstimate) : '—', sub: 'total estimasi', color: 'var(--purple)' },
              { label: 'Total Dibayar', val: fmt(totalSpent),    sub: `${progress.toFixed(1)}% terpakai`,      color: 'var(--amber)'  },
              { label: 'Sisa',          val: fmt(totalRemaining),sub: totalRemaining >= 0 ? 'dana tersisa' : 'over!', color: totalRemaining >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map((c, i) => (
              <div key={i} className="mod-stat-card">
                <div className="mod-stat-label">{c.label}</div>
                <div className="mod-stat-val" style={{ color: c.color }}>{c.val}</div>
                <div className="mod-stat-sub">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* ── INSIGHTS ── */}
          {insights.length > 0 && (
            <div className="mod-insight-strip">
              {insights.map((ins, i) => (
                <div key={i} className={`mod-insight-chip mod-chip-${ins.type}`}>
                  <span className="mod-chip-icon">{ins.icon}</span>
                  <span className="mod-chip-text">{ins.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTION BAR ── */}
          <div className="wp-action-bar">
            <div>
              <div className="wp-action-title">Budget Categories</div>
              <div className="wp-action-sub">
                {items.length} kategori · {transactions.length} transaksi
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="asset-btn-secondary"
                onClick={() => { setEditItem(null); setShowAddItem(true) }}>
                + Kategori
              </button>
              <button className="asset-btn-primary" onClick={() => openAddTx(null)}>
                + Pembayaran
              </button>
            </div>
          </div>

          {/* ── MAIN LAYOUT: TABLE + DETAIL PANEL ── */}
          <div className="wp-layout">

            {/* ── CATEGORY TABLE ── */}
            <div className="wp-table-section">
              <div className="table-wrap" style={{ marginBottom: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Kategori</th>
                      <th>Vendor</th>
                      <th className="num">Budget Max</th>
                      <th className="num">Estimasi</th>
                      <th className="num">Dibayar</th>
                      <th className="num">Selisih</th>
                      <th>Status</th>
                      <th style={{ width: '1%' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {itemsWithStats.map(it => {
                      const st        = STATUS_CFG[it.status]
                      const isSelected = selectedId === it.id
                      const spentPct  = it.budget_max > 0
                        ? Math.min((it.actual / it.budget_max) * 100, 100) : 0

                      return (
                        <tr key={it.id}
                          className={`wp-row${isSelected ? ' wp-row-selected' : ''}`}
                          onClick={() => { setSelectedId(isSelected ? null : it.id); setTxPage(1) }}>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 3, height: 16, background: it.color, borderRadius: 2, flexShrink: 0 }} />
                              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{it.category}</span>
                            </div>
                          </td>

                          <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{it.vendor || '—'}</td>

                          <td className="num" style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.82rem' }}>
                            {it.budget_max ? fmtRp(it.budget_max) : '—'}
                          </td>

                          <td className="num" style={{ fontFamily: "'DM Mono',monospace", color: 'var(--muted)', fontSize: '0.8rem' }}>
                            {it.estimate ? fmtRp(it.estimate) : '—'}
                          </td>

                          <td className="num">
                            <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: '0.82rem' }}>
                              {it.actual > 0 ? fmtRp(it.actual) : '—'}
                            </div>
                            {it.budget_max > 0 && it.actual > 0 && (
                              <div className="wp-mini-track">
                                <div className="wp-mini-fill" style={{ width: `${spentPct}%`, background: st.color }} />
                              </div>
                            )}
                          </td>

                          <td className="num">
                            <span style={{
                              fontFamily: "'DM Mono',monospace", fontSize: '0.8rem', fontWeight: 600,
                              color: it.actual === 0 ? 'var(--muted)' : it.diff >= 0 ? 'var(--green)' : 'var(--red)',
                            }}>
                              {it.actual === 0 ? '—' : (it.diff >= 0 ? '+' : '') + fmtRp(it.diff)}
                            </span>
                          </td>

                          <td>
                            <span className="wp-status-chip"
                              style={{ color: st.color, background: st.bg, border: `1px solid ${st.bd}` }}>
                              {st.label}
                            </span>
                          </td>

                          <td className="actions" onClick={e => e.stopPropagation()}>
                            <div className="row-actions">
                              <button className="btn-icon" title="Tambah pembayaran"
                                onClick={() => openAddTx(it.id)}>💳</button>
                              <button className="btn-icon" title="Edit"
                                onClick={() => { setEditItem(it); setShowAddItem(true) }}>✏</button>
                              <button className="btn-icon del" title="Hapus"
                                onClick={() => handleDeleteItem(it.id)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── DETAIL PANEL (selected category) ── */}
            {selectedItem && (
              <div className="wp-detail-panel">
                <div className="wp-detail-head">
                  <div>
                    <div className="wp-detail-cat" style={{ color: selectedItem.color }}>
                      {selectedItem.category}
                    </div>
                    <div className="wp-detail-vendor">{selectedItem.vendor}</div>
                  </div>
                  <button className="wp-detail-close" onClick={() => setSelectedId(null)}>×</button>
                </div>

                {/* Budget breakdown */}
                <div className="wp-detail-stats">
                  {[
                    { label: 'Budget Max', val: fmtRp(selectedItem.budget_max), color: 'var(--blue)'   },
                    { label: 'Dibayar',    val: fmtRp(selectedItem.actual),     color: 'var(--amber)'  },
                    { label: 'Selisih',
                      val: selectedItem.actual === 0 ? '—' : (selectedItem.diff >= 0 ? '+' : '') + fmtRp(selectedItem.diff),
                      color: selectedItem.actual === 0 ? 'var(--muted)' : selectedItem.diff >= 0 ? 'var(--green)' : 'var(--red)' },
                  ].map((s, i) => (
                    <div key={i} className="wp-detail-stat">
                      <div className="mod-stat-label">{s.label}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: s.color, fontSize: '0.9rem' }}>
                        {s.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                {selectedItem.budget_max > 0 && (
                  <>
                    <div className="wp-progress-track" style={{ height: 5, marginBottom: 4 }}>
                      <div className="wp-progress-fill" style={{
                        width: `${Math.min((selectedItem.actual / selectedItem.budget_max) * 100, 100)}%`,
                        background: STATUS_CFG[selectedItem.status].color,
                      }} />
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--muted)', textAlign: 'right', marginBottom: '1rem' }}>
                      {selectedItem.budget_max > 0
                        ? ((selectedItem.actual / selectedItem.budget_max) * 100).toFixed(1) : 0}% terpakai
                    </div>
                  </>
                )}

                {/* Transactions header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div className="asset-section-title">Riwayat Pembayaran</div>
                  <button className="asset-btn-primary"
                    style={{ padding: '0.28rem 0.7rem', fontSize: '0.72rem' }}
                    onClick={() => openAddTx(selectedItem.id)}>
                    + Bayar
                  </button>
                </div>

                {/* Transaction list */}
                {detailTxs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
                    Belum ada pembayaran tercatat
                  </div>
                ) : (
                  <div className="wp-tx-list">
                    {pagedTxs.map((tx, i) => {
                      const typeColor =
                        tx.type === 'DP'        ? { bg: 'rgba(74,144,217,0.14)',  color: 'var(--blue)',   bd: 'rgba(74,144,217,0.25)'  } :
                        tx.type === 'Pelunasan' ? { bg: 'rgba(61,186,126,0.14)',  color: 'var(--green)',  bd: 'rgba(61,186,126,0.25)'  } :
                                                  { bg: 'rgba(139,125,232,0.14)', color: 'var(--purple)', bd: 'rgba(139,125,232,0.25)' }
                      return (
                        <div key={tx.id} className="wp-tx-item">
                          <div className="wp-tx-dot" style={{ background: typeColor.color }} />
                          <div className="wp-tx-line" style={{ opacity: i === pagedTxs.length - 1 ? 0 : 1 }} />
                          <div className="wp-tx-body">
                            <div className="wp-tx-top">
                              <span className="wp-tx-badge"
                                style={{ background: typeColor.bg, color: typeColor.color, border: `1px solid ${typeColor.bd}` }}>
                                {tx.type}
                              </span>
                              <span className="wp-tx-date">{fmtDate(tx.date)}</span>
                            </div>
                            <div className="wp-tx-amount">Rp {Number(tx.amount).toLocaleString('id-ID')}</div>
                            {tx.note && <div className="wp-tx-note">{tx.note}</div>}
                          </div>
                          <div className="row-actions" style={{ flexShrink: 0, alignSelf: 'flex-start' }}
                            onClick={e => e.stopPropagation()}>
                            <button className="btn-icon"
                              onClick={() => { setEditTx(tx); setTxItemId(tx.budget_item_id); setShowAddTx(true) }}>✏</button>
                            <button className="btn-icon del"
                              onClick={() => handleDeleteTx(tx.id)}>✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Pagination total={detailTxs.length} page={txPage} onChange={setTxPage} />

                {selectedItem.notes && (
                  <div className="wp-detail-notes">
                    <span style={{ color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Catatan</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{selectedItem.notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVITY TIMELINE (when nothing selected) ── */}
            {!selectedItem && recentActivity.length > 0 && (
              <div className="wp-activity-panel">
                <div className="asset-section-title" style={{ marginBottom: '1rem' }}>
                  Aktivitas Terbaru
                </div>
                <div className="wp-tx-list">
                  {recentActivity.map((tx, i) => (
                    <div key={tx.id} className="wp-tx-item">
                      <div className="wp-tx-dot" style={{ background: 'var(--purple)' }} />
                      <div className="wp-tx-line"
                        style={{ opacity: i === recentActivity.length - 1 ? 0 : 1 }} />
                      <div className="wp-tx-body">
                        <div className="wp-tx-top">
                          <span className="wp-tx-badge"
                            style={{ background: 'rgba(139,125,232,0.14)', color: 'var(--purple)', border: '1px solid rgba(139,125,232,0.25)' }}>
                            {tx.type}
                          </span>
                          <span className="wp-tx-date">{relTime(tx.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                          {tx.catLabel}{tx.vendor ? ` — ${tx.vendor}` : ''}
                        </div>
                        <div className="wp-tx-amount">Rp {Number(tx.amount).toLocaleString('id-ID')}</div>
                        {tx.note && <div className="wp-tx-note">{tx.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </main>
      )}

      {/* ── MODALS ── */}
      {(showAddItem || editItem) && (
        <AddItemModal
          item={editItem}
          uid={uid}
          onClose={() => { setShowAddItem(false); setEditItem(null) }}
          onSaved={fetchAll}
          showToast={showToast}
        />
      )}
      {showAddTx && (
        <AddTxModal
          tx={editTx}
          uid={uid}
          items={itemsWithStats}
          defaultItemId={txItemId}
          onClose={() => { setShowAddTx(false); setEditTx(null); setTxItemId(null) }}
          onSaved={fetchAll}
          showToast={showToast}
        />
      )}

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  )
}
