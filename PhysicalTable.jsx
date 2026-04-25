// src/components/PhysicalTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, calcAge } from '../lib/format'
import Modal from './Modal'

const EMPTY = { asset_name: '', buy_price: '', buy_date: '', kategori: '', catatan: '' }

export default function PhysicalTable({ data, uid, onRefresh }) {
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const total = data.reduce((s, r) => s + Number(r.buy_price), 0)

  const openAdd  = () => { setForm({ ...EMPTY, buy_date: new Date().toISOString().slice(0, 10) }); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm({ ...r, buy_date: r.buy_date?.slice(0, 10) || '' }); setEditId(r.id); setModal(true) }
  const close    = () => { setModal(false); setEditId(null) }

  const save = async () => {
    setSaving(true)
    const p = { asset_name: form.asset_name, buy_price: Number(form.buy_price), buy_date: form.buy_date, kategori: form.kategori, catatan: form.catatan, user_id: uid }
    if (editId) await supabase.from('physical_assets').update(p).eq('id', editId)
    else        await supabase.from('physical_assets').insert(p)
    setSaving(false); close(); onRefresh()
  }

  const del = async (id) => {
    if (!confirm('Hapus aset ini?')) return
    await supabase.from('physical_assets').delete().eq('id', id)
    onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Aset Fisik</h2>
        <button className="btn-add" onClick={openAdd}>+ Tambah</button>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Aset Fisik' : 'Tambah Aset Fisik'} onClose={close} onSave={save} saving={saving}>
          <div className="field"><label>Nama Aset</label>
            <input value={form.asset_name} onChange={e => set('asset_name', e.target.value)} placeholder="New York Yankees / iPhone 15 Pro" />
          </div>
          <div className="field-row">
            <div className="field"><label>Harga Beli</label>
              <input type="number" value={form.buy_price} onChange={e => set('buy_price', e.target.value)} placeholder="0" />
            </div>
            <div className="field"><label>Tanggal Beli</label>
              <input type="date" value={form.buy_date} onChange={e => set('buy_date', e.target.value)} />
            </div>
          </div>
          <div className="field"><label>Kategori</label>
            <input value={form.kategori || ''} onChange={e => set('kategori', e.target.value)} placeholder="fashion / elektronik / kendaraan" />
          </div>
          <div className="field"><label>Catatan</label>
            <input value={form.catatan || ''} onChange={e => set('catatan', e.target.value)} placeholder="Opsional" />
          </div>
        </Modal>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Nama Aset</th><th className="num">Harga Beli</th>
            <th>Tgl Beli</th><th>Umur</th><th>Kategori</th><th></th>
          </tr></thead>
          <tbody>
            {data.map(r => (
              <tr key={r.id}>
                <td>{r.asset_name}</td>
                <td className="num">{fmt(r.buy_price)}</td>
                <td>{fmtDate(r.buy_date)}</td>
                <td className="muted">{calcAge(r.buy_date)}</td>
                <td>{r.kategori ? <span className="badge badge-gray">{r.kategori}</span> : <span className="muted">—</span>}</td>
                <td className="actions">
                  <button className="btn-icon" onClick={() => openEdit(r)}>✏</button>
                  <button className="btn-icon del" onClick={() => del(r.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td><strong>Total ({data.length} item)</strong></td>
            <td className="num"><strong>{fmt(total)}</strong></td>
            <td colSpan={4} />
          </tr></tfoot>
        </table>
      </div>
    </div>
  )
}
