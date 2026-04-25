// src/components/BinanceTable.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'
import Modal from './Modal'

const EMPTY = { symbol: '', catatan: '' }

export default function BinanceTable({ data, uid, onRefresh }) {
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editId, setEditId]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const [saldoUsdt,  setSaldoUsdt]  = useState('')
  const [aktualUsdt, setAktualUsdt] = useState('')

  const [usdtRate,    setUsdtRate]    = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateErr,     setRateErr]     = useState(null)
  const [rateTime,    setRateTime]    = useState(null)

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

  const fetchRate = async () => {
    setRateLoading(true); setRateErr(null)
    const opt = { signal: AbortSignal.timeout(6000) }
    const sources = [
      async () => {
        const j = await (await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBIDR', opt)).json()
        if (j?.price) return Number(j.price)
        throw new Error()
      },
      async () => {
        const j = await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr', opt)).json()
        if (j?.tether?.idr) return j.tether.idr
        throw new Error()
      },
      async () => {
        const j = await (await fetch('https://open.er-api.com/v6/latest/USD', opt)).json()
        if (j?.rates?.IDR) return Math.round(j.rates.IDR)
        throw new Error()
      },
    ]
    for (const src of sources) {
      try {
        const rate = await src()
        setUsdtRate(rate)
        setRateTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
        setRateLoading(false)
        return
      } catch {}
    }
    setRateErr('Gagal mengambil rate — coba lagi')
    setRateLoading(false)
  }

  useEffect(() => { fetchRate() }, [])

  const saldoIdr  = usdtRate && saldoUsdt  !== '' ? Math.round(Number(saldoUsdt)  * usdtRate) : null
  const aktualIdr = usdtRate && aktualUsdt !== '' ? Math.round(Number(aktualUsdt) * usdtRate) : null

  const openAdd = () => {
    setForm(EMPTY); setEditId(null); setSaveErr(null)
    setSaldoUsdt(''); setAktualUsdt('')
    setModal(true)
  }

  const openEdit = (r) => {
    setForm({ symbol: r.symbol, catatan: r.catatan || '' })
    setEditId(r.id); setSaveErr(null)
    if (usdtRate) {
      setSaldoUsdt((Number(r.saldo)  / usdtRate).toFixed(4))
      setAktualUsdt((Number(r.aktual) / usdtRate).toFixed(4))
    } else {
      setSaldoUsdt(''); setAktualUsdt('')
    }
    setModal(true)
  }

  const close = () => {
    setModal(false); setEditId(null); setSaveErr(null)
    setSaldoUsdt(''); setAktualUsdt('')
  }

  const save = async () => {
    if (!usdtRate) { setSaveErr('Rate USDT/IDR belum tersedia. Klik Refresh rate dulu.'); return }
    if (saldoIdr === null || aktualIdr === null) { setSaveErr('Isi Saldo dan Aktual dalam USDT.'); return }
    setSaving(true); setSaveErr(null)
    const p = {
      symbol:  form.symbol,
      saldo:   saldoIdr,
      aktual:  aktualIdr,
      catatan: form.catatan,
      user_id: uid,
    }
    const { error } = editId
      ? await supabase.from('binance_assets').update(p).eq('id', editId)
      : await supabase.from('binance_assets').insert(p)
    setSaving(false)
    if (error) { setSaveErr(error.message); return }
    close(); onRefresh()
  }

  const del = async (id) => {
    if (!confirm('Hapus aset ini?')) return
    await supabase.from('binance_assets').delete().eq('id', id)
    onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      {/* Rate bar */}
      <div className="usdt-rate-bar">
        <span className="usdt-rate-label">USDT/IDR</span>
        {rateLoading ? (
          <span className="usdt-rate-val muted">Memuat...</span>
        ) : rateErr ? (
          <span className="usdt-rate-val neg">{rateErr}</span>
        ) : (
          <>
            <span className="usdt-rate-val">{usdtRate ? fmt(usdtRate) : '—'}</span>
            {rateTime && <span className="usdt-rate-time">diperbarui {rateTime}</span>}
          </>
        )}
        <button className="btn-xs" onClick={fetchRate} disabled={rateLoading}>↻ Refresh</button>
      </div>

      <div className="section-header">
        <h2 className="section-title">Binance — Crypto Portfolio</h2>
        <button className="btn-add" onClick={openAdd}>+ Tambah</button>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Crypto' : 'Tambah Crypto'} onClose={close} onSave={save} saving={saving} error={saveErr}>
          <div className="field">
            <label>Symbol</label>
            <input value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="BNB / BTC / ETH / dll" autoFocus />
          </div>

          <div className="usdt-rate-hint">
            Rate saat ini: <strong>{usdtRate ? fmt(usdtRate) : '—'}</strong> / USDT
            {!usdtRate && (
              <button className="btn-xs" style={{ marginLeft: 8 }} onClick={fetchRate} disabled={rateLoading}>↻</button>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label>Saldo Modal (USDT)</label>
              <input
                type="number"
                step="any"
                value={saldoUsdt}
                onChange={e => setSaldoUsdt(e.target.value)}
                placeholder="0.0000"
              />
              {saldoIdr !== null && (
                <div className="usdt-idr-preview">≈ {fmt(saldoIdr)}</div>
              )}
            </div>
            <div className="field">
              <label>Aktual Sekarang (USDT)</label>
              <input
                type="number"
                step="any"
                value={aktualUsdt}
                onChange={e => setAktualUsdt(e.target.value)}
                placeholder="0.0000"
              />
              {aktualIdr !== null && (
                <div className="usdt-idr-preview">≈ {fmt(aktualIdr)}</div>
              )}
            </div>
          </div>

          <div className="field">
            <label>Catatan</label>
            <input value={form.catatan || ''} onChange={e => set('catatan', e.target.value)} placeholder="Opsional" />
          </div>
        </Modal>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh k="symbol">Symbol</SortTh>
              <SortTh k="saldo" className="num">Saldo (IDR)</SortTh>
              <SortTh k="aktual" className="num">Aktual (IDR)</SortTh>
              <SortTh k="_pnl" className="num">PnL</SortTh>
              {usdtRate && <th className="num">Aktual (USDT)</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={usdtRate ? 5 : 4} className="empty-state">Belum ada data</td></tr>
            )}
            {sorted.map(r => {
              const pnl = Number(r.aktual) - Number(r.saldo)
              return (
                <tr key={r.id}>
                  <td><span className="crypto-sym">{r.symbol}</span></td>
                  <td className="num">{fmt(r.saldo)}</td>
                  <td className="num">{fmt(r.aktual)}</td>
                  <td className={`num ${pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(pnl)}</td>
                  {usdtRate && (
                    <td className="num muted">
                      {(Number(r.aktual) / usdtRate).toFixed(2)} USDT
                    </td>
                  )}
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
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td className="num"><strong>{fmt(tSaldo)}</strong></td>
              <td className="num"><strong>{fmt(tAktual)}</strong></td>
              <td className={`num ${tAktual >= tSaldo ? 'pos' : 'neg'}`}>
                <strong>{fmtPnl(tAktual - tSaldo)}</strong>
              </td>
              {usdtRate && (
                <td className="num muted">
                  <strong>{(tAktual / usdtRate).toFixed(2)} USDT</strong>
                </td>
              )}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
