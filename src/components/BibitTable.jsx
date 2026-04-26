// src/components/BibitTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'
import NumInput from './NumInput'
import { useLang } from '../lib/LangContext'

const EMPTY = { nama_aset: '', kategori: 'pasar_uang', saldo: '', aktual: '', catatan: '' }
const KAT_CLASS = { pasar_uang: 'badge-teal', obligasi: 'badge-blue', saham: 'badge-amber' }

export default function BibitTable({ data, uid, onRefresh, showToast }) {
  const { t } = useLang()
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState(null)
  const [confirmItem, setConfirmItem] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [sortKey, setSortKey]   = useState(null)
  const [sortDir, setSortDir]   = useState('asc')

  const tSaldo  = data.reduce((s, r) => s + Number(r.saldo), 0)
  const tAktual = data.reduce((s, r) => s + Number(r.aktual), 0)

  const top3 = [...data]
    .filter(r => Number(r.saldo) > 0)
    .map(r => ({ ...r, pnlPct: (Number(r.aktual) - Number(r.saldo)) / Number(r.saldo) * 100 }))
    .sort((a, b) => b.pnlPct - a.pnlPct)
    .slice(0, 3)

  // Profit ranking: top 3 by PnL%
  const profitRanks = (() => {
    const map = {}
    ;[...data]
      .sort((a, b) => {
        const pA = Number(a.saldo) > 0 ? (Number(a.aktual) - Number(a.saldo)) / Number(a.saldo) : -Infinity
        const pB = Number(b.saldo) > 0 ? (Number(b.aktual) - Number(b.saldo)) / Number(b.saldo) : -Infinity
        return pB - pA
      })
      .slice(0, 3)
      .forEach((r, i) => { map[r.id] = i + 1 })
    return map
  })()

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    let av, bv
    if (sortKey === '_pnl') {
      av = Number(a.aktual) - Number(a.saldo)
      bv = Number(b.aktual) - Number(b.saldo)
    } else {
      av = a[sortKey]; bv = b[sortKey]
    }
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
  const openEdit = (r) => { setForm(r); setEditId(r.id); setSaveErr(null); setModal(true) }
  const close    = () => { setModal(false); setEditId(null); setSaveErr(null) }

  const save = async () => {
    if (!form.nama_aset.trim()) { setSaveErr(t('errName')); return }
    if (Number(form.saldo) <= 0) { setSaveErr(t('errBalance')); return }
    if (Number(form.aktual) < 0) { setSaveErr(t('errActual')); return }
    setSaving(true); setSaveErr(null)
    const p = { nama_aset: form.nama_aset.trim(), kategori: form.kategori, saldo: Number(form.saldo), aktual: Number(form.aktual), catatan: form.catatan, user_id: uid }
    const { error } = editId
      ? await supabase.from('bibit_assets').update(p).eq('id', editId)
      : await supabase.from('bibit_assets').insert(p)
    setSaving(false)
    if (error) { setSaveErr(error.message); return }
    close(); onRefresh()
    showToast(editId ? t('toastUpdated') : t('toastAdded'))
  }

  const del = async () => {
    setDeleting(true)
    await supabase.from('bibit_assets').delete().eq('id', confirmItem.id)
    setDeleting(false); setConfirmItem(null)
    showToast(t('toastDeleted')); onRefresh()
  }

  const rankCls = (r) => { const n = profitRanks[r]; return n === 1 ? 'rank-1' : n === 2 ? 'rank-2' : 'rank-3' }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">{t('bibitTitle')}</h2>
        <button className="btn-add" onClick={openAdd}>{t('add')}</button>
      </div>

      {modal && (
        <Modal title={editId ? t('editBibit') : t('addBibit')} onClose={close} onSave={save} saving={saving} error={saveErr}>
          <div className="field"><label>{t('assetName')}</label>
            <input value={form.nama_aset} onChange={e => set('nama_aset', e.target.value)} placeholder="PASAR UANG / OBLIGASI / $GOTO" autoFocus />
          </div>
          <div className="field"><label>{t('category')}</label>
            <select value={form.kategori} onChange={e => set('kategori', e.target.value)}>
              <option value="pasar_uang">{t('pasar_uang')}</option>
              <option value="obligasi">{t('obligasi')}</option>
              <option value="saham">{t('saham')}</option>
            </select>
          </div>
          <div className="field-row">
            <div className="field"><label>{t('balanceLabel')}</label>
              <NumInput value={form.saldo} onChange={v => set('saldo', v)} placeholder="0" />
            </div>
            <div className="field"><label>{t('actualLabel')}</label>
              <NumInput value={form.aktual} onChange={v => set('aktual', v)} placeholder="0" />
            </div>
          </div>
          <div className="field"><label>{t('notes')}</label>
            <input value={form.catatan || ''} onChange={e => set('catatan', e.target.value)} placeholder={t('optional')} />
          </div>
        </Modal>
      )}

      {confirmItem && (
        <ConfirmModal name={confirmItem.nama_aset} onConfirm={del} onCancel={() => setConfirmItem(null)} loading={deleting} />
      )}

      <div className="physical-layout">
      <div className="table-wrap">
        <table>
          <thead><tr>
            <SortTh k="nama_aset">{t('assetName')}</SortTh>
            <SortTh k="kategori">{t('category')}</SortTh>
            <SortTh k="saldo" className="num">{t('balance')}</SortTh>
            <SortTh k="aktual" className="num">{t('actual')}</SortTh>
            <SortTh k="_pnl" className="num">{t('pnl')}</SortTh>
            <th></th>
          </tr></thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="empty-state">{t('noData')}</td></tr>
            )}
            {sorted.map(r => {
              const pnl = Number(r.aktual) - Number(r.saldo)
              const rank = profitRanks[r.id]
              return (
                <tr key={r.id}>
                  <td>
                    <div className="cell-with-rank">
                      {rank && <span className={`rank-badge ${rankCls(r.id)}`}>#{rank}</span>}
                      {r.nama_aset}
                    </div>
                  </td>
                  <td><span className={`badge ${KAT_CLASS[r.kategori] || 'badge-gray'}`}>{t(r.kategori) || r.kategori}</span></td>
                  <td className="num">{fmt(r.saldo)}</td>
                  <td className="num">{fmt(r.aktual)}</td>
                  <td className={`num ${pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(pnl)}</td>
                  <td className="actions">
                    <div className="row-actions">
                      <button className="btn-icon" onClick={() => openEdit(r)} title={t('edit')}>✏</button>
                      <button className="btn-icon del" onClick={() => setConfirmItem(r)} title={t('delete')}>×</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot><tr>
            <td colSpan={2}><strong>{t('total')}</strong></td>
            <td className="num"><strong>{fmt(tSaldo)}</strong></td>
            <td className="num"><strong>{fmt(tAktual)}</strong></td>
            <td className={`num ${tAktual >= tSaldo ? 'pos' : 'neg'}`}><strong>{fmtPnl(tAktual - tSaldo)}</strong></td>
            <td />
          </tr></tfoot>
        </table>
      </div>

      <div className="physical-rank-panel">
        <div className="physical-rank-title">{t('profitRank')}</div>
        <div className="physical-rank-sub">{t('topProfitSub')}</div>
        {top3.length === 0 ? (
          <div className="physical-rank-empty">{t('noData')}</div>
        ) : (
          top3.map((item, i) => {
            const cls = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : 'rank-3'
            const sign = item.pnlPct >= 0 ? '+' : ''
            return (
              <div key={item.id} className="physical-rank-item">
                <span className={`rank-badge ${cls}`}>#{i + 1}</span>
                <div className="physical-rank-info">
                  <div className="physical-rank-name">{item.nama_aset}</div>
                  <div className={`physical-rank-val ${item.pnlPct >= 0 ? 'pos' : 'neg'}`}>
                    {sign}{item.pnlPct.toFixed(2)}%
                    <span className="rank-val-sub">{fmtPnl(Number(item.aktual) - Number(item.saldo))}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      </div>
    </div>
  )
}
