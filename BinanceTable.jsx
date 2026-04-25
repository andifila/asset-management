// src/components/BinanceTable.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'
import Modal from './Modal'

const EMPTY = { symbol: '', saldo: '', aktual: '', catatan: '' }

export default function BinanceTable({ data, uid, onRefresh }) {
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const tSaldo  = data.reduce((s, r) => s + Number(r.saldo), 0)
  const tAktual = data.reduce((s, r) => s + Number(r.aktual), 0)

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm(r); setEditId(r.id); setModal(true) }
  const close    = () => { setModal(false); setEditId(null) }

  const save = async () => {
    setSaving(true)
    const p = { symbol: form.symbol, saldo: Number(form.saldo), aktual: Number(form.aktual), catatan: form.catatan, user_id: uid }
    if (editId) await supabase.from('binance_assets').update(p).eq('id', editId)
    else        await supabase.from('binance_assets').insert(p)
    setSaving(false); close(); onRefresh()
  }

  const del = async (id) => {
    if (!confirm('Hapus aset ini?')) return
    await supabase.from('binance_assets').delete().eq('id', id)
    onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Binance — Crypto Portfolio</h2>
        <button className="btn-add" onClick={openAdd}>+ Tambah</button>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Crypto' : 'Tambah Crypto'} onClose={close} onSave={save} saving={saving}>
          <div className="field"><label>Symbol</label>
            <input value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="$BNB / $BTC / $ETH" />
          </div>
          <div className="field-row">
            <div className="field"><label>Saldo (Modal)</label>
              <input type="number" value={form.saldo} onChange={e => set('saldo', e.target.value)} placeholder="0" />
            </div>
            <div className="field"><label>Aktual (Sekarang)</label>
              <input type="number" value={form.aktual} onChange={e => set('aktual', e.target.value)} placeholder="0" />
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
            <th>Symbol</th>
            <th className="num">Saldo</th><th className="num">Aktual</th><th className="num">PnL</th><th></th>
          </tr></thead>
          <tbody>
            {data.map(r => {
              const pnl = Number(r.aktual) - Number(r.saldo)
              return (
                <tr key={r.id}>
                  <td><span className="crypto-sym">{r.symbol}</span></td>
                  <td className="num">{fmt(r.saldo)}</td>
                  <td className="num">{fmt(r.aktual)}</td>
                  <td className={`num ${pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(pnl)}</td>
                  <td className="actions">
                    <button className="btn-icon" onClick={() => openEdit(r)}>✏</button>
                    <button className="btn-icon del" onClick={() => del(r.id)}>×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot><tr>
            <td><strong>Total</strong></td>
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
