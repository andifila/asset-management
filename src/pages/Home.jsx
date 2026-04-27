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
    descId: 'Milestone tempat-tempat yang pernah kamu datangi.',
    descEn: 'Milestone of places you have visited.',
    color: 'var(--green)',
    available: true,
  },
  {
    id: 'hiking',
    icon: '▲',
    titleId: 'Mountain Hiking',
    titleEn: 'Mountain Hiking',
    descId: 'Milestone gunung-gunung yang pernah kamu daki.',
    descEn: 'Milestone of mountains you have climbed.',
    color: 'var(--purple)',
    available: true,
  },
]

const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : null

export default function Home({ session, onModule }) {
  const { lang } = useLang()
  const [assetTotal, setAssetTotal] = useState(null)
  const [showAssets, setShowAssets] = useState(() => localStorage.getItem('showAssets') !== 'false')
  const [lastService, setLastService] = useState(null)
  const [lastTrip,    setLastTrip]    = useState(null)
  const [lastHike,    setLastHike]    = useState(null)

  const uid  = session.user.id
  const name = session.user.user_metadata?.full_name?.split(' ')[0] || 'Kamu'
  const avatar = session.user.user_metadata?.avatar_url

  const toggleAssets = () => {
    setShowAssets(prev => {
      localStorage.setItem('showAssets', !prev)
      return !prev
    })
  }

  useEffect(() => {
    const fetchAll = async () => {
      const [bibit, binance, fisik, kas, jht, svc, trip, hike] = await Promise.all([
        supabase.from('bibit_assets').select('aktual').eq('user_id', uid),
        supabase.from('binance_assets').select('aktual').eq('user_id', uid),
        supabase.from('physical_assets').select('buy_price').eq('user_id', uid),
        supabase.from('liquid_assets').select('jumlah').eq('user_id', uid),
        supabase.from('jht_assets').select('jumlah').eq('user_id', uid).maybeSingle(),
        supabase.from('service_records').select('service_date, service_type, shop')
          .eq('user_id', uid).order('service_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('trips').select('destination, end_date')
          .eq('user_id', uid).eq('status', 'done')
          .order('end_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('hikes').select('mountain, start_date, elevation')
          .eq('user_id', uid).order('start_date', { ascending: false }).limit(1).maybeSingle(),
      ])

      const sum = (rows, key) => (rows.data || []).reduce((s, r) => s + Number(r[key] || 0), 0)
      setAssetTotal(
        sum(bibit, 'aktual') + sum(binance, 'aktual') +
        sum(fisik, 'buy_price') + sum(kas, 'jumlah') + Number(jht.data?.jumlah || 0)
      )
      setLastService(svc.data || null)
      setLastTrip(trip.data || null)
      setLastHike(hike.data || null)
    }
    fetchAll()
  }, [uid])

  const logout = () => supabase.auth.signOut()

  const getModuleStat = (mod) => {
    if (mod.id === 'asset') {
      return {
        label: lang === 'id' ? 'Total Aset' : 'Total Assets',
        val: assetTotal === null ? '...' : (showAssets ? fmt(assetTotal) : '••••••'),
        extra: (
          <button
            className="asset-eye-btn"
            onClick={e => { e.stopPropagation(); toggleAssets() }}
            title={showAssets ? 'Sembunyikan' : 'Tampilkan'}
          >
            {showAssets ? '👁' : '🙈'}
          </button>
        ),
      }
    }
    if (mod.id === 'service') {
      if (!lastService) return null
      let svcLabel = lastService.service_type || '—'
      try {
        const items = JSON.parse(lastService.service_type)
        if (Array.isArray(items) && items.length)
          svcLabel = items.map(i => i.nama).filter(Boolean).join(', ')
      } catch {}
      return {
        label: 'Servis Terakhir',
        val: svcLabel,
        sub: fmtDate(lastService.service_date),
      }
    }
    if (mod.id === 'itinerary') {
      if (!lastTrip) return null
      return {
        label: 'Terakhir Dikunjungi',
        val: lastTrip.destination,
        sub: fmtDate(lastTrip.end_date),
      }
    }
    if (mod.id === 'hiking') {
      if (!lastHike) return null
      return {
        label: 'Gunung Terakhir',
        val: lastHike.mountain,
        sub: lastHike.elevation ? `▲ ${lastHike.elevation.toLocaleString('id-ID')} mdpl · ${fmtDate(lastHike.start_date)}` : fmtDate(lastHike.start_date),
      }
    }
    return null
  }

  return (
    <div className="home-wrap">
      <header className="topbar">
        <div className="topbar-brand">◈ <span>MySpace</span></div>
        <div className="topbar-right">
          {avatar && <img src={avatar} className="avatar" alt="avatar" referrerPolicy="no-referrer" />}
          <span className="topbar-name">{name}</span>
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
          {MODULES.map(mod => {
            const stat = getModuleStat(mod)
            return (
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

                {stat && (
                  <div className="module-stat">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span className="module-stat-label">{stat.label}</span>
                      {stat.extra}
                    </div>
                    <span className="module-stat-val">{stat.val}</span>
                    {stat.sub && <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 2 }}>{stat.sub}</div>}
                  </div>
                )}

                <div className="module-cta">
                  {mod.available
                    ? (lang === 'id' ? 'Buka Modul →' : 'Open Module →')
                    : (lang === 'id' ? 'Belum tersedia' : 'Not available yet')}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
