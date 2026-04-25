// src/components/Summary.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'
import NumInput from './NumInput'
import { useLang } from '../lib/LangContext'

export default function Summary({ data, uid, onRefresh, showToast }) {
  const { t } = useLang()
  const { bibit, binance, fisik, kas, jht, target } = data
  const [editTarget, setEditTarget] = useState(false)
  const [newTarget, setNewTarget]   = useState(target)

  const tBibitSaldo  = bibit.reduce((s, r) => s + Number(r.saldo), 0)
  const tBibitAktual = bibit.reduce((s, r) => s + Number(r.aktual), 0)
  const tBinSaldo    = binance.reduce((s, r) => s + Number(r.saldo), 0)
  const tBinAktual   = binance.reduce((s, r) => s + Number(r.aktual), 0)
  const tKas   = kas.reduce((s, r) => s + Number(r.jumlah), 0)
  const tFisik = fisik.reduce((s, r) => s + Number(r.buy_price), 0)
  const tJHT   = Number(jht) || 0

  const tLiquid = tKas + tJHT
  const tInvest = tBibitAktual + tBinAktual
  const tAsset  = tLiquid + tInvest + tFisik
  const prog    = target > 0 ? Math.min((tAsset / target) * 100, 100) : 0

  const saveTarget = async () => {
    const { data: ex } = await supabase.from('financial_goals').select('id').eq('user_id', uid).maybeSingle()
    if (ex) await supabase.from('financial_goals').update({ target_amount: newTarget }).eq('id', ex.id)
    else     await supabase.from('financial_goals').insert({ user_id: uid, target_amount: newTarget })
    setEditTarget(false)
    onRefresh()
    showToast(t('toastUpdated'))
  }

  const bibitPnl  = tBibitAktual - tBibitSaldo
  const binancePnl = tBinAktual - tBinSaldo

  const liquidMetrics = [
    { label: t('kas_likuid') || 'Kas Likuid', value: fmt(tKas), sub: `${kas.length} ${t('positions')}` },
    { label: 'JHT', value: fmt(tJHT), sub: 'BPJS Ketenagakerjaan' },
  ]

  const investMetrics = [
    {
      label: 'BIBIT',
      value: fmt(tBibitAktual),
      sub: fmtPnl(bibitPnl),
      profit: bibitPnl >= 0,
    },
    {
      label: 'Binance',
      value: fmt(tBinAktual),
      sub: fmtPnl(binancePnl),
      profit: binancePnl >= 0,
    },
  ]

  const allocs = [
    { label: 'BIBIT',   val: tBibitAktual, color: 'var(--blue)',   group: 'invest' },
    { label: 'Binance', val: tBinAktual,   color: 'var(--amber)',  group: 'invest' },
    { label: 'Kas',     val: tKas,         color: 'var(--green)',  group: 'liquid' },
    { label: 'JHT',     val: tJHT,         color: 'var(--purple)', group: 'liquid' },
    { label: t('physical'), val: tFisik,   color: 'var(--muted)',  group: 'fisik'  },
  ]

  const AllocSection = ({ group }) => allocs.filter(a => a.group === group).map(a => {
    const pct = tAsset > 0 ? (a.val / tAsset) * 100 : 0
    return (
      <div key={a.label} className="alloc-row">
        <div className="alloc-name"><span className="alloc-dot" style={{ background: a.color }} />{a.label}</div>
        <div className="alloc-track"><div className="alloc-bar" style={{ width: `${pct}%`, background: a.color }} /></div>
        <span className="alloc-pct">{pct.toFixed(1)}%</span>
        <span className="alloc-val">{fmt(a.val)}</span>
      </div>
    )
  })

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">{t('portfolioSummary')}</h2>
        <div className="target-row">
          {editTarget ? (
            <>
              <span className="label-sm">{t('target')}:</span>
              <NumInput value={newTarget} onChange={v => setNewTarget(v)} className="target-input" />
              <button className="btn-xs btn-primary" onClick={saveTarget}>{t('save')}</button>
              <button className="btn-xs" onClick={() => setEditTarget(false)}>{t('cancel')}</button>
            </>
          ) : (
            <>
              <span className="label-sm">{t('target')}: <strong>{fmt(target)}</strong></span>
              <button className="btn-xs" onClick={() => { setNewTarget(target); setEditTarget(true) }}>{t('edit')}</button>
            </>
          )}
        </div>
      </div>

      <div className="summary-total-card">
        <div className="summary-total-left">
          <div className="summary-total-label">{t('totalAsset')}</div>
          <div className="summary-total-value">{fmt(tAsset)}</div>
        </div>
        <div className="summary-total-right">
          <div className="progress-section" style={{ marginBottom: 0 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${prog}%` }} />
            </div>
            <span className="progress-label">{prog.toFixed(2)}%</span>
          </div>
          <div className="summary-total-sub">{t('fromTarget')} {fmt(target)}</div>
        </div>
      </div>

      {/* Aset Liquid */}
      <div className="metrics-group">
        <div className="metrics-group-header">
          <span className="metrics-group-label">
            <span className="metrics-group-dot" style={{ background: 'var(--green)' }} />
            {t('liquidAsset')}
          </span>
          <span className="metrics-group-total">{fmt(tLiquid)}</span>
        </div>
        <div className="metrics-grid">
          {liquidMetrics.map((m, i) => (
            <div key={i} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-sub">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Aset Tidak Liquid */}
      <div className="metrics-group">
        <div className="metrics-group-header">
          <span className="metrics-group-label">
            <span className="metrics-group-dot" style={{ background: 'var(--blue)' }} />
            {t('nonLiquidAsset')}
          </span>
          <span className="metrics-group-total">{fmt(tInvest)}</span>
        </div>
        <div className="metrics-grid">
          {investMetrics.map((m, i) => (
            <div key={i} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.value}</div>
              <div className={`metric-sub metric-pnl ${m.profit ? 'pos' : 'neg'}`}>
                <span className="metric-pnl-arrow">{m.profit ? '▲' : '▼'}</span>
                {m.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aset Fisik */}
      <div className="metrics-group">
        <div className="metrics-group-header">
          <span className="metrics-group-label">
            <span className="metrics-group-dot" style={{ background: 'var(--muted)' }} />
            {t('physicalAsset')}
          </span>
          <span className="metrics-group-total">{fmt(tFisik)}</span>
        </div>
        <div className="metrics-grid">
          <div className="metric-card metric-fisik">
            <div className="metric-label">{t('totalBuyPrice')}</div>
            <div className="metric-value">{fmt(tFisik)}</div>
            <div className="metric-sub">{fisik.length} {t('items')}</div>
          </div>
        </div>
      </div>

      {/* Alokasi */}
      <div className="alloc-card">
        <h3 className="alloc-title">{t('assetAllocation')}</h3>
        <div className="alloc-group-label">{t('nonLiquid')}</div>
        <AllocSection group="invest" />
        <div className="alloc-divider" />
        <div className="alloc-group-label">{t('liquid')}</div>
        <AllocSection group="liquid" />
        <div className="alloc-divider" />
        <div className="alloc-group-label">{t('physical')}</div>
        <AllocSection group="fisik" />
      </div>
    </div>
  )
}
