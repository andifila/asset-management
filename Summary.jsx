// src/components/Summary.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'

export default function Summary({ data, uid, onRefresh }) {
  const { bibit, binance, fisik, kas, jht, target } = data
  const [editTarget, setEditTarget] = useState(false)
  const [newTarget, setNewTarget] = useState(target)

  const tBibitSaldo  = bibit.reduce((s, r) => s + Number(r.saldo), 0)
  const tBibitAktual = bibit.reduce((s, r) => s + Number(r.aktual), 0)
  const tBinSaldo    = binance.reduce((s, r) => s + Number(r.saldo), 0)
  const tBinAktual   = binance.reduce((s, r) => s + Number(r.aktual), 0)
  const tKas         = kas.reduce((s, r) => s + Number(r.jumlah), 0)
  const tFisik       = fisik.reduce((s, r) => s + Number(r.buy_price), 0)
  const tJHT         = Number(jht) || 0
  const tAsset       = tBibitAktual + tBinAktual + tKas + tJHT
  const prog         = target > 0 ? Math.min((tAsset / target) * 100, 100) : 0

  const saveTarget = async () => {
    const { data: ex } = await supabase.from('financial_goals').select('id').eq('user_id', uid).maybeSingle()
    if (ex) await supabase.from('financial_goals').update({ target_amount: newTarget }).eq('id', ex.id)
    else     await supabase.from('financial_goals').insert({ user_id: uid, target_amount: newTarget })
    setEditTarget(false)
    onRefresh()
  }

  const metrics = [
    { label: 'Total Aset Investasi', value: fmt(tAsset), sub: `${prog.toFixed(2)}% dari target`, accent: true },
    { label: 'BIBIT', value: fmt(tBibitAktual), sub: fmtPnl(tBibitAktual - tBibitSaldo), subClass: tBibitAktual >= tBibitSaldo ? 'pos' : 'neg' },
    { label: 'Binance', value: fmt(tBinAktual), sub: fmtPnl(tBinAktual - tBinSaldo), subClass: tBinAktual >= tBinSaldo ? 'pos' : 'neg' },
    { label: 'Kas Likuid', value: fmt(tKas), sub: `${kas.length} pos` },
    { label: 'JHT', value: fmt(tJHT), sub: 'BPJS Ketenagakerjaan' },
    { label: 'Aset Fisik', value: fmt(tFisik), sub: `${fisik.length} item (nilai beli)` },
  ]

  const allocs = [
    { label: 'BIBIT', val: tBibitAktual, color: 'var(--blue)' },
    { label: 'Binance', val: tBinAktual, color: 'var(--amber)' },
    { label: 'Kas', val: tKas, color: 'var(--green)' },
    { label: 'JHT', val: tJHT, color: 'var(--purple)' },
  ]

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Ringkasan Portofolio</h2>
        <div className="target-row">
          {editTarget ? (
            <>
              <span className="label-sm">Target:</span>
              <input type="number" value={newTarget} onChange={e => setNewTarget(Number(e.target.value))} className="target-input" />
              <button className="btn-xs btn-primary" onClick={saveTarget}>Simpan</button>
              <button className="btn-xs" onClick={() => setEditTarget(false)}>Batal</button>
            </>
          ) : (
            <>
              <span className="label-sm">Target: <strong>{fmt(target)}</strong></span>
              <button className="btn-xs" onClick={() => { setNewTarget(target); setEditTarget(true) }}>Edit</button>
            </>
          )}
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${prog}%` }} />
        </div>
        <span className="progress-label">{prog.toFixed(2)}%</span>
      </div>

      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div key={i} className={`metric-card ${m.accent ? 'metric-accent' : ''}`}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className={`metric-sub ${m.subClass || ''}`}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="alloc-card">
        <h3 className="alloc-title">Alokasi Aset Investasi</h3>
        {allocs.map(a => {
          const pct = tAsset > 0 ? (a.val / tAsset) * 100 : 0
          return (
            <div key={a.label} className="alloc-row">
              <div className="alloc-name">
                <span className="alloc-dot" style={{ background: a.color }} />
                {a.label}
              </div>
              <div className="alloc-track">
                <div className="alloc-bar" style={{ width: `${pct}%`, background: a.color }} />
              </div>
              <span className="alloc-pct">{pct.toFixed(1)}%</span>
              <span className="alloc-val">{fmt(a.val)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
