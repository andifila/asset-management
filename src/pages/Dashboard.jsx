// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Summary from '../components/Summary'
import BibitTable from '../components/BibitTable'
import BinanceTable from '../components/BinanceTable'
import PhysicalTable from '../components/PhysicalTable'
import LiquidTable from '../components/LiquidTable'
import Toast from '../components/Toast'
import { useLang } from '../lib/LangContext'


const TAB_ICONS = { summary: '◈', bibit: '↗', binance: '◆', fisik: '⬡', kas: '◎', custom: '○' }

const DEFAULT_TABS = [
  { label: 'Dashboard',   type: 'summary', position: 0 },
  { label: 'BIBIT',       type: 'bibit',   position: 1 },
  { label: 'Binance',     type: 'binance', position: 2 },
  { label: 'Aset Fisik',  type: 'fisik',   position: 3 },
  { label: 'Aset Liquid', type: 'kas',     position: 4 },
]

export default function Dashboard({ session }) {
  const [tabs, setTabs]           = useState([])
  const [tabsLoaded, setTabsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState(null)

  const [editingTabId, setEditingTabId] = useState(null)
  const [renameValue, setRenameValue]   = useState('')

  const [tabMenuId, setTabMenuId] = useState(null)
  const [menuPos,   setMenuPos]   = useState(null)

  const [data, setData]     = useState({ bibit: [], binance: [], fisik: [], kas: [], jht: 0, target: 200000000 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast]   = useState(null)
  const toastKey = useRef(0)

  const showToast = useCallback((message, type = 'success') => {
    toastKey.current += 1
    setToast({ message, type, key: toastKey.current })
  }, [])

  const uid = session.user.id
  const { lang, toggle: toggleLang, t } = useLang()

  const fetchTabs = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('tab_configs').select('*').eq('user_id', uid).order('position')

    if (error) { console.error('fetchTabs:', error); setTabsLoaded(true); return }

    if (rows && rows.length > 0) {
      const old = rows.find(t => t.type === 'summary' && t.label === 'Ringkasan')
      const finalRows = old ? rows.map(t => t.id === old.id ? { ...t, label: 'Dashboard' } : t) : rows
      if (old) supabase.from('tab_configs').update({ label: 'Dashboard' }).eq('id', old.id).eq('user_id', uid)
      setTabs(finalRows)
      setActiveTab(prev => finalRows.find(t => t.id === prev) ? prev : finalRows[0].id)
    } else {
      const { data: seeded, error: seedErr } = await supabase
        .from('tab_configs')
        .insert(DEFAULT_TABS.map(t => ({ ...t, user_id: uid })))
        .select()
      if (seedErr) { console.error('seed tabs:', seedErr); setTabsLoaded(true); return }
      setTabs(seeded)
      setActiveTab(seeded[0]?.id || null)
    }
    setTabsLoaded(true)
  }, [uid])

  const fetchAll = useCallback(async () => {
    const [bibit, binance, fisik, kas, jht, goal] = await Promise.all([
      supabase.from('bibit_assets').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('binance_assets').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('physical_assets').select('*').eq('user_id', uid).order('buy_date', { ascending: false }),
      supabase.from('liquid_assets').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('jht_assets').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('financial_goals').select('*').eq('user_id', uid).maybeSingle(),
    ])
    setData({
      bibit:   bibit.data   || [],
      binance: binance.data || [],
      fisik:   fisik.data   || [],
      kas:     kas.data     || [],
      jht:     jht.data?.jumlah || 0,
      target:  goal.data?.target_amount || 200000000,
    })
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchTabs(); fetchAll() }, [fetchTabs, fetchAll])

  useEffect(() => {
    if (!tabMenuId) return
    const handler = (e) => {
      if (!e.target.closest('.tabnav-menu-btn') && !e.target.closest('.tabnav-menu-dropdown')) {
        setTabMenuId(null); setMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tabMenuId])

  const closeMenu = () => { setTabMenuId(null); setMenuPos(null) }

  const startRename = (id, label) => {
    setEditingTabId(id); setRenameValue(label); closeMenu()
  }

  const commitRename = async (id) => {
    const label = renameValue.trim()
    setEditingTabId(null)
    if (!label) return
    setTabs(prev => prev.map(t => t.id === id ? { ...t, label } : t))
    const { error } = await supabase.from('tab_configs').update({ label }).eq('id', id).eq('user_id', uid)
    if (error) console.error('rename tab:', error)
  }

  const moveTab = async (tab, dir) => {
    const idx = tabs.findIndex(t => t.id === tab.id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= tabs.length) return
    const posA = tabs[idx].position
    const posB = tabs[newIdx].position
    const next = [...tabs]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    setTabs(next)
    closeMenu()
    await Promise.all([
      supabase.from('tab_configs').update({ position: posB }).eq('id', tabs[idx].id).eq('user_id', uid),
      supabase.from('tab_configs').update({ position: posA }).eq('id', tabs[newIdx].id).eq('user_id', uid),
    ])
  }

  const logout = async () => supabase.auth.signOut()
  const avatar = session.user.user_metadata?.avatar_url
  const name   = session.user.user_metadata?.full_name || session.user.email

  const renderContent = () => {
    const tab = tabs.find(t => t.id === activeTab)
    if (!tab) return null
    switch (tab.type) {
      case 'summary': return <Summary data={data} uid={uid} onRefresh={fetchAll} showToast={showToast} />
      case 'bibit':   return <BibitTable data={data.bibit} uid={uid} onRefresh={fetchAll} showToast={showToast} />
      case 'binance': return <BinanceTable data={data.binance} uid={uid} onRefresh={fetchAll} showToast={showToast} />
      case 'fisik':   return <PhysicalTable data={data.fisik} uid={uid} onRefresh={fetchAll} showToast={showToast} />
      case 'kas':     return <LiquidTable data={data.kas} jht={data.jht} uid={uid} onRefresh={fetchAll} showToast={showToast} />
      default: return (
        <div className="custom-tab-empty">
          <div className="custom-tab-icon">◈</div>
          <p>Tab <strong>{tab.label}</strong> kosong.</p>
        </div>
      )
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">◈ <span>Asset Tracker</span></div>
        <div className="topbar-right">
          {avatar && <img src={avatar} className="avatar" alt="avatar" referrerPolicy="no-referrer" />}
          <span className="topbar-name">{name}</span>
          <button className="btn-lang" onClick={toggleLang}>
            <span className={lang === 'id' ? 'lang-active' : ''}>ID</span>
            <span className="lang-sep">·</span>
            <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
          </button>
          <button className="btn-logout" onClick={logout}>{t('logout')}</button>
        </div>
      </header>

      <nav className="tabnav">
        <div className="tabnav-tabs">
          {tabs.map(t => (
            <div key={t.id} className={`tabnav-item ${activeTab === t.id ? 'active' : ''}`}>
              {editingTabId === t.id ? (
                <input
                  className="tabnav-rename"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(t.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(t.id)
                    if (e.key === 'Escape') setEditingTabId(null)
                  }}
                  autoFocus
                />
              ) : (
                <button
                  className="tabnav-btn"
                  onClick={() => setActiveTab(t.id)}
                  onDoubleClick={() => startRename(t.id, t.label)}
                  title="Klik untuk buka · Klik dua kali untuk rename"
                >
                  <span className="tabnav-icon">{TAB_ICONS[t.type] || '○'}</span>
                  {t.label}
                </button>
              )}

              {t.type !== 'summary' && <div className="tabnav-menu-wrap">
                <button
                  className={`tabnav-menu-btn ${tabMenuId === t.id ? 'open' : ''}`}
                  onClick={e => {
                    e.stopPropagation()
                    if (tabMenuId === t.id) { closeMenu(); return }
                    const rect = e.currentTarget.getBoundingClientRect()
                    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                    setTabMenuId(t.id)
                  }}
                  title="Opsi tab"
                >⋮</button>
              </div>}
            </div>
          ))}
        </div>

        {/* Dropdown di luar overflow container */}
        {tabMenuId && menuPos && (() => {
          const tab = tabs.find(t => t.id === tabMenuId)
          if (!tab) return null
          const idx = tabs.findIndex(t => t.id === tabMenuId)
          return (
            <div className="tabnav-menu-dropdown" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}>
              {tab.type !== 'summary' && idx > 0 && (
                <button className="tabnav-menu-item" onClick={() => moveTab(tab, -1)}>← Pindah Kiri</button>
              )}
              {tab.type !== 'summary' && idx < tabs.length - 1 && (
                <button className="tabnav-menu-item" onClick={() => moveTab(tab, 1)}>→ Pindah Kanan</button>
              )}
              {tab.type !== 'summary' && (idx > 0 || idx < tabs.length - 1) && <div className="tabnav-menu-divider" />}
              <button className="tabnav-menu-item" onClick={() => startRename(tab.id, tab.label)}>✏ Rename</button>
            </div>
          )
        })()}
      </nav>

      <main className="main-content">
        {loading || !tabsLoaded
          ? <div className="loading-state">{t('loading')}</div>
          : renderContent()
        }
      </main>

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  )
}
