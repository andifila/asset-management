// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Summary from '../components/Summary'
import BibitTable from '../components/BibitTable'
import BinanceTable from '../components/BinanceTable'
import PhysicalTable from '../components/PhysicalTable'
import LiquidTable from '../components/LiquidTable'
import ManageTabsModal from '../components/ManageTabsModal'

const DEFAULT_TABS = [
  { label: 'Ringkasan', type: 'summary', position: 0 },
  { label: 'BIBIT',     type: 'bibit',   position: 1 },
  { label: 'Binance',   type: 'binance', position: 2 },
  { label: 'Aset Fisik',type: 'fisik',   position: 3 },
  { label: 'Kas & JHT', type: 'kas',     position: 4 },
]

export default function Dashboard({ session }) {
  const [tabs, setTabs] = useState([])
  const [tabsLoaded, setTabsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState(null)
  const [showManageTabs, setShowManageTabs] = useState(false)
  const [data, setData] = useState({ bibit: [], binance: [], fisik: [], kas: [], jht: 0, target: 200000000 })
  const [loading, setLoading] = useState(true)
  const uid = session.user.id

  const fetchTabs = useCallback(async () => {
    const { data: tabData } = await supabase
      .from('tab_configs')
      .select('*')
      .eq('user_id', uid)
      .order('position')

    if (tabData && tabData.length > 0) {
      setTabs(tabData)
      setActiveTab(prev => tabData.find(t => t.id === prev) ? prev : tabData[0].id)
    } else {
      const toInsert = DEFAULT_TABS.map(t => ({ ...t, user_id: uid }))
      const { data: inserted } = await supabase.from('tab_configs').insert(toInsert).select()
      const seeded = inserted || []
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
      bibit:  bibit.data  || [],
      binance:binance.data|| [],
      fisik:  fisik.data  || [],
      kas:    kas.data    || [],
      jht:    jht.data?.jumlah || 0,
      target: goal.data?.target_amount || 200000000,
    })
    setLoading(false)
  }, [uid])

  useEffect(() => {
    fetchTabs()
    fetchAll()
  }, [fetchTabs, fetchAll])

  const handleTabsSaved = (newTabs) => {
    setTabs(newTabs)
    setActiveTab(prev => {
      const still = newTabs.find(t => t.id === prev)
      return still ? prev : (newTabs[0]?.id || null)
    })
    setShowManageTabs(false)
  }

  const logout = async () => await supabase.auth.signOut()
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
          <p>Tab <strong>{tab.label}</strong> belum memiliki konten.</p>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>Tipe: {tab.type}</p>
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
          <button className="btn-manage-tabs" onClick={() => setShowManageTabs(true)}>Kelola Tab</button>
          <button className="btn-logout" onClick={logout}>Keluar</button>
        </div>
      </header>

      <nav className="tabnav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tabnav-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {loading || !tabsLoaded ? (
          <div className="loading-state">Memuat data...</div>
        ) : renderContent()}
      </main>

      {showManageTabs && (
        <ManageTabsModal
          tabs={tabs}
          uid={uid}
          onClose={() => setShowManageTabs(false)}
          onSaved={handleTabsSaved}
        />
      )}
    </div>
  )
}
