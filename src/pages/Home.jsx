// src/pages/Home.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/format'
import { useLang } from '../lib/LangContext'

const MODULES = [
  {
    id: 'asset',
    icon: '◈',
    titleId: 'Asset Tracking',
    titleEn: 'Asset Tracking',
    descId: 'Pantau portofolio aset liquid, investasi, dan fisik kamu.',
    descEn: 'Track your liquid, investment, and physical asset portfolio.',
    color: 'var(--blue)',
    available: true,
  },
  {
    id: 'service',
    icon: '⚙',
    titleId: 'Service Kendaraan',
    titleEn: 'Vehicle Service',
    descId: 'Catat servis motor & mobil, jadwal, dan biaya.',
    descEn: 'Log vehicle service history, schedules, and costs.',
    color: 'var(--amber)',
    available: true,
  },
  {
    id: 'itinerary',
    icon: '✈',
    titleId: 'Itinerary',
    titleEn: 'Itinerary',
    descId: 'Rencanakan perjalanan, budget, dan jadwal trip.',
    descEn: 'Plan your trips, budgets, and travel schedules.',
    color: 'var(--green)',
    available: false,
  },
  {
    id: 'hiking',
    icon: '▲',
    titleId: 'Mountain Hiking',
    titleEn: 'Mountain Hiking',
    descId: 'Dokumentasi pendakian, jalur, dan logistik gunung.',
    descEn: 'Document hikes, trails, and mountain logistics.',
    color: 'var(--purple)',
    available: false,
  },
]

const QUICK_ACTIONS = [
  { labelId: '+ Liquid',    labelEn: '+ Liquid',    tabType: 'kas'     },
  { labelId: '+ BIBIT',     labelEn: '+ BIBIT',     tabType: 'bibit'   },
  { labelId: '+ Crypto',    labelEn: '+ Crypto',    tabType: 'binance' },
  { labelId: '+ Aset Fisik',labelEn: '+ Physical',  tabType: 'fisik'   },
]

export default function Home({ session, onModule }) {
  const { lang } = useLang()
  const [assetTotal, setAssetTotal] = useState(null)
  const uid = session.user.id
  const name = session.user.user_metadata?.full_name?.split(' ')[0] || 'Kamu'
  const avatar = session.user.user_metadata?.avatar_url

  useEffect(() => {
    const fetchTotal = async () => {
      const [bibit, binance, fisik, kas, jht] = await Promise.all([
        supabase.from('bibit_assets').select('aktual').eq('user_id', uid),
        supabase.from('binance_assets').select('aktual').eq('user_id', uid),
        supabase.from('physical_assets').select('buy_price').eq('user_id', uid),
        supabase.from('liquid_assets').select('jumlah').eq('user_id', uid),
        supabase.from('jht_assets').select('jumlah').eq('user_id', uid).maybeSingle(),
      ])
      const sum = (rows, key) => (rows.data || []).reduce((s, r) => s + Number(r[key] || 0), 0)
      const total =
        sum(bibit, 'aktual') +
        sum(binance, 'aktual') +
        sum(fisik, 'buy_price') +
        sum(kas, 'jumlah') +
        Number(jht.data?.jumlah || 0)
      setAssetTotal(total)
    }
    fetchTotal()
  }, [uid])

  const logout = () => supabase.auth.signOut()

  return (
    <div className="home-wrap">
      <header className="topbar">
        <div className="topbar-brand">◈ <span>MySpace</span></div>
        <div className="topbar-right">
          {avatar && <img src={avatar} className="avatar" alt="avatar" referrerPolicy="no-referrer" />}
          <button className="btn-logout" onClick={logout}>
            {lang === 'id' ? 'Keluar' : 'Logout'}
          </button>
        </div>
      </header>

      <main className="home-main">
        <div className="home-greeting">
          <div className="home-greeting-text">
            {lang === 'id' ? `Halo, ${name}!` : `Hello, ${name}!`}
          </div>
          <div className="home-greeting-sub">
            {lang === 'id' ? 'Mau ngapain hari ini?' : 'What would you like to do today?'}
          </div>
        </div>

        <div className="module-grid">
          {MODULES.map(mod => (
            <div
              key={mod.id}
              className={`module-card${mod.available ? ' module-available' : ' module-soon'}`}
              onClick={() => mod.available && onModule(mod.id)}
              style={{ '--mod-color': mod.color }}
            >
              <div className="module-card-top">
                <div className="module-icon" style={{ color: mod.color }}>{mod.icon}</div>
                <span className={`module-badge ${mod.available ? 'badge-active' : 'badge-soon'}`}>
                  {mod.available
                    ? (lang === 'id' ? 'Aktif' : 'Active')
                    : (lang === 'id' ? 'Segera' : 'Soon')}
                </span>
              </div>
              <div className="module-title">{lang === 'id' ? mod.titleId : mod.titleEn}</div>
              <div className="module-desc">{lang === 'id' ? mod.descId : mod.descEn}</div>

              {mod.id === 'asset' && (
                <div className="module-stat">
                  <span className="module-stat-label">{lang === 'id' ? 'Total Aset' : 'Total Assets'}</span>
                  <span className="module-stat-val">
                    {assetTotal === null ? '...' : fmt(assetTotal)}
                  </span>
                </div>
              )}

              <div className="module-cta">
                {mod.available
                  ? (lang === 'id' ? 'Buka Modul →' : 'Open Module →')
                  : (lang === 'id' ? 'Belum tersedia' : 'Not available yet')}
              </div>
            </div>
          ))}
        </div>

        <div className="quick-section">
          <div className="quick-section-title">
            {lang === 'id' ? 'Quick Actions — Asset Tracking' : 'Quick Actions — Asset Tracking'}
          </div>
          <div className="quick-actions">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.tabType}
                className="quick-action-btn"
                onClick={() => onModule('asset', a.tabType)}
              >
                {lang === 'id' ? a.labelId : a.labelEn}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
