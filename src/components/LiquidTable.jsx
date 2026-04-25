// src/components/LiquidTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/format'
import Modal from './Modal'

const EMPTY = { nama: '', jumlah: '', catatan: '' }

export default function LiquidTable({ data, jht, uid, onRefresh }) {
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [jhtVal, setJhtVal] = useState(jht)
  const [savingJHT, setSavingJHT] = useState(false)

  const total = data.reduce((s, r) => s + Number(r.jumlah), 0)

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm(r); setEditId(r.id); setModal(true) }
  const close    = () => { setModal(false); setEditId(null) }

  const save = async () => {
    setSaving(true)
    const p = { nama: form.nama, jumlah: Number(form.jumlah), catatan: form.catatan, user_id: uid }
    if (editId) await supabase.from('liquid_assets').update(p).eq('id', editId)
    else        await supabase.from('liquid_assets').insert(p)
    setSaving(false); close(); onRefresh()
  }

  const del = async (id) => {
    if (!confirm('Hapus?')) return
    await supabase.from('liquid_assets').delete().eq('id', id)
    onRefresh()
  }

  const saveJHT = async () => {
    setSavingJHT(true)
    const { data: ex } = await supabase.from('jht_assets').select('id').eq('user_id', uid).maybeSingle()
    if (ex) await supabase.from('jht_assets').update({ jumlah: Number(jhtVal) }).eq('id', ex.id)
    else    await supabase.from('jht_assets').insert({ user_id: uid, jumlah: Number(jhtVal) })
    setSavingJHT(false); onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Kas Likuid</h2>
        <button className="btn-add" onClick={openAdd}>+ Tambah</button>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Kas' : 'Tambah Kas'} onClose={close} onSave={save} saving={saving}>
          <div className="field"><label>Nama</label>
            <input value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Main Pocket / Dana Darurat / Tabungan" />
          </div>
          <div className="field"><label>Jumlah</label>
            <input type="number" value={form.jumlah} onChange={e => set('jumlah', e.target.value)} placeholder="0" />
          </div>
          <div className="field"><label>Catatan</label>
            <input value={form.catatan || ''} onChange={e => set('catatan', e.target.value)} placeholder="Opsional" />
          </div>
        </Modal>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nama</th><th className="num">Jumlah</th><th>Catatan</th><th></th></tr></thead>
          <tbody>
            {data.map(r => (
              <tr key={r.id}>
                <td>{r.nama}</td>
                <td className="num">{fmt(r.jumlah)}</td>
                <td className="muted">{r.catatan || '—'}</td>
                <td className="actions">
                  <button className="btn-icon" onClick={() => openEdit(r)}>✏</button>
                  <button className="btn-icon del" onClick={() => del(r.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td><strong>Total</strong></td>
            <td className="num"><strong>{fmt(total)}</strong></td>
            <td colSpan={2} />
          </tr></tfoot>
        </table>
      </div>

      <div className="jht-card">
        <div className="jht-header">
          <div>
            <h2 className="section-title" style={{marginBottom:4}}>JHT — BPJS Ketenagakerjaan</h2>
            <p className="muted" style={{fontSize:'0.8rem'}}>Update manual setiap ada perubahan saldo</p>
          </div>
        </div>
        <div className="jht-body">
          <div className="jht-amount">{fmt(jht)}</div>
          <div className="jht-edit">
            <input type="number" value={jhtVal} onChange={e => setJhtVal(e.target.value)} className="jht-input" />
            <button className="btn-save" onClick={saveJHT} disabled={savingJHT}>
              {savingJHT ? 'Menyimpan...' : 'Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
