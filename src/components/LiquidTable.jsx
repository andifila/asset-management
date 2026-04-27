// src/components/LiquidTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/format'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'
import NumInput from './NumInput'
import { useLang } from '../lib/LangContext'

const KATEGORI = [
  { value: 'main_pocket',  label: 'Main Pocket',  cls: 'badge-blue' },
  { value: 'dana_darurat', label: 'Dana Darurat', cls: 'badge-amber' },
  { value: 'lainnya',      label: 'Lainnya',      cls: 'badge-gray' },
]
const KAT_MAP = Object.fromEntries(KATEGORI.map(k => [k.value, k]))
const EMPTY = { nama: '', jumlah: '', kategori: 'main_pocket' }

export default function LiquidTable({ data, jht, uid, onRefresh, showToast }) {
  const { t } = useLang()
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState(null)
  const [confirmItem, setConfirmItem] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [jhtVal, setJhtVal]     = useState(jht)
  const [savingJHT, setSavingJHT] = useState(false)
  const [jhtErr, setJhtErr]     = useState(null)
  const [sortKey, setSortKey]   = useState(null)
  const [sortDir, setSortDir]   = useState('asc')

  const total        = data.reduce((s, r) => s + Number(r.jumlah), 0)
  const tMainPocket  = data.filter(r => r.kategori === 'main_pocket').reduce((s, r) => s + Number(r.jumlah), 0)
  const tDanaDarurat = data.filter(r => r.kategori === 'dana_darurat').reduce((s, r) => s + Number(r.jumlah), 0)
  const tLainnya     = data.filter(r => !r.kategori || r.kategori === 'lainnya').reduce((s, r) => s + Number(r.jumlah), 0)

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey], bv = b[sortKey]
    const na = Number(av), nb = Number(bv)
    const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : String(av || '').localeCompare(String(bv || ''))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortTh = ({ k, children, className }) => (
    <th className={`sortable${sortKey === k ? ' sorted' : ''}${className ? ' ' + className : ''}`} onClick={() => toggleSort(k)}>
      {children}<span className="sort-icon">{sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}</span>
    </th>
  )

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setSaveErr(null); setModal(true) }
  const openEdit = (r) => { setForm({ ...r, kategori: r.kategori || 'lainnya' }); setEditId(r.id); setSaveErr(null); setModal(true) }
  const close    = () => { setModal(false); setEditId(null); setSaveErr(null) }

  const save = async () => {
    if (!form.nama.trim()) { setSaveErr(t('errNama')); return }
    if (Number(form.jumlah) <= 0) { setSaveErr(t('errJumlah')); return }
    setSaving(true); setSaveErr(null)
    const p = { nama: form.nama.trim(), jumlah: Number(form.jumlah), kategori: form.kategori, user_id: uid }
    const result = editId
      ? await supabase.from('liquid_assets').update(p).eq('id', editId)
      : await supabase.from('liquid_assets').insert(p)
    setSaving(false)
    if (result.error) { setSaveErr(result.error.message); return }
    close(); onRefresh()
    showToast(editId ? t('toastUpdated') : t('toastAdded'))
  }

  const del = async () => {
    setDeleting(true)
    await supabase.from('liquid_assets').delete().eq('id', confirmItem.id)
    setDeleting(false); setConfirmItem(null)
    showToast(t('toastDeleted')); onRefresh()
  }

  const saveJHT = async () => {
    if (Number(jhtVal) < 0) { setJhtErr(t('errJhtNeg')); return }
    setSavingJHT(true); setJhtErr(null)
    const { data: ex } = await supabase.from('jht_assets').select('id').eq('user_id', uid).maybeSingle()
    const { error } = ex
      ? await supabase.from('jht_assets').update({ jumlah: Number(jhtVal) }).eq('id', ex.id)
      : await supabase.from('jht_assets').insert({ user_id: uid, jumlah: Number(jhtVal) })
    setSavingJHT(false)
    if (error) { setJhtErr(error.message); return }
    onRefresh()
    showToast(t('toastUpdated'))
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">{t('liquidTitle')}</h2>
        <button className="btn-add" onClick={openAdd}>{t('add')}</button>
      </div>

      {modal && (
        <Modal title={editId ? t('editLiquid') : t('addLiquid')} onClose={close} onSave={save} saving={saving} error={saveErr}>
          <div className="field">
            <label>{t('category')}</label>
            <select value={form.kategori} onChange={e => set('kategori', e.target.value)}>
              {KATEGORI.map(k => <option key={k.value} value={k.value}>{t(k.value)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('nameHint')}</label>
            <input value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="BCA Tabungan / Dana Darurat BRI / dll" autoFocus />
          </div>
          <div className="field">
            <label>{t('amount')}</label>
            <NumInput value={form.jumlah} onChange={v => set('jumlah', v)} placeholder="0" />
          </div>
        </Modal>
      )}

      {confirmItem && (
        <ConfirmModal name={confirmItem.nama} onConfirm={del} onCancel={() => setConfirmItem(null)} loading={deleting} />
      )}

      <div className="liquid-summary-row">
        <div className="liquid-summary-item">
          <span className="badge badge-blue">Main Pocket</span>
          <span className="liquid-summary-val">{fmt(tMainPocket)}</span>
        </div>
        <div className="liquid-summary-item">
          <span className="badge badge-amber">Dana Darurat</span>
          <span className="liquid-summary-val">{fmt(tDanaDarurat)}</span>
        </div>
        {tLainnya > 0 && (
          <div className="liquid-summary-item">
            <span className="badge badge-gray">Lainnya</span>
            <span className="liquid-summary-val">{fmt(tLainnya)}</span>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh k="kategori">{t('category')}</SortTh>
              <SortTh k="nama">{t('name')}</SortTh>
              <SortTh k="jumlah" className="num">{t('amount')}</SortTh>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={4} className="empty-state">{t('noData')}</td></tr>
            )}
            {sorted.map(r => {
              const kat = KAT_MAP[r.kategori] || KAT_MAP['lainnya']
              return (
                <tr key={r.id}>
                  <td><span className={`badge ${kat.cls}`}>{t(kat.value)}</span></td>
                  <td>{r.nama}</td>
                  <td className="num">{fmt(r.jumlah)}</td>
                  <td className="actions">
                    <div className="row-actions">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit">✏</button>
                      <button className="btn-icon del" onClick={() => setConfirmItem(r)} title="Hapus">×</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}><strong>{t('totalCash')}</strong></td>
              <td className="num"><strong>{fmt(total)}</strong></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="jht-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 className="section-title">{t('jhtTitle')}</h2>
              <span className="badge badge-purple">Liquid</span>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem' }}>{t('jhtSub')}</p>
          </div>
          <div className="jht-edit">
            <NumInput value={jhtVal} onChange={v => setJhtVal(v)} className="jht-input" />
            <button className="btn-save" onClick={saveJHT} disabled={savingJHT}>
              {savingJHT ? t('updating') : t('update')}
            </button>
          </div>
        </div>
        {jhtErr && <div className="modal-error" style={{ marginTop: 10 }}>{jhtErr}</div>}
      </div>
    </div>
  )
}
