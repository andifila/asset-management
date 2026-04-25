// src/components/PhysicalTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, calcAge, calcMonths } from '../lib/format'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'
import NumInput from './NumInput'

const EMPTY = { asset_name: '', buy_price: '', buy_date: '', catatan: '' }

export default function PhysicalTable({ data, uid, onRefresh, showToast }) {
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState(null)
  const [confirmItem, setConfirmItem] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const total = data.reduce((s, r) => s + Number(r.buy_price), 0)

  // Top-10 efisiensi: harga/bulan terendah = paling efisien
  const ranked = data
    .map(r => {
      const m = calcMonths(r.buy_date)
      return { ...r, perBulan: m ? Math.round(Number(r.buy_price) / m) : null }
    })
    .filter(r => r.perBulan !== null)
    .sort((a, b) => a.perBulan - b.perBulan)

  const top10 = ranked.slice(0, 10)

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    let av, bv
    if (sortKey === '_perBulan') {
      const ma = calcMonths(a.buy_date), mb = calcMonths(b.buy_date)
      av = ma ? Number(a.buy_price) / ma : Infinity
      bv = mb ? Number(b.buy_price) / mb : Infinity
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

  const openAdd  = () => { setForm({ ...EMPTY, buy_date: new Date().toISOString().slice(0, 10) }); setEditId(null); setSaveErr(null); setModal(true) }
  const openEdit = (r) => { setForm({ asset_name: r.asset_name, buy_price: r.buy_price, buy_date: r.buy_date?.slice(0, 10) || '', catatan: r.catatan || '' }); setEditId(r.id); setSaveErr(null); setModal(true) }
  const close    = () => { setModal(false); setEditId(null); setSaveErr(null) }

  const save = async () => {
    if (!form.asset_name.trim()) { setSaveErr('Nama aset tidak boleh kosong'); return }
    if (Number(form.buy_price) <= 0) { setSaveErr('Harga beli harus lebih dari 0'); return }
    setSaving(true); setSaveErr(null)
    const p = {
      asset_name: form.asset_name.trim(),
      buy_price:  Number(form.buy_price),
      buy_date:   form.buy_date || null,
      catatan:    form.catatan,
      user_id:    uid,
    }
    const { error } = editId
      ? await supabase.from('physical_assets').update(p).eq('id', editId)
      : await supabase.from('physical_assets').insert(p)
    setSaving(false)
    if (error) { setSaveErr(error.message); return }
    close(); onRefresh()
    showToast(editId ? 'Aset berhasil diperbarui' : 'Aset berhasil ditambahkan')
  }

  const del = async () => {
    setDeleting(true)
    await supabase.from('physical_assets').delete().eq('id', confirmItem.id)
    setDeleting(false); setConfirmItem(null)
    showToast('Aset berhasil dihapus')
    onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const rankCls = (i) => i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n'

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Aset Fisik</h2>
        <button className="btn-add" onClick={openAdd}>+ Tambah</button>
      </div>

      {confirmItem && (
        <ConfirmModal name={confirmItem.asset_name} onConfirm={del} onCancel={() => setConfirmItem(null)} loading={deleting} />
      )}

      {modal && (
        <Modal title={editId ? 'Edit Aset Fisik' : 'Tambah Aset Fisik'} onClose={close} onSave={save} saving={saving} error={saveErr}>
          <div className="field">
            <label>Nama Aset</label>
            <input value={form.asset_name} onChange={e => set('asset_name', e.target.value)} placeholder="Jam Tangan / iPhone / Motor" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Harga Beli</label>
              <NumInput value={form.buy_price} onChange={v => set('buy_price', v)} placeholder="0" />
            </div>
            <div className="field">
              <label>Tanggal Beli</label>
              <input type="date" value={form.buy_date} onChange={e => set('buy_date', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Catatan</label>
            <input value={form.catatan || ''} onChange={e => set('catatan', e.target.value)} placeholder="Opsional" />
          </div>
        </Modal>
      )}

      <div className="physical-layout">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh k="asset_name">Nama Aset</SortTh>
                <SortTh k="buy_price" className="num">Harga Beli</SortTh>
                <SortTh k="buy_date">Tgl Beli</SortTh>
                <th>Umur</th>
                <SortTh k="_perBulan" className="num">Harga/Bulan</SortTh>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="empty-state">Belum ada data</td></tr>
              )}
              {sorted.map(r => {
                const months = calcMonths(r.buy_date)
                const perBulan = months ? Math.round(Number(r.buy_price) / months) : null
                return (
                  <tr key={r.id}>
                    <td>{r.asset_name}</td>
                    <td className="num">{fmt(r.buy_price)}</td>
                    <td>{fmtDate(r.buy_date)}</td>
                    <td className="muted">{calcAge(r.buy_date)}</td>
                    <td className="num">
                      {perBulan ? (
                        <span className="per-bulan">{fmt(perBulan)}<span className="per-bulan-unit">/bln</span></span>
                      ) : <span className="muted">—</span>}
                    </td>
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
                <td><strong>Total ({data.length} item)</strong></td>
                <td className="num"><strong>{fmt(total)}</strong></td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="physical-rank-panel">
          <div className="physical-rank-title">Ranking Efisiensi</div>
          <div className="physical-rank-sub">Harga/bulan terendah = paling efisien</div>
          {top10.length === 0 ? (
            <div className="physical-rank-empty">Tambah tanggal beli<br />untuk melihat ranking</div>
          ) : (
            top10.map((item, i) => (
              <div key={item.id} className="physical-rank-item">
                <span className={`rank-badge ${rankCls(i)}`}>#{i + 1}</span>
                <div className="physical-rank-info">
                  <div className="physical-rank-name">{item.asset_name}</div>
                  <div className="physical-rank-val">
                    {fmt(item.perBulan)}<span className="per-bulan-unit">/bln</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
