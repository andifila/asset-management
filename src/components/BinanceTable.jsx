// src/components/BinanceTable.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtPnl } from '../lib/format'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'
import { useLang } from '../lib/LangContext'

const EMPTY = { symbol: '', catatan: '' }
const AUTO_REFRESH_MS = 5 * 60 * 1000 // 5 menit

export default function BinanceTable({ data, uid, onRefresh, showToast }) {
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

  const [saldoUsdt,  setSaldoUsdt]  = useState('')
  const [aktualUsdt, setAktualUsdt] = useState('')

  const [usdtRate,    setUsdtRate]    = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateErr,     setRateErr]     = useState(null)
  const [rateTime,    setRateTime]    = useState(null)
  const [nextRefresh, setNextRefresh] = useState(AUTO_REFRESH_MS / 1000)

  const countdownRef = useRef(null)

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

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setNextRefresh(AUTO_REFRESH_MS / 1000)
    countdownRef.current = setInterval(() => {
      setNextRefresh(n => {
        if (n <= 1) return AUTO_REFRESH_MS / 1000
        return n - 1
      })
    }, 1000)
  }

  useEffect(() => {
    fetchRate()
    startCountdown()
    const autoId = setInterval(() => { fetchRate(); startCountdown() }, AUTO_REFRESH_MS)
    return () => { clearInterval(autoId); clearInterval(countdownRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const manualRefresh = () => { fetchRate(); startCountdown() }

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
    if (!form.symbol.trim()) { setSaveErr(t('errSymbol')); return }
    if (!usdtRate) { setSaveErr(t('errNoRate')); return }
    if (!saldoUsdt || Number(saldoUsdt) <= 0) { setSaveErr(t('errSaldoUsdt')); return }
    if (aktualUsdt === '' || Number(aktualUsdt) < 0) { setSaveErr(t('errAktualUsdt')); return }
    setSaving(true); setSaveErr(null)
    const p = {
      symbol:  form.symbol.trim().toUpperCase(),
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
    showToast(editId ? t('toastUpdated') : t('toastAdded'))
  }

  const del = async () => {
    setDeleting(true)
    await supabase.from('binance_assets').delete().eq('id', confirmItem.id)
    setDeleting(false); setConfirmItem(null)
    showToast(t('toastDeleted')); onRefresh()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fmtCountdown = (s) => {
    const m = Math.floor(s / 60), sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div>
      {/* Rate bar */}
      <div className="usdt-rate-bar">
        <span className="usdt-rate-label">USDT/IDR</span>
        {rateLoading ? (
          <span className="usdt-rate-val muted">{t('loadingRate')}</span>
        ) : rateErr ? (
          <span className="usdt-rate-val neg">{rateErr}</span>
        ) : (
          <>
            <span className="usdt-rate-val">{usdtRate ? fmt(usdtRate) : '—'}</span>
            {rateTime && <span className="usdt-rate-time">{t('updatedAt')} {rateTime}</span>}
            <span className="usdt-rate-countdown">↻ {fmtCountdown(nextRefresh)}</span>
          </>
        )}
        <button className="btn-xs" onClick={manualRefresh} disabled={rateLoading}>{t('refresh')}</button>
      </div>

      <div className="section-header">
        <h2 className="section-title">{t('binanceTitle')}</h2>
        <button className="btn-add" onClick={openAdd}>{t('add')}</button>
      </div>

      {modal && (
        <Modal title={editId ? t('editCrypto') : t('addCrypto')} onClose={close} onSave={save} saving={saving} error={saveErr}>
          <div className="field">
            <label>{t('symbol')}</label>
            <input value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="BNB / BTC / ETH / dll" autoFocus />
          </div>

          <div className="usdt-rate-hint">
            {t('currentRate')}: <strong>{usdtRate ? fmt(usdtRate) : '—'}</strong> / USDT
            {!usdtRate && (
              <button className="btn-xs" style={{ marginLeft: 8 }} onClick={manualRefresh} disabled={rateLoading}>↻</button>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('balanceUsdt')}</label>
              <input type="number" step="any" value={saldoUsdt} onChange={e => setSaldoUsdt(e.target.value)} placeholder="0.0000" />
              {saldoIdr !== null && <div className="usdt-idr-preview">≈ {fmt(saldoIdr)}</div>}
            </div>
            <div className="field">
              <label>{t('actualNowUsdt')}</label>
              <input type="number" step="any" value={aktualUsdt} onChange={e => setAktualUsdt(e.target.value)} placeholder="0.0000" />
              {aktualIdr !== null && <div className="usdt-idr-preview">≈ {fmt(aktualIdr)}</div>}
            </div>
          </div>

          <div className="field">
            <label>{t('notes')}</label>
            <input value={form.catatan || ''} onChange={e => set('catatan', e.target.value)} placeholder={t('optional')} />
          </div>
        </Modal>
      )}

      {confirmItem && (
        <ConfirmModal name={confirmItem.symbol} onConfirm={del} onCancel={() => setConfirmItem(null)} loading={deleting} />
      )}

      <div className="physical-layout">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh k="symbol">{t('symbol')}</SortTh>
              <SortTh k="saldo" className="num">{t('balanceIdr')}</SortTh>
              <SortTh k="aktual" className="num">{t('actualIdr')}</SortTh>
              <SortTh k="_pnl" className="num">{t('pnl')}</SortTh>
              {usdtRate && <th className="num">{t('actualUsdt')}</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={usdtRate ? 5 : 4} className="empty-state">{t('noData')}</td></tr>
            )}
            {sorted.map(r => {
              const pnl = Number(r.aktual) - Number(r.saldo)
              const rank = profitRanks[r.id]
              const rankCls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : 'rank-3'
              return (
                <tr key={r.id}>
                  <td><span className="crypto-sym">{r.symbol}</span></td>
                  <td className="num">{fmt(r.saldo)}</td>
                  <td className="num">{fmt(r.aktual)}</td>
                  <td className={`num ${pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(pnl)}</td>
                  {usdtRate && (
                    <td className="num muted">{(Number(r.aktual) / usdtRate).toFixed(2)} USDT</td>
                  )}
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
          <tfoot>
            <tr>
              <td><strong>{t('total')}</strong></td>
              <td className="num"><strong>{fmt(tSaldo)}</strong></td>
              <td className="num"><strong>{fmt(tAktual)}</strong></td>
              <td className={`num ${tAktual >= tSaldo ? 'pos' : 'neg'}`}>
                <strong>{fmtPnl(tAktual - tSaldo)}</strong>
              </td>
              {usdtRate && (
                <td className="num muted"><strong>{(tAktual / usdtRate).toFixed(2)} USDT</strong></td>
              )}
              <td />
            </tr>
          </tfoot>
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
                  <div className="physical-rank-name">{item.symbol}</div>
                  <div className={`physical-rank-val ${item.pnlPct >= 0 ? 'pos' : 'neg'}`}>
                    {fmtPnl(Number(item.aktual) - Number(item.saldo))}
                    <span className="rank-val-sub">{sign}{item.pnlPct.toFixed(2)}%</span>
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
