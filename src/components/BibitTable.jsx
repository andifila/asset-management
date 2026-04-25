// src/components/BibitTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'
import Modal from './Modal'
import NumInput from './NumInput'

const EMPTY = { nama_aset: '', kategori: 'pasar_uang', saldo: '', aktual: '', catatan: '' }
const KAT_LABEL = { pasar_uang: 'Pasar Uang', obligasi: 'Obligasi', saham: 'Saham' }
const KAT_CLASS = { pasar_uang: 'badge-teal', obligasi: 'badge-blue', saham: 'badge-amber' }

export default function BibitTable({ data, uid, onRefresh }) {
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editId, setEditId]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const tSaldo  = data.reduce((s, r) => s + Number(r.saldo), 0)
  const tAktual = data.reduce((s, r) => s + Number(r.aktual), 0)

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
    setSaving(true); setSaveErr(null)
    const p = { nama_aset: form.nama_aset, kategori: form.kategori, saldo: Number(form.saldo), aktual: Number(form.aktual), catatan: form.catatan, user_id: uid }
    const { error } = editId
      ? await supabase.from('bibit_assets').update(p).eq('id', editId)
      : await supabase.from('bibit_assets').insert(p)
    setSaving(false)
    if (error) { setSaveErr(error.message); return }
    close(); onRefresh()
  }

  const del = async (id) => {
    if (!confirm('Hapus aset ini?')) return
    await supabase.from('bibit_assets').delete().eq('id', id)
    onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">BIBIT — Reksa Dana & Obligasi</h2>
        <button className="btn-add" onClick={openAdd}>+ Tambah</button>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Aset BIBIT' : 'Tambah Aset BIBIT'} onClose={close} onSave={save} saving={saving} error={saveErr}>
          <div className="field"><label>Nama Aset</label>
            <input value={form.nama_aset} onChange={e => set('nama_aset', e.target.value)} placeholder="PASAR UANG / OBLIGASI / $GOTO" />
          </div>
          <div className="field"><label>Kategori</label>
            <select value={form.kategori} onChange={e => set('kategori', e.target.value)}>
              <option value="pasar_uang">Pasar Uang</option>
              <option value="obligasi">Obligasi</option>
              <option value="saham">Saham</option>
            </select>
          </div>
          <div className="field-row">
            <div className="field"><label>Saldo (Modal)</label>
              <NumInput value={form.saldo} onChange={v => set('saldo', v)} placeholder="0" />
            </div>
            <div className="field"><label>Aktual (Sekarang)</label>
              <NumInput value={form.aktual} onChange={v => set('aktual', v)} placeholder="0" />
            </div>
          </div>
          <div className="field"><label>Catatan</label>
            <input value={form.catatan || ''} onChange={e => set('catatan', e.target.value)} placeholder="Opsional" />
          </div>
        </Modal>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr>
            <SortTh k="nama_aset">Nama Aset</SortTh>
            <SortTh k="kategori">Kategori</SortTh>
            <SortTh k="saldo" className="num">Saldo</SortTh>
            <SortTh k="aktual" className="num">Aktual</SortTh>
            <SortTh k="_pnl" className="num">PnL</SortTh>
            <th></th>
          </tr></thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Belum ada data</td></tr>
            )}
            {sorted.map(r => {
              const pnl = Number(r.aktual) - Number(r.saldo)
              return (
                <tr key={r.id}>
                  <td>{r.nama_aset}</td>
                  <td><span className={`badge ${KAT_CLASS[r.kategori] || 'badge-gray'}`}>{KAT_LABEL[r.kategori] || r.kategori}</span></td>
                  <td className="num">{fmt(r.saldo)}</td>
                  <td className="num">{fmt(r.aktual)}</td>
                  <td className={`num ${pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(pnl)}</td>
                  <td className="actions">
                    <div className="row-actions">
                      <button className="btn-icon" onClick={() => openEdit(r)} title="Edit">✏</button>
                      <button className="btn-icon del" onClick={() => del(r.id)} title="Hapus">×</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot><tr>
            <td colSpan={2}><strong>Total</strong></td>
            <td className="num"><strong>{fmt(tSaldo)}</strong></td>
            <td className="num"><strong>{fmt(tAktual)}</strong></td>
            <td className={`num ${tAktual >= tSaldo ? 'pos' : 'neg'}`}><strong>{fmtPnl(tAktual - tSaldo)}</strong></td>
            <td />
          </tr></tfoot>
        </table>
      </div>
    </div>
  )
}
