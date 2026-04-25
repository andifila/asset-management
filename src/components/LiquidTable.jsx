// src/components/LiquidTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/format'
import Modal from './Modal'
import NumInput from './NumInput'

const KATEGORI = [
  { value: 'main_pocket', label: 'Main Pocket', cls: 'badge-blue' },
  { value: 'dana_darurat', label: 'Dana Darurat', cls: 'badge-amber' },
  { value: 'lainnya',      label: 'Lainnya',      cls: 'badge-gray' },
]

const KAT_MAP = Object.fromEntries(KATEGORI.map(k => [k.value, k]))

const EMPTY = { nama: '', jumlah: '', kategori: 'main_pocket' }

export default function LiquidTable({ data, jht, uid, onRefresh }) {
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editId, setEditId]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [jhtVal, setJhtVal]   = useState(jht)
  const [savingJHT, setSavingJHT] = useState(false)
  const [jhtErr, setJhtErr]   = useState(null)

  const total = data.reduce((s, r) => s + Number(r.jumlah), 0)

  const tMainPocket  = data.filter(r => r.kategori === 'main_pocket').reduce((s, r) => s + Number(r.jumlah), 0)
  const tDanaDarurat = data.filter(r => r.kategori === 'dana_darurat').reduce((s, r) => s + Number(r.jumlah), 0)
  const tLainnya     = data.filter(r => !r.kategori || r.kategori === 'lainnya').reduce((s, r) => s + Number(r.jumlah), 0)

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setSaveErr(null); setModal(true) }
  const openEdit = (r) => { setForm({ ...r, kategori: r.kategori || 'lainnya' }); setEditId(r.id); setSaveErr(null); setModal(true) }
  const close    = () => { setModal(false); setEditId(null); setSaveErr(null) }

  const save = async () => {
    setSaving(true); setSaveErr(null)
    const p = {
      nama: form.nama,
      jumlah: Number(form.jumlah),
      kategori: form.kategori,
      user_id: uid,
    }
    console.log('[save] payload:', p)
    const result = editId
      ? await supabase.from('liquid_assets').update(p).eq('id', editId)
      : await supabase.from('liquid_assets').insert(p)
    console.log('[save] result:', result)
    setSaving(false)
    if (result.error) { setSaveErr(result.error.message); return }
    close(); onRefresh()
  }

  const del = async (id) => {
    if (!confirm('Hapus entri ini?')) return
    await supabase.from('liquid_assets').delete().eq('id', id)
    onRefresh()
  }

  const saveJHT = async () => {
    setSavingJHT(true); setJhtErr(null)
    const { data: ex } = await supabase.from('jht_assets').select('id').eq('user_id', uid).maybeSingle()
    const { error } = ex
      ? await supabase.from('jht_assets').update({ jumlah: Number(jhtVal) }).eq('id', ex.id)
      : await supabase.from('jht_assets').insert({ user_id: uid, jumlah: Number(jhtVal) })
    setSavingJHT(false)
    if (error) { setJhtErr(error.message); return }
    onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Aset Liquid</h2>
        <button className="btn-add" onClick={openAdd}>+ Tambah</button>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Aset Liquid' : 'Tambah Aset Liquid'} onClose={close} onSave={save} saving={saving} error={saveErr}>
          <div className="field">
            <label>Kategori</label>
            <select value={form.kategori} onChange={e => set('kategori', e.target.value)}>
              {KATEGORI.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Nama / Keterangan</label>
            <input
              value={form.nama}
              onChange={e => set('nama', e.target.value)}
              placeholder="BCA Tabungan / Dana Darurat BRI / dll"
            />
          </div>
          <div className="field">
            <label>Jumlah</label>
            <NumInput value={form.jumlah} onChange={v => set('jumlah', v)} placeholder="0" />
          </div>
        </Modal>
      )}

      {/* Ringkasan per kategori */}
      <div className="liquid-summary-row">
        <div className="liquid-summary-item">
          <span className={`badge badge-blue`}>Main Pocket</span>
          <span className="liquid-summary-val">{fmt(tMainPocket)}</span>
        </div>
        <div className="liquid-summary-item">
          <span className={`badge badge-amber`}>Dana Darurat</span>
          <span className="liquid-summary-val">{fmt(tDanaDarurat)}</span>
        </div>
        {tLainnya > 0 && (
          <div className="liquid-summary-item">
            <span className={`badge badge-gray`}>Lainnya</span>
            <span className="liquid-summary-val">{fmt(tLainnya)}</span>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Nama</th>
              <th className="num">Jumlah</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={4} className="empty-state">Belum ada data</td></tr>
            )}
            {data.map(r => {
              const kat = KAT_MAP[r.kategori] || KAT_MAP['lainnya']
              return (
                <tr key={r.id}>
                  <td><span className={`badge ${kat.cls}`}>{kat.label}</span></td>
                  <td>{r.nama}</td>
                  <td className="num">{fmt(r.jumlah)}</td>
                  <td className="actions">
                    <button className="btn-icon" onClick={() => openEdit(r)}>✏</button>
                    <button className="btn-icon del" onClick={() => del(r.id)}>×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}><strong>Total Kas</strong></td>
              <td className="num"><strong>{fmt(total)}</strong></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* JHT */}
      <div className="jht-card">
        <div className="jht-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 className="section-title">JHT — BPJS Ketenagakerjaan</h2>
            <span className="badge badge-purple">Liquid</span>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem' }}>Update manual setiap ada perubahan saldo</p>
        </div>
        <div className="jht-body">
          <div className="jht-amount">{fmt(jht)}</div>
          <div className="jht-edit">
            <NumInput value={jhtVal} onChange={v => setJhtVal(v)} className="jht-input" />
            <button className="btn-save" onClick={saveJHT} disabled={savingJHT}>
              {savingJHT ? 'Menyimpan...' : 'Update'}
            </button>
          </div>
        </div>
        {jhtErr && <div className="modal-error" style={{ marginTop: 10 }}>{jhtErr}</div>}
      </div>
    </div>
  )
}
