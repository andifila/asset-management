// src/pages/Home.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/format'
import { useLang } from '../lib/LangContext'

const MODULES = [
  { id: 'asset',     icon: '◈', titleKey: 'homeModAssetTitle', descKey: 'homeModAssetDesc', color: 'var(--blue)',   available: true, hero: true,  primary: true  },
  { id: 'service',   icon: '⚙', titleKey: 'homeModSvcTitle',   descKey: 'homeModSvcDesc',   color: 'var(--amber)',  available: true, hero: false, primary: true  },
  { id: 'itinerary', icon: '✈', titleKey: 'homeModItinTitle',  descKey: 'homeModItinDesc',  color: 'var(--green)', available: true, hero: false, primary: false },
  { id: 'hiking',    icon: '▲', titleKey: 'homeModHikeTitle',  descKey: 'homeModHikeDesc',  color: 'var(--purple)',available: true, hero: false, primary: false },
  { id: 'wedding',   icon: '💒',titleKey: 'homeModWpTitle',    descKey: 'homeModWpDesc',    color: '#c084fc',      available: true, hero: false, primary: false },
]

const fmtDate = (d, lang) =>
  d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : null

const daysSince = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : null

const relTime = (d, lang) => {
  const n = daysSince(d)
  if (n === null) return null
  if (lang === 'en') {
    if (n === 0) return 'today'
    if (n === 1) return 'yesterday'
    if (n < 30)  return `${n} days ago`
    if (n < 365) return `${Math.floor(n / 30)} months ago`
    return `${Math.floor(n / 365)} years ago`
  }
  if (n === 0) return 'hari ini'
  if (n === 1) return 'kemarin'
  if (n < 30)  return `${n} hari lalu`
  if (n < 365) return `${Math.floor(n / 30)} bulan lalu`
  return `${Math.floor(n / 365)} tahun lalu`
}

const getGreeting = (lang) => {
  const h = new Date().getHours()
  if (lang === 'en') {
    if (h < 5 || h >= 19) return 'Good evening'
    if (h < 11) return 'Good morning'
    return 'Good afternoon'
  }
  if (h < 5)  return 'Selamat malam'
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 19) return 'Selamat sore'
  return 'Selamat malam'
}

const getSubtitle = (lang) => {
  const h = new Date().getHours()
  if (lang === 'en') {
    if (h < 5)  return 'Still up? Take care of your health!'
    if (h < 11) return 'Good morning, ready to manage your day?'
    if (h < 15) return 'Stay productive this afternoon!'
    if (h < 19) return 'Good afternoon, check your activity updates.'
    return 'Any updates to log tonight?'
  }
  if (h < 5)  return 'Masih terjaga? Jaga kesehatan ya!'
  if (h < 11) return 'Semangat pagi, siap kelola aktivitasmu hari ini?'
  if (h < 15) return 'Tetap produktif siang ini!'
  if (h < 19) return 'Sore yang baik, cek update aktivitasmu yuk.'
  return 'Malam ini, ada yang perlu dicatat?'
}

const todayStr = (lang) => new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
  weekday: 'long', day: 'numeric', month: 'long',
})

const EyeOpen = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOff = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const ArrowRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

const WarnIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

export default function Home({ session, onModule }) {
  const { lang, toggle: toggleLang, t } = useLang()
  const [assetTotal,  setAssetTotal]  = useState(null)
  const [showAssets,  setShowAssets]  = useState(() => localStorage.getItem('showAssets') !== 'false')
  const [lastService, setLastService] = useState(null)
  const [lastTrip,    setLastTrip]    = useState(null)
  const [tripCount,   setTripCount]   = useState(null)
  const [lastHike,    setLastHike]    = useState(null)
  const [hikeCount,   setHikeCount]   = useState(null)

  const uid    = session.user.id
  const name   = session.user.user_metadata?.full_name?.split(' ')[0] || 'Kamu'
  const avatar = session.user.user_metadata?.avatar_url

  const toggleAssets = () => {
    setShowAssets(prev => {
      localStorage.setItem('showAssets', !prev)
      return !prev
    })
  }

  useEffect(() => {
    const fetchAll = async () => {
      const [bibit, binance, fisik, kas, jht, svc, trip, tripCnt, hike, hikeCnt] = await Promise.all([
        supabase.from('bibit_assets').select('aktual').eq('user_id', uid),
        supabase.from('binance_assets').select('aktual').eq('user_id', uid),
        supabase.from('physical_assets').select('buy_price').eq('user_id', uid),
        supabase.from('liquid_assets').select('jumlah').eq('user_id', uid),
        supabase.from('jht_assets').select('jumlah').eq('user_id', uid).maybeSingle(),
        supabase.from('service_records')
          .select('service_date, service_type, shop')
          .eq('user_id', uid)
          .order('service_date', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('trips')
          .select('destination, end_date')
          .eq('user_id', uid).eq('status', 'done')
          .order('end_date', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('trips')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid).eq('status', 'done'),
        supabase.from('hikes')
          .select('mountain, start_date, elevation')
          .eq('user_id', uid)
          .order('start_date', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('hikes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid),
      ])

      const sum = (rows, key) => (rows.data || []).reduce((s, r) => s + Number(r[key] || 0), 0)
      setAssetTotal(
        sum(bibit, 'aktual') + sum(binance, 'aktual') +
        sum(fisik, 'buy_price') + sum(kas, 'jumlah') + Number(jht.data?.jumlah || 0)
      )
      setLastService(svc.data || null)
      setLastTrip(trip.data || null)
      setTripCount(tripCnt.count ?? null)
      setLastHike(hike.data || null)
      setHikeCount(hikeCnt.count ?? null)
    }
    fetchAll()
  }, [uid])

  const logout = () => supabase.auth.signOut()

  const getModuleStat = (mod) => {
    if (mod.id === 'asset') {
      return {
        label: t('homeStatTotalAset'),
        val: assetTotal === null ? '...' : (showAssets ? fmt(assetTotal) : '••••••'),
        extra: (
          <button
            className="asset-eye-btn"
            onClick={e => { e.stopPropagation(); toggleAssets() }}
            title={showAssets ? t('homeStatHide') : t('homeStatShow')}
          >
            {showAssets ? <EyeOpen /> : <EyeOff />}
          </button>
        ),
      }
    }

    if (mod.id === 'service') {
      if (!lastService) return { label: t('homeStatServisLast'), val: '—', sub: null, next: null }
      let svcLabel = lastService.service_type || '—'
      try {
        const items = JSON.parse(lastService.service_type)
        if (Array.isArray(items) && items.length)
          svcLabel = items.map(i => i.nama).filter(Boolean).join(', ')
      } catch {}
      const d = daysSince(lastService.service_date)
      const daysUntil = d !== null ? 90 - d : null
      const nextType = daysUntil === null ? 'ok'
        : daysUntil <= 0 ? 'due'
        : daysUntil <= 14 ? 'warn'
        : 'ok'
      const nextText = daysUntil === null ? null
        : daysUntil <= 0 ? `${t('homeOverdue')} ${Math.abs(daysUntil)} ${t('homeNextDays')}`
        : `${t('homeNextIn')} ${daysUntil} ${t('homeNextDays')}`
      return {
        label: t('homeStatServisLast'),
        val: svcLabel,
        sub: `${fmtDate(lastService.service_date, lang)} · ${relTime(lastService.service_date, lang)}`,
        next: nextText ? { text: nextText, type: nextType } : null,
      }
    }

    if (mod.id === 'itinerary') {
      return {
        label: t('homeStatPerjalanan'),
        val: tripCount === null ? '...' : `${tripCount} trip`,
        sub: lastTrip ? `${lang === 'en' ? 'Last' : 'Terakhir'}: ${lastTrip.destination}` : null,
      }
    }

    if (mod.id === 'wedding') {
      return {
        label: t('homeStatWpBudget'),
        val: t('homeStatWpDetail'),
        sub: t('homeStatWpSub'),
      }
    }

    if (mod.id === 'hiking') {
      return {
        label: t('homeStatTotalHike'),
        val: hikeCount === null ? '...' : `${hikeCount} ${lang === 'en' ? 'peaks' : 'gunung'}`,
        sub: lastHike
          ? (lastHike.elevation
            ? `${lastHike.mountain} · ${lastHike.elevation.toLocaleString('id-ID')} mdpl`
            : lastHike.mountain)
          : null,
      }
    }

    return null
  }

  return (
    <div className="home-wrap">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-brand-icon">◈</span>
          <span>MySpace</span>
        </div>
        <div className="topbar-right">
          {avatar && (
            <img src={avatar} className="avatar" alt="avatar" referrerPolicy="no-referrer" />
          )}
          <span className="topbar-name">{name}</span>
          <button className="btn-lang" onClick={toggleLang}>
            <span className={lang === 'id' ? 'lang-active' : ''}>ID</span>
            <span className="lang-sep">·</span>
            <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
          </button>
          <button className="btn-logout" onClick={logout}>Keluar</button>
        </div>
      </header>

      <main className="home-main">
        <div className="home-greeting">
          <div className="home-greeting-text">{getGreeting(lang)}, {name}!</div>
          <div className="home-greeting-meta">
            <div className="home-greeting-sub">{getSubtitle(lang)}</div>
            <div className="home-date">{todayStr(lang)}</div>
          </div>
        </div>

        {/* Home insight strip */}
        {(assetTotal !== null || hikeCount !== null || tripCount !== null) && (
          <div className="mod-insight-strip" style={{ marginBottom: '1.25rem' }}>
            {assetTotal > 0 && (
              <div className="mod-insight-chip mod-chip-positive">
                <span className="mod-chip-icon">📊</span>
                <span className="mod-chip-text">Total aset kamu hari ini: <strong>{fmt(assetTotal)}</strong></span>
              </div>
            )}
            {hikeCount > 0 && (
              <div className="mod-insight-chip mod-chip-info">
                <span className="mod-chip-icon">🏔</span>
                <span className="mod-chip-text">
                  {lang === 'en'
                    ? hikeCount >= 7
                      ? `${hikeCount} mountains climbed — 7 Summit of Java complete!`
                      : hikeCount >= 3
                      ? `${hikeCount} mountains climbed — ${7 - hikeCount} more for 7 Summit of Java!`
                      : `${hikeCount} mountains climbed. Keep exploring!`
                    : hikeCount >= 7
                      ? `${hikeCount} gunung didaki — kamu sudah complete 7 Summit of Java!`
                      : hikeCount >= 3
                      ? `${hikeCount} gunung didaki — ${7 - hikeCount} lagi untuk 7 Summit of Java!`
                      : `${hikeCount} gunung sudah kamu daki. Terus jelajahi!`}
                </span>
              </div>
            )}
            {tripCount > 0 && (
              <div className="mod-insight-chip mod-chip-info">
                <span className="mod-chip-icon">✈</span>
                <span className="mod-chip-text">
                  {lang === 'en'
                    ? `${tripCount} trips completed — true adventurer!`
                    : `${tripCount} perjalanan selesai tercatat — petualang sejati!`}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="module-grid">
          {MODULES.map(mod => {
            const stat = getModuleStat(mod)
            const cardClass = [
              'module-card',
              mod.hero    ? 'module-hero'      : '',
              mod.available ? 'module-available' : 'module-soon',
              mod.primary ? 'module-primary'   : 'module-secondary',
            ].filter(Boolean).join(' ')

            return (
              <div
                key={mod.id}
                className={cardClass}
                onClick={() => mod.available && onModule(mod.id)}
                style={{ '--mod-color': mod.color }}
              >
                <div className="module-card-accent" />

                {mod.hero ? (
                  /* ── Hero card: horizontal layout ── */
                  <div className="module-hero-body">
                    <div className="module-hero-info">
                      <div className="module-card-top">
                        <div className="module-icon-wrap">
                          <div className="module-icon" style={{ color: mod.color }}>{mod.icon}</div>
                        </div>
                        <span className="module-badge badge-active">
                          <span className="badge-dot" />{t('homeBadgeActive')}
                        </span>
                      </div>
                      <div className="module-title module-title-lg">{t(mod.titleKey)}</div>
                      <div className="module-desc">{t(mod.descKey)}</div>
                    </div>

                    <div className="module-hero-aside">
                      {stat && (
                        <div className="module-stat hero-stat">
                          <div className="module-stat-header">
                            <span className="module-stat-label">{stat.label}</span>
                            {stat.extra}
                          </div>
                          <span className="module-stat-val hero-val">{stat.val}</span>
                        </div>
                      )}
                      <button
                        className="module-cta-btn hero-cta"
                        onClick={e => { e.stopPropagation(); onModule(mod.id) }}
                      >
                        {t('homeCtaOpen')} <ArrowRight />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Secondary cards: vertical layout ── */
                  <>
                    <div className="module-card-top">
                      <div className="module-icon-wrap">
                        <div className="module-icon" style={{ color: mod.color }}>{mod.icon}</div>
                      </div>
                      <span className={`module-badge ${mod.available ? 'badge-active' : 'badge-soon'}`}>
                        <span className="badge-dot" />
                        {mod.available ? t('homeBadgeActive') : t('homeBadgeSoon')}
                      </span>
                    </div>

                    <div className="module-title">{t(mod.titleKey)}</div>
                    <div className="module-desc">{t(mod.descKey)}</div>

                    {stat && (
                      <div className="module-stat">
                        <div className="module-stat-header">
                          <span className="module-stat-label">{stat.label}</span>
                          {stat.extra}
                        </div>
                        <span className="module-stat-val">{stat.val}</span>
                        {stat.sub && <div className="module-stat-sub">{stat.sub}</div>}
                        {stat.next && (
                          <div className={`svc-next svc-next-${stat.next.type}`}>
                            {stat.next.type === 'ok' ? <CheckIcon /> : <WarnIcon />}
                            {stat.next.text}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      className="module-cta-btn"
                      onClick={e => { e.stopPropagation(); mod.available && onModule(mod.id) }}
                      disabled={!mod.available}
                    >
                      {mod.available ? t('homeCtaView') : t('homeCtaSoon')}
                      {mod.available && <ArrowRight />}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
