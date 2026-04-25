// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Summary from '../components/Summary'
import BibitTable from '../components/BibitTable'
import BinanceTable from '../components/BinanceTable'
import PhysicalTable from '../components/PhysicalTable'
import LiquidTable from '../components/LiquidTable'

const LOCKED_TYPES = new Set(['summary', 'fisik', 'kas'])

const DEFAULT_TABS = [
  { label: 'Ringkasan',   type: 'summary', position: 0 },
  { label: 'BIBIT',       type: 'bibit',   position: 1 },
  { label: 'Binance',     type: 'binance', position: 2 },
  { label: 'Aset Fisik',  type: 'fisik',   position: 3 },
  { label: 'Aset Liquid', type: 'kas',     position: 4 },
]

const TAB_TYPES = [
  { value: 'bibit',   label: 'BIBIT (Reksa Dana)' },
  { value: 'binance', label: 'Binance (Crypto)' },
  { value: 'fisik',   label: 'Aset Fisik' },
  { value: 'kas',     label: 'Aset Liquid' },
  { value: 'summary', label: 'Ringkasan' },
  { value: 'custom',  label: 'Custom (Kosong)' },
]

export default function Dashboard({ session }) {
  const [tabs, setTabs] = useState([])
  const [tabsLoaded, setTabsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState(null)

  const [editingTabId, setEditingTabId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const [showAddTab, setShowAddTab] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('bibit')
  const [addingTab, setAddingTab] = useState(false)

  const [tabMenuId, setTabMenuId] = useState(null)

  const [data, setData] = useState({ bibit: [], binance: [], fisik: [], kas: [], jht: 0, target: 200000000 })
  const [loading, setLoading] = useState(true)

  const uid = session.user.id
  const addDropdownRef = useRef(null)

  const fetchTabs = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('tab_configs')
      .select('*')
      .eq('user_id', uid)
      .order('position')

    if (error) { console.error('fetchTabs:', error); setTabsLoaded(true); return }

    if (rows && rows.length > 0) {
      setTabs(rows)
      setActiveTab(prev => rows.find(t => t.id === prev) ? prev : rows[0].id)
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

  // Close add dropdown on outside click
  useEffect(() => {
    if (!showAddTab) return
    const handler = (e) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target)) {
        setShowAddTab(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAddTab])

  // Close tab menu on outside click
  useEffect(() => {
    if (!tabMenuId) return
    const handler = (e) => {
      if (!e.target.closest('.tabnav-menu-wrap')) setTabMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tabMenuId])

  const startRename = (id, label) => {
    setEditingTabId(id)
    setRenameValue(label)
    setShowAddTab(false)
    setTabMenuId(null)
  }

  const commitRename = async (id) => {
    const label = renameValue.trim()
    setEditingTabId(null)
    if (!label) return
    setTabs(prev => prev.map(t => t.id === id ? { ...t, label } : t))
    const { error } = await supabase
      .from('tab_configs').update({ label }).eq('id', id).eq('user_id', uid)
    if (error) console.error('rename tab:', error)
  }

  const deleteTab = async (tab) => {
    if (LOCKED_TYPES.has(tab.type)) return
    if (!confirm(`Hapus tab "${tab.label}"?`)) return
    const next = tabs.filter(t => t.id !== tab.id)
    setTabs(next)
    if (activeTab === tab.id) setActiveTab(next[0]?.id || null)
    const { error } = await supabase
      .from('tab_configs').delete().eq('id', tab.id).eq('user_id', uid)
    if (error) { console.error('delete tab:', error); fetchTabs() }
  }

  const addTab = async () => {
    const label = newLabel.trim()
    if (!label || addingTab) return
    setAddingTab(true)
    const { data: newTab, error } = await supabase
      .from('tab_configs')
      .insert({ user_id: uid, label, type: newType, position: tabs.length })
      .select()
      .single()
    if (error) { console.error('add tab:', error); setAddingTab(false); return }
    setTabs(prev => [...prev, newTab])
    setActiveTab(newTab.id)
    setNewLabel('')
    setNewType('bibit')
    setShowAddTab(false)
    setAddingTab(false)
  }

  const logout = async () => supabase.auth.signOut()
  const avatar = session.user.user_metadata?.avatar_url
  const name = session.user.user_metadata?.full_name || session.user.email

  const renderContent = () => {
    const tab = tabs.find(t => t.id === activeTab)
    if (!tab) return null
    switch (tab.type) {
      case 'summary': return <Summary data={data} uid={uid} onRefresh={fetchAll} />
      case 'bibit':   return <BibitTable data={data.bibit} uid={uid} onRefresh={fetchAll} />
      case 'binance': return <BinanceTable data={data.binance} uid={uid} onRefresh={fetchAll} />
      case 'fisik':   return <PhysicalTable data={data.fisik} uid={uid} onRefresh={fetchAll} />
      case 'kas':     return <LiquidTable data={data.kas} jht={data.jht} uid={uid} onRefresh={fetchAll} />
      default: return (
        <div className="custom-tab-empty">
          <div className="custom-tab-icon">◈</div>
          <p>Tab <strong>{tab.label}</strong> kosong.</p>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
            Konten custom akan tersedia di versi berikutnya.
          </p>
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
          <button className="btn-logout" onClick={logout}>Keluar</button>
        </div>
      </header>

      <nav className="tabnav">
        <div className="tabnav-tabs">
          {tabs.map(t => {
            const locked = LOCKED_TYPES.has(t.type)
            return (
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
                    {t.label}
                  </button>
                )}

                <div className="tabnav-menu-wrap">
                  <button
                    className={`tabnav-menu-btn ${tabMenuId === t.id ? 'open' : ''}`}
                    onClick={e => { e.stopPropagation(); setTabMenuId(v => v === t.id ? null : t.id) }}
                    title="Opsi tab"
                  >⋮</button>
                  {tabMenuId === t.id && (
                    <div className="tabnav-menu-dropdown">
                      <button className="tabnav-menu-item" onClick={() => startRename(t.id, t.label)}>
                        ✏ Rename
                      </button>
                      {!locked && (
                        <button className="tabnav-menu-item del" onClick={() => { setTabMenuId(null); deleteTab(t) }}>
                          × Hapus Tab
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="tabnav-add-wrap" ref={addDropdownRef}>
          <button
            className={`tabnav-add-btn ${showAddTab ? 'open' : ''}`}
            onClick={() => { setShowAddTab(v => !v); setNewLabel(''); setNewType('bibit') }}
            title="Tambah tab baru"
          >+</button>

          {showAddTab && (
            <div className="tabnav-dropdown">
              <p className="tabnav-dropdown-title">Tab Baru</p>
              <input
                className="tabnav-dropdown-input"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Nama tab..."
                onKeyDown={e => e.key === 'Enter' && addTab()}
                autoFocus
              />
              <select
                className="tabnav-dropdown-select"
                value={newType}
                onChange={e => setNewType(e.target.value)}
              >
                {TAB_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                className="tabnav-dropdown-create"
                onClick={addTab}
                disabled={!newLabel.trim() || addingTab}
              >
                {addingTab ? 'Membuat...' : 'Buat Tab'}
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="main-content">
        {loading || !tabsLoaded
          ? <div className="loading-state">Memuat data...</div>
          : renderContent()
        }
      </main>
    </div>
  )
}
