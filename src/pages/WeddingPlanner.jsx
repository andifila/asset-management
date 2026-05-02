// src/pages/WeddingPlanner.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/format'
import Toast from '../components/Toast'
import Pagination, { paginate } from '../components/Pagination'
import { useLang } from '../lib/LangContext'

// ── Constants ────────────────────────────────────────────────────────────────
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
}

const TX_TYPES = ['DP', 'Pelunasan', 'Cicilan', 'Lainnya']

const STATUS_KEYS = {
  over:   { labelKey: 'wpOverBudget', color: 'var(--red)',   bg: 'rgba(224,82,82,0.10)',   bd: 'rgba(224,82,82,0.25)'   },
  near:   { labelKey: 'wpNearLimit',  color: 'var(--amber)', bg: 'rgba(233,162,41,0.09)',  bd: 'rgba(233,162,41,0.22)'  },
  ok:     { labelKey: 'wpOnTrack',    color: 'var(--green)', bg: 'rgba(61,186,126,0.09)',  bd: 'rgba(61,186,126,0.22)'  },
  nodata: { labelKey: 'wpNoData',     color: 'var(--muted)', bg: 'rgba(255,255,255,0.03)', bd: 'rgba(255,255,255,0.08)' },
}

function getItemStatus(budgetMax, actual) {
  if (actual === 0) return 'nodata'
  const pct = actual / (budgetMax || 1)
  if (pct > 1)    return 'over'
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
const fmtThousands = v => v ? Number(v).toLocaleString('id-ID') : ''
const parseNum = v => String(v).replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')
const relTime = d => {
  if (!d) return ''
  const n = Math.floor((Date.now() - new Date(d)) / 86400000)
  if (n === 0) return 'hari ini'
  if (n === 1) return 'kemarin'
  if (n < 30)  return `${n} hari lalu`
  return `${Math.floor(n / 30)} bln lalu`
}
const catColor = name => CAT_COLORS[name] || 'var(--purple)'

// ── Smart Insights ───────────────────────────────────────────────────────────
function generateInsights(items, effectiveBudget, totalSpent, totalRemaining) {
  if (items.length === 0) return []
  const out = []
  const pct       = effectiveBudget > 0 ? (totalSpent / effectiveBudget) * 100 : 0
  const overItems = items.filter(it => it.actual > 0 && it.actual > (it.budget_max || 0))
  const nearItems = items.filter(it => it.actual > 0 && it.actual >= (it.budget_max || 0) * 0.8 && it.actual <= (it.budget_max || 0))

  if (overItems.length > 0)
    out.push({ icon: '⚠', text: `${overItems.map(i => i.category).join(', ')} melebihi budget!`, type: 'danger' })
  if (pct >= 90)
    out.push({ icon: '🔥', text: `Budget hampir habis! Tersisa ${fmtRp(totalRemaining)}.`, type: 'warning' })
  else if (pct >= 70)
    out.push({ icon: '📊', text: `${pct.toFixed(0)}% budget terpakai. Pantau pengeluaran.`, type: 'info' })
  else if (pct < 60 && totalSpent > 0)
    out.push({ icon: '✅', text: `Pengeluaran aman di ${pct.toFixed(0)}% dari total budget 👍`, type: 'positive' })
  if (nearItems.length > 0 && !overItems.some(o => nearItems.includes(o)))
    out.push({ icon: '🔔', text: `${nearItems.map(i => i.category).join(', ')} mendekati batas budget.`, type: 'warning' })
  if (totalRemaining > 0 && pct >= 20)
    out.push({ icon: '💰', text: `Sisa budget ${fmtRp(totalRemaining)} dari total ${fmtRp(effectiveBudget)}.`, type: 'info' })

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
    </main>
  )
}

// ── Global Budget Modal ───────────────────────────────────────────────────────
function GlobalBudgetModal({ uid, currentBudget, onClose, onSaved, showToast }) {
  const { t } = useLang()
  const [value,  setValue]  = useState(currentBudget ? String(currentBudget) : '')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const save = async () => {
    const num = value ? Number(parseNum(value)) : 0
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('wedding_settings')
        .upsert({ user_id: uid, total_budget: num }, { onConflict: 'user_id' })
      if (error) {
        const { error: iErr } = await supabase.from('wedding_settings')
          .insert({ user_id: uid, total_budget: num })
        if (iErr) { setErr(iErr.message); setSaving(false); return }
      }
      showToast(t('wpBudgetSaved'))
      onSaved(); onClose()
    } catch (e) {
      setErr(e.message || 'Error'); setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title">💰 {t('wpTotalBudget')}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginBottom: '0.85rem' }}>
            {t('wpGlobalBudgetHint')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.84rem', flexShrink: 0 }}>Rp</span>
            <input
              autoFocus
              inputMode="numeric"
              value={fmtThousands(value)}
              onChange={e => setValue(parseNum(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="e.g. 150.000.000"
              style={{ flex: 1, fontFamily: "'DM Mono',monospace", fontSize: '1.05rem', fontWeight: 700 }}
            />
          </div>
          {err && <div className="modal-error" style={{ marginTop: '0.6rem' }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-save" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Setup Modal (categories only) ─────────────────────────────────────────────
function SetupModal({ uid, items, onClose, onSaved, showToast }) {
  const { t } = useLang()

  const [rows, setRows] = useState(() =>
    items.map(it => ({
      id:         it.id,
      category:   it.category,
      budget_max: it.budget_max ? String(it.budget_max) : '',
      deleted:    false,
      isNew:      false,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const setRow = (i, k, v) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const addRow = () =>
    setRows(prev => [...prev, { id: null, category: '', budget_max: '', deleted: false, isNew: true }])

  const toggleDelete = i => {
    if (!rows[i].id) {
      setRows(prev => prev.filter((_, idx) => idx !== i))
    } else {
      setRow(i, 'deleted', !rows[i].deleted)
    }
  }

  const save = async () => {
    const activeRows = rows.filter(r => !r.deleted)
    const names = activeRows.map(r => r.category.trim()).filter(Boolean)
    if (new Set(names).size !== names.length) { setErr(t('wpErrDupCat')); return }

    setSaving(true); setErr('')

    try {
      // Delete marked rows
      for (const row of rows.filter(r => r.deleted && r.id)) {
        await supabase.from('wedding_transactions').delete().eq('budget_item_id', row.id).eq('user_id', uid)
        await supabase.from('wedding_budget_items').delete().eq('id', row.id).eq('user_id', uid)
      }

      // Insert new rows
      const toInsert = activeRows.filter(r => !r.id && r.category.trim()).map(r => ({
        user_id:    uid,
        category:   r.category.trim(),
        vendor:     r.category.trim(),
        budget_max: r.budget_max ? Number(parseNum(r.budget_max)) : 0,
      }))
      if (toInsert.length > 0) {
        const { error } = await supabase.from('wedding_budget_items').insert(toInsert)
        if (error) { setErr(error.message); setSaving(false); return }
      }

      // Update existing rows
      const errs = await Promise.all(
        activeRows.filter(r => r.id).map(r =>
          supabase.from('wedding_budget_items')
            .update({
              category:   r.category.trim() || r.category,
              budget_max: r.budget_max ? Number(parseNum(r.budget_max)) : 0,
            })
            .eq('id', r.id).eq('user_id', uid)
            .then(res => res.error)
        )
      )
      const firstErr = errs.find(Boolean)
      if (firstErr) { setErr(firstErr.message || 'Update gagal'); setSaving(false); return }

      showToast(t('wpSetupSaved'))
      onSaved(); onClose()
    } catch (e) {
      setErr(e.message || 'Terjadi kesalahan')
      setSaving(false)
    }
  }

  const deletedCount = rows.filter(r => r.deleted).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3 className="modal-title">{t('wpSetupTitle')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Category list header ── */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, fontSize: '0.67rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('wpCategory')}
            </div>
            <div style={{ width: 156, fontSize: '0.67rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', paddingRight: 6 }}>
              {t('wpMaxBudget')}
            </div>
            <div style={{ width: 28 }} />
          </div>

          {/* ── Category rows ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
            {rows.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: r.deleted ? 0.35 : 1,
                transition: 'opacity 0.15s',
              }}>
                <input
                  value={r.category}
                  onChange={e => setRow(i, 'category', e.target.value)}
                  placeholder="Nama kategori..."
                  disabled={r.deleted}
                  autoFocus={r.isNew}
                  style={{
                    flex: 1, fontSize: '0.85rem', padding: '0.33rem 0.6rem',
                    textDecoration: r.deleted ? 'line-through' : 'none',
                    color: r.deleted ? 'var(--muted)' : catColor(r.category),
                    fontWeight: 600,
                  }}
                />
                <input
                  inputMode="numeric"
                  value={fmtThousands(r.budget_max)}
                  onChange={e => setRow(i, 'budget_max', parseNum(e.target.value))}
                  placeholder="0"
                  disabled={r.deleted}
                  style={{
                    width: 156, fontSize: '0.84rem', padding: '0.33rem 0.55rem',
                    textAlign: 'right', fontFamily: "'DM Mono',monospace",
                  }}
                />
                <button
                  className={`btn-icon${!r.deleted ? ' del' : ''}`}
                  title={r.deleted ? 'Batalkan hapus' : 'Hapus'}
                  onClick={() => toggleDelete(i)}
                  style={{ flexShrink: 0, width: 28, height: 28, fontSize: '0.8rem' }}>
                  {r.deleted ? '↩' : '✕'}
                </button>
              </div>
            ))}
          </div>

          {/* ── Add row ── */}
          <button className="vp-add-btn" style={{ marginTop: '0.65rem' }} onClick={addRow}>
            + Tambah Kategori
          </button>

          {/* ── Pending deletes warning ── */}
          {deletedCount > 0 && (
            <div style={{
              fontSize: '0.73rem', color: 'var(--red)', marginTop: '0.6rem',
              padding: '0.45rem 0.6rem', background: 'rgba(224,82,82,0.08)',
              border: '1px solid rgba(224,82,82,0.2)', borderRadius: 7,
            }}>
              ⚠ {deletedCount} {t('wpDeleteWarning')}
            </div>
          )}

          {err && <div className="modal-error" style={{ marginTop: '0.75rem' }}>{err}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-save" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vendor Picker Modal ───────────────────────────────────────────────────────
function VendorPickerModal({ category, uid, vendors, currentVendorId, onConfirm, onVendorAdded, onClose }) {
  const { t } = useLang()
  const catVendors = vendors.filter(v => v.category === category)
  const [selectedId,   setSelectedId]   = useState(currentVendorId || null)
  const [confirmStage, setConfirmStage] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [addingNew,    setAddingNew]    = useState(false)
  const [newForm,      setNewForm]      = useState({ name: '', price_estimate: '' })
  const [addSaving,    setAddSaving]    = useState(false)
  const [addErr,       setAddErr]       = useState('')

  const selV = vendors.find(v => v.id === selectedId)

  const handleSaveNew = async () => {
    if (!newForm.name.trim()) { setAddErr(t('wpErrVendorName')); return }
    setAddSaving(true)
    const { data, error } = await supabase.from('wedding_vendors').insert({
      user_id:        uid,
      name:           newForm.name.trim(),
      category,
      price_estimate: newForm.price_estimate ? Number(parseNum(newForm.price_estimate)) : null,
    }).select().single()
    if (error) { setAddErr(error.message); setAddSaving(false); return }
    onVendorAdded(data)
    setSelectedId(data.id)
    setNewForm({ name: '', price_estimate: '' })
    setAddingNew(false); setAddErr(''); setAddSaving(false)
  }

  const handleFinalConfirm = async () => {
    if (!selV) return
    setSaving(true)
    await onConfirm(selV)
    setSaving(false); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3 className="modal-title">
            <span style={{ color: catColor(category), marginRight: 6 }}>●</span>
            {t('wpPickVendorFor')} {category}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {catVendors.length === 0 && !addingNew ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: 8 }}>🏪</div>
              {t('wpNoVendorCat')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.65rem' }}>
              {catVendors.map(v => (
                <div key={v.id}
                  className={`vendor-card${selectedId === v.id ? ' active' : ''}`}
                  onClick={() => { setSelectedId(v.id); setConfirmStage(false) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{v.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {v.price_estimate && (
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.82rem', color: catColor(category), fontWeight: 600 }}>
                          {fmtRp(v.price_estimate)}
                        </span>
                      )}
                      {selectedId === v.id && <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addingNew ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,125,232,0.3)', borderRadius: 10, padding: '0.75rem 0.85rem', marginTop: catVendors.length ? '0.25rem' : 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--purple)', marginBottom: '0.5rem' }}>{t('wpAddVendorTitle')}</div>
              <div className="field" style={{ margin: '0 0 0.5rem' }}>
                <label style={{ fontSize: '0.68rem' }}>{t('wpVendorName')}</label>
                <input autoFocus value={newForm.name}
                  onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSaveNew()}
                  placeholder="e.g. Extra Ordinary WO"
                  style={{ fontSize: '0.82rem', padding: '0.3rem 0.5rem' }} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.68rem' }}>{t('wpPriceEst')}</label>
                <input inputMode="numeric"
                  value={fmtThousands(newForm.price_estimate)}
                  onChange={e => setNewForm(p => ({ ...p, price_estimate: parseNum(e.target.value) }))}
                  placeholder="e.g. 6.400.000"
                  style={{ fontSize: '0.82rem', padding: '0.3rem 0.5rem' }} />
              </div>
              {addErr && <div className="modal-error" style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>{addErr}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: '0.6rem', justifyContent: 'flex-end' }}>
                <button className="btn-cancel" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                  onClick={() => { setAddingNew(false); setAddErr('') }}>{t('cancel')}</button>
                <button className="btn-save" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                  onClick={handleSaveNew} disabled={addSaving}>{addSaving ? '...' : t('add')}</button>
              </div>
            </div>
          ) : (
            <button className="vp-add-btn" onClick={() => setAddingNew(true)}>{t('wpAddNewVendor')}</button>
          )}
        </div>

        {confirmStage && selV && (
          <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(139,125,232,0.07)', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.86rem', lineHeight: 1.55, marginBottom: '0.7rem' }}>
              {t('wpGunakanVendor')}{' '}
              <strong style={{ color: 'var(--purple)' }}>{selV.name}</strong> untuk <strong>{category}</strong>?
              {selV.price_estimate && (
                <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 2 }}>
                  {t('wpEstimate')} {fmtRp(selV.price_estimate)} — {t('wpEstAutoFilled')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => setConfirmStage(false)}>{t('wpBack')}</button>
              <button className="btn-save" onClick={handleFinalConfirm} disabled={saving}>
                {saving ? '...' : t('wpConfirmVendor')}
              </button>
            </div>
          </div>
        )}

        {!confirmStage && (
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>{t('cancel')}</button>
            <button className="btn-save" disabled={!selectedId || addingNew} onClick={() => setConfirmStage(true)}>
              {t('wpSelectVendorBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Transaction Modal ─────────────────────────────────────────────────────
function AddTxModal({ tx, uid, items, defaultItemId, onClose, onSaved, showToast }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    budget_item_id: tx?.budget_item_id || defaultItemId || items[0]?.id || '',
    amount: tx?.amount ? String(tx.amount) : '',
    type:   tx?.type   || 'DP',
    date:   tx?.date   || new Date().toISOString().slice(0, 10),
  })
  const [err,    setErr]    = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const selItem = items.find(it => it.id === form.budget_item_id)

  const save = async () => {
    if (!form.budget_item_id) { setErr(t('wpErrPilihKat')); return }
    if (!form.amount)         { setErr(t('wpErrJumlah')); return }
    const amt = Number(parseNum(form.amount))
    if (!amt)                 { setErr(t('wpErrJumlahNum')); return }
    if (!form.date)           { setErr(t('wpErrTanggal')); return }
    setSaving(true)
    const payload = {
      user_id: uid, budget_item_id: form.budget_item_id,
      category: selItem?.category || '', amount: amt, type: form.type, date: form.date,
    }
    const { error } = tx?.id
      ? await supabase.from('wedding_transactions').update(payload).eq('id', tx.id).eq('user_id', uid)
      : await supabase.from('wedding_transactions').insert(payload)
    if (error) { setErr(error.message); setSaving(false); return }
    showToast(tx?.id ? t('wpPayUpdated') : t('wpPayAdded'))
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">{tx ? `Edit ${t('wpAddPayment')}` : t('wpAddPayment')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>{t('wpCategory')}</label>
            <select value={form.budget_item_id} onChange={e => set('budget_item_id', e.target.value)}>
              {items.map(it => <option key={it.id} value={it.id}>{it.category}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('amount')} (Rp)</label>
            <input inputMode="numeric" value={fmtThousands(form.amount)}
              onChange={e => set('amount', parseNum(e.target.value))}
              placeholder="e.g. 5.000.000" autoFocus />
          </div>
          <div className="field">
            <label>{t('wpTipePayment')}</label>
            <div className="wp-type-pills">
              {TX_TYPES.map(tp => (
                <button key={tp} type="button"
                  className={`wp-type-pill${form.type === tp ? ' active' : ''}`}
                  onClick={() => set('type', tp)}>{tp}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>{t('wpTanggal')}</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          {err && <div className="modal-error">{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-save" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WeddingPlanner({ session, onHome }) {
  const { t, lang, toggle: toggleLang } = useLang()

  const [items,            setItems]            = useState([])
  const [transactions,     setTransactions]     = useState([])
  const [vendors,          setVendors]          = useState([])
  const [settings,         setSettings]         = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [selectedId,       setSelectedId]       = useState(null)
  const [showSetup,        setShowSetup]        = useState(false)
  const [showBudgetModal,  setShowBudgetModal]  = useState(false)
  const [showAddTx,        setShowAddTx]        = useState(false)
  const [editTx,           setEditTx]           = useState(null)
  const [txItemId,         setTxItemId]         = useState(null)
  const [txPage,           setTxPage]           = useState(1)
  const [showVendorPicker, setShowVendorPicker] = useState(false)
  const [pickerItem,       setPickerItem]       = useState(null)
  const [toast,            setToast]            = useState(null)
  const toastKey = useRef(0)

  const uid  = session.user.id
  const name = session.user.user_metadata?.full_name?.split(' ')[0] || 'Kamu'

  const showToast = useCallback((msg, type = 'success') => {
    toastKey.current += 1
    setToast({ message: msg, type, key: toastKey.current })
  }, [])

  const fetchAll = useCallback(async () => {
    const [itemsRes, txRes, vendorsRes, settingsRes] = await Promise.all([
      supabase.from('wedding_budget_items').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('wedding_transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
      supabase.from('wedding_vendors').select('*').eq('user_id', uid).order('name'),
      supabase.from('wedding_settings').select('*').eq('user_id', uid).maybeSingle(),
    ])
    setItems(itemsRes.data || [])
    setTransactions(txRes.data || [])
    setVendors(vendorsRes.data || [])
    setSettings(settingsRes.data || { total_budget: 0 })
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Vendor handlers ──────────────────────────────────────────────────────
  const openVendorPicker = item => { setPickerItem(item); setShowVendorPicker(true) }

  const handleVendorConfirm = async vendor => {
    if (!pickerItem) return
    const { error } = await supabase.from('wedding_budget_items')
      .update({ vendor_id: vendor.id, vendor: vendor.name, estimate: vendor.price_estimate ?? pickerItem.estimate ?? null })
      .eq('id', pickerItem.id).eq('user_id', uid)
    if (error) { showToast(error.message, 'error'); return }
    showToast(`"${vendor.name}" ${t('wpVendorPicked')}`)
    fetchAll()
  }

  const handleVendorAdded = newVendor => {
    setVendors(prev => [...prev, newVendor].sort((a, b) => a.name.localeCompare(b.name)))
  }

  // ── Computed ────────────────────────────────────────────────────────────
  const itemsWithStats = useMemo(() => items.map(it => {
    const txs    = transactions.filter(t => t.budget_item_id === it.id)
    const actual = txs.reduce((s, t) => s + Number(t.amount || 0), 0)
    const diff   = (it.budget_max || 0) - actual
    const status = getItemStatus(it.budget_max || 0, actual)
    return { ...it, actual, diff, status, txs, color: catColor(it.category) }
  }), [items, transactions])

  const globalBudget    = settings?.total_budget || 0
  const totalCatBudget  = itemsWithStats.reduce((s, it) => s + (it.budget_max || 0), 0)
  const effectiveBudget = globalBudget || totalCatBudget
  const totalEstimate   = itemsWithStats.reduce((s, it) => s + (it.estimate || 0), 0)
  const totalSpent      = itemsWithStats.reduce((s, it) => s + it.actual, 0)
  const totalRemaining  = Math.max(0, effectiveBudget - totalSpent)
  const progress        = effectiveBudget > 0 ? Math.min((totalSpent / effectiveBudget) * 100, 100) : 0
  const isOverBudget    = totalSpent > effectiveBudget && effectiveBudget > 0

  const animBudget = useCountUp(effectiveBudget)
  const animSpent  = useCountUp(totalSpent)
  const animRemain = useCountUp(totalRemaining)

  const selectedItem = itemsWithStats.find(it => it.id === selectedId) || null
  const detailTxs    = selectedItem ? [...selectedItem.txs].sort((a, b) => new Date(b.date) - new Date(a.date)) : []
  const pagedTxs     = paginate(detailTxs, txPage)

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
    generateInsights(itemsWithStats, effectiveBudget, totalSpent, totalRemaining),
  [itemsWithStats, effectiveBudget, totalSpent, totalRemaining])

  const isEmpty = items.length === 0
  const progressColor = isOverBudget ? 'var(--red)' : progress >= 80 ? 'var(--amber)' : 'var(--purple)'

  const openAddTx = (itemId = null) => { setTxItemId(itemId); setEditTx(null); setShowAddTx(true) }

  const handleDeleteItem = async id => {
    if (!confirm(t('wpConfirmDeleteItem'))) return
    await supabase.from('wedding_transactions').delete().eq('budget_item_id', id).eq('user_id', uid)
    const { error } = await supabase.from('wedding_budget_items').delete().eq('id', id).eq('user_id', uid)
    if (error) { showToast(error.message, 'error'); return }
    if (selectedId === id) setSelectedId(null)
    showToast(t('wpCatDeleted')); fetchAll()
  }

  const handleDeleteTx = async id => {
    if (!confirm(t('wpConfirmDeleteTx'))) return
    const { error } = await supabase.from('wedding_transactions').delete().eq('id', id).eq('user_id', uid)
    if (error) { showToast(error.message, 'error'); return }
    showToast(t('wpPayDeleted')); fetchAll()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <span style={{ color: 'var(--purple)', fontSize: '1.1rem' }}>💒</span>
          <span>{t('wpTitle')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isEmpty && (
            <button className="asset-btn-primary" onClick={() => openAddTx(null)}
              style={{ padding: '0.38rem 0.875rem', fontSize: '0.78rem' }}>
              {t('wpAddPayment')}
            </button>
          )}
          <button className="btn-lang" onClick={toggleLang}>
            <span className={lang === 'id' ? 'lang-active' : ''}>ID</span>
            <span className="lang-sep">·</span>
            <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
          </button>
          <button className="btn-back" onClick={onHome}>← Beranda</button>
        </div>
      </header>

      {loading ? <WeddingSkeleton /> : isEmpty ? (
        <main className="main-content">
          <div className="asset-empty">
            <div className="asset-empty-glow" />
            <div className="asset-empty-icon">💒</div>
            <div className="asset-empty-title">{t('wpEmptyTitle')}</div>
            <div className="asset-empty-sub">{t('wpEmptySub')}</div>
            <button className="asset-btn-primary"
              style={{ padding: '0.6rem 1.5rem', fontSize: '0.88rem' }}
              onClick={() => setShowSetup(true)}>
              {t('wpSetupAllBtn')}
            </button>
            <div className="asset-empty-cats" style={{ marginTop: '1.5rem' }}>
              {[['💒','Gedung','var(--blue)'],['🍽','Catering','var(--amber)'],['💍','Cincin','#f0c040'],['📸','Foto','#e05252']].map(([ic, lb, cl]) => (
                <div key={lb} className="asset-empty-cat">
                  <span style={{ color: cl }}>{ic}</span><span>{lb}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <main className="main-content">

          {/* ── HERO ── */}
          <div className="wp-hero-card">
            <div className="wp-hero-left">
              <div className="wp-hero-eyebrow">💒 {t('wpTitle')} — {name}</div>
              <div className="wp-hero-label">{t('wpTotalBudget')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className="wp-hero-val" style={{ marginBottom: 0 }}>
                  Rp {animBudget.toLocaleString('id-ID')}
                </div>
                <span
                  onClick={() => setShowBudgetModal(true)}
                  style={{ fontSize: '0.68rem', color: globalBudget ? 'var(--muted)' : 'var(--amber)', background: globalBudget ? 'rgba(255,255,255,0.05)' : 'rgba(233,162,41,0.12)', border: `1px solid ${globalBudget ? 'var(--border2)' : 'rgba(233,162,41,0.25)'}`, padding: '0.15rem 0.55rem', borderRadius: 20, cursor: 'pointer' }}>
                  {globalBudget ? `✏ ${t('wpEditBudget')}` : `${t('wpSetGlobalBudget')} →`}
                </span>
              </div>
              <div className="wp-progress-wrap">
                <div className="wp-progress-track">
                  <div className="wp-progress-fill" style={{ width: `${progress}%`, background: progressColor }} />
                </div>
                <div className="wp-progress-meta">
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                    {progress.toFixed(1)}{t('wpProgress')}
                  </span>
                  <span className={`wp-status-badge ${isOverBudget ? 'danger' : 'ok'}`}>
                    {isOverBudget ? t('wpOver') : t('wpTrack')}
                  </span>
                </div>
              </div>
            </div>
            <div className="wp-hero-right">
              <div className="wp-stat-card">
                <div className="wp-stat-eyebrow">{t('wpTotalPaid')}</div>
                <div className="wp-stat-val" style={{ color: 'var(--amber)' }}>
                  Rp {animSpent.toLocaleString('id-ID')}
                </div>
                <div className="wp-stat-sub">
                  {itemsWithStats.filter(it => it.actual > 0).length}/{items.length} {t('wpActiveCats')}
                </div>
              </div>
              <div className="wp-stat-card">
                <div className="wp-stat-eyebrow">{t('wpRemaining')}</div>
                <div className="wp-stat-val" style={{ color: totalRemaining > 0 ? 'var(--green)' : 'var(--red)' }}>
                  Rp {animRemain.toLocaleString('id-ID')}
                </div>
                <div className="wp-stat-sub">{totalRemaining > 0 ? t('wpRemainSub') : t('wpOverSub')}</div>
              </div>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="mod-stat-row">
            {[
              { label: t('wpTotalBudget'), val: fmt(effectiveBudget), sub: globalBudget ? t('wpGlobalBudget') : `${items.length} kategori`, color: 'var(--blue)' },
              { label: t('wpEstimate'),    val: totalEstimate > 0 ? fmt(totalEstimate) : '—', sub: t('wpEstimate').toLowerCase(), color: 'var(--purple)' },
              { label: t('wpTotalPaid'),   val: fmt(totalSpent), sub: `${progress.toFixed(1)}${t('wpProgress')}`, color: 'var(--amber)' },
              { label: t('wpRemaining'),   val: fmt(totalRemaining), sub: totalRemaining >= 0 ? t('wpRemainSub') : 'over!', color: totalRemaining >= 0 ? 'var(--green)' : 'var(--red)' },
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
              <div className="wp-action-title">{t('wpBudgetCat')}</div>
              <div className="wp-action-sub">
                {items.length} {t('wpCategory').toLowerCase()} · {transactions.length} {t('wpTransactions')} · {vendors.length} {t('wpVendorsReg')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="asset-btn-secondary" onClick={() => setShowSetup(true)}>
                {t('wpSetupAll')}
              </button>
              <button className="asset-btn-primary" onClick={() => openAddTx(null)}>
                {t('wpAddPayment')}
              </button>
            </div>
          </div>

          {/* ── LAYOUT ── */}
          <div className="wp-layout">
            <div className="wp-table-section">
              <div className="table-wrap" style={{ marginBottom: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('wpCategory')}</th>
                      <th>{t('wpVendor')}</th>
                      <th className="num">{t('wpMaxBudget')}</th>
                      <th className="num">{t('wpEstimate')}</th>
                      <th className="num">{t('wpPaid')}</th>
                      <th className="num">{t('wpDiff')}</th>
                      <th>{t('wpStatus')}</th>
                      <th style={{ width: '1%' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {itemsWithStats.map(it => {
                      const st = STATUS_KEYS[it.status]
                      const isSelected = selectedId === it.id
                      const spentPct = it.budget_max > 0 ? Math.min((it.actual / it.budget_max) * 100, 100) : 0

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

                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: '0.82rem', color: it.vendor_id ? 'var(--text)' : 'var(--muted)', fontStyle: it.vendor_id ? 'normal' : 'italic' }}>
                                {it.vendor_id ? it.vendor : '—'}
                              </span>
                              <button className="btn-icon" title={t('wpSelectVendorBtn')}
                                style={{ opacity: 0.55, fontSize: '0.72rem' }}
                                onClick={() => openVendorPicker(it)}>🏪</button>
                            </div>
                          </td>

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
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.8rem', fontWeight: 600, color: it.actual === 0 ? 'var(--muted)' : it.diff >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {it.actual === 0 ? '—' : (it.diff >= 0 ? '+' : '') + fmtRp(it.diff)}
                            </span>
                          </td>

                          <td>
                            <span className="wp-status-chip" style={{ color: st.color, background: st.bg, border: `1px solid ${st.bd}` }}>
                              {t(st.labelKey)}
                            </span>
                          </td>

                          <td className="actions" onClick={e => e.stopPropagation()}>
                            <div className="row-actions">
                              <button className="btn-icon" title={t('wpAddPayment')} onClick={() => openAddTx(it.id)}>💳</button>
                              <button className="btn-icon del" title={t('delete')} onClick={() => handleDeleteItem(it.id)}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── DETAIL PANEL ── */}
            {selectedItem && (
              <div className="wp-detail-panel">
                <div className="wp-detail-head">
                  <div>
                    <div className="wp-detail-cat" style={{ color: selectedItem.color }}>{selectedItem.category}</div>
                    <div className="wp-detail-vendor">{selectedItem.vendor_id ? selectedItem.vendor : '—'}</div>
                  </div>
                  <button className="wp-detail-close" onClick={() => setSelectedId(null)}>×</button>
                </div>

                {/* Vendor card */}
                <div style={{
                  background: selectedItem.vendor_id ? 'rgba(139,125,232,0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedItem.vendor_id ? 'rgba(139,125,232,0.25)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '0.6rem 0.85rem', marginBottom: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div>
                    {selectedItem.vendor_id ? (
                      <>
                        <div style={{ fontSize: '0.66rem', color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                          {t('wpSelectedVendor')}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{selectedItem.vendor}</div>
                        {selectedItem.estimate && (
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.74rem', color: 'var(--muted)', marginTop: 1 }}>
                            est. {fmtRp(selectedItem.estimate)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{t('wpNoVendor')}</div>
                    )}
                  </div>
                  <button className="asset-btn-secondary"
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', flexShrink: 0 }}
                    onClick={() => openVendorPicker(selectedItem)}>
                    {selectedItem.vendor_id ? t('wpChangeVendor') : t('wpPickVendor')} Vendor
                  </button>
                </div>

                {/* Stats */}
                <div className="wp-detail-stats">
                  {[
                    { label: t('wpMaxBudget'), val: fmtRp(selectedItem.budget_max), color: 'var(--blue)' },
                    { label: t('wpPaid'),       val: fmtRp(selectedItem.actual),     color: 'var(--amber)' },
                    { label: t('wpDiff'),
                      val: selectedItem.actual === 0 ? '—' : (selectedItem.diff >= 0 ? '+' : '') + fmtRp(selectedItem.diff),
                      color: selectedItem.actual === 0 ? 'var(--muted)' : selectedItem.diff >= 0 ? 'var(--green)' : 'var(--red)' },
                  ].map((s, i) => (
                    <div key={i} className="wp-detail-stat">
                      <div className="mod-stat-label">{s.label}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: s.color, fontSize: '0.88rem' }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {selectedItem.budget_max > 0 && (
                  <>
                    <div className="wp-progress-track" style={{ height: 5, marginBottom: 4 }}>
                      <div className="wp-progress-fill" style={{ width: `${Math.min((selectedItem.actual / selectedItem.budget_max) * 100, 100)}%`, background: STATUS_KEYS[selectedItem.status].color }} />
                    </div>
                    <div style={{ fontSize: '0.67rem', color: 'var(--muted)', textAlign: 'right', marginBottom: '1rem' }}>
                      {((selectedItem.actual / selectedItem.budget_max) * 100).toFixed(1)}{t('wpProgress')}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div className="asset-section-title">{t('wpPayHistory')}</div>
                  <button className="asset-btn-primary"
                    style={{ padding: '0.28rem 0.7rem', fontSize: '0.72rem' }}
                    onClick={() => openAddTx(selectedItem.id)}>
                    {t('wpAddPay')}
                  </button>
                </div>

                {detailTxs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
                    {t('wpNoPay')}
                  </div>
                ) : (
                  <div className="wp-tx-list">
                    {pagedTxs.map((tx, i) => {
                      const tc =
                        tx.type === 'DP'        ? { bg: 'rgba(74,144,217,0.14)',  color: 'var(--blue)',   bd: 'rgba(74,144,217,0.25)'  } :
                        tx.type === 'Pelunasan' ? { bg: 'rgba(61,186,126,0.14)',  color: 'var(--green)',  bd: 'rgba(61,186,126,0.25)'  } :
                                                  { bg: 'rgba(139,125,232,0.14)', color: 'var(--purple)', bd: 'rgba(139,125,232,0.25)' }
                      return (
                        <div key={tx.id} className="wp-tx-item">
                          <div className="wp-tx-dot" style={{ background: tc.color }} />
                          <div className="wp-tx-line" style={{ opacity: i === pagedTxs.length - 1 ? 0 : 1 }} />
                          <div className="wp-tx-body">
                            <div className="wp-tx-top">
                              <span className="wp-tx-badge" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.bd}` }}>{tx.type}</span>
                              <span className="wp-tx-date">{fmtDate(tx.date)}</span>
                            </div>
                            <div className="wp-tx-amount">Rp {Number(tx.amount).toLocaleString('id-ID')}</div>
                          </div>
                          <div className="row-actions" style={{ flexShrink: 0, alignSelf: 'flex-start' }} onClick={e => e.stopPropagation()}>
                            <button className="btn-icon" onClick={() => { setEditTx(tx); setTxItemId(tx.budget_item_id); setShowAddTx(true) }}>✏</button>
                            <button className="btn-icon del" onClick={() => handleDeleteTx(tx.id)}>✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Pagination total={detailTxs.length} page={txPage} onChange={setTxPage} />
              </div>
            )}

            {/* ── ACTIVITY PANEL ── */}
            {!selectedItem && recentActivity.length > 0 && (
              <div className="wp-activity-panel">
                <div className="asset-section-title" style={{ marginBottom: '1rem' }}>{t('wpRecentActivity')}</div>
                <div className="wp-tx-list">
                  {recentActivity.map((tx, i) => (
                    <div key={tx.id} className="wp-tx-item">
                      <div className="wp-tx-dot" style={{ background: 'var(--purple)' }} />
                      <div className="wp-tx-line" style={{ opacity: i === recentActivity.length - 1 ? 0 : 1 }} />
                      <div className="wp-tx-body">
                        <div className="wp-tx-top">
                          <span className="wp-tx-badge" style={{ background: 'rgba(139,125,232,0.14)', color: 'var(--purple)', border: '1px solid rgba(139,125,232,0.25)' }}>{tx.type}</span>
                          <span className="wp-tx-date">{relTime(tx.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                          {tx.catLabel}{tx.vendor ? ` — ${tx.vendor}` : ''}
                        </div>
                        <div className="wp-tx-amount">Rp {Number(tx.amount).toLocaleString('id-ID')}</div>
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
      {showBudgetModal && (
        <GlobalBudgetModal uid={uid} currentBudget={settings?.total_budget || 0}
          onClose={() => setShowBudgetModal(false)} onSaved={fetchAll} showToast={showToast} />
      )}
      {showSetup && (
        <SetupModal uid={uid} items={items}
          onClose={() => setShowSetup(false)} onSaved={fetchAll} showToast={showToast} />
      )}
      {showAddTx && (
        <AddTxModal tx={editTx} uid={uid} items={itemsWithStats} defaultItemId={txItemId}
          onClose={() => { setShowAddTx(false); setEditTx(null); setTxItemId(null) }}
          onSaved={fetchAll} showToast={showToast} />
      )}
      {showVendorPicker && pickerItem && (
        <VendorPickerModal
          category={pickerItem.category} uid={uid} vendors={vendors}
          currentVendorId={pickerItem.vendor_id || null}
          onConfirm={handleVendorConfirm} onVendorAdded={handleVendorAdded}
          onClose={() => { setShowVendorPicker(false); setPickerItem(null) }} />
      )}
      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  )
}
