// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Summary from '../components/Summary'
import BibitTable from '../components/BibitTable'
import BinanceTable from '../components/BinanceTable'
import PhysicalTable from '../components/PhysicalTable'
import LiquidTable from '../components/LiquidTable'

const TABS = [
  { id: 'summary', label: 'Ringkasan' },
  { id: 'bibit', label: 'BIBIT' },
  { id: 'binance', label: 'Binance' },
  { id: 'fisik', label: 'Aset Fisik' },
  { id: 'kas', label: 'Kas & JHT' },
]

export default function Dashboard({ session }) {
  const [tab, setTab] = useState('summary')
  const [data, setData] = useState({ bibit: [], binance: [], fisik: [], kas: [], jht: 0, target: 200000000 })
  const [loading, setLoading] = useState(true)
  const uid = session.user.id

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
      bibit: bibit.data || [],
      binance: binance.data || [],
      fisik: fisik.data || [],
      kas: kas.data || [],
      jht: jht.data?.jumlah || 0,
      target: goal.data?.target_amount || 200000000,
    })
    setLoading(false)
  }, [uid])

  useEffect(() => { fetchAll() }, [fetchAll])

  const logout = async () => await supabase.auth.signOut()

  const avatar = session.user.user_metadata?.avatar_url
  const name = session.user.user_metadata?.full_name || session.user.email

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
        {TABS.map(t => (
          <button key={t.id} className={`tabnav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {loading ? (
          <div className="loading-state">Memuat data...</div>
        ) : (
          <>
            {tab === 'summary'  && <Summary  data={data} uid={uid} onRefresh={fetchAll} />}
            {tab === 'bibit'    && <BibitTable   data={data.bibit}   uid={uid} onRefresh={fetchAll} />}
            {tab === 'binance'  && <BinanceTable data={data.binance} uid={uid} onRefresh={fetchAll} />}
            {tab === 'fisik'    && <PhysicalTable data={data.fisik}  uid={uid} onRefresh={fetchAll} />}
            {tab === 'kas'      && <LiquidTable  data={data.kas} jht={data.jht} uid={uid} onRefresh={fetchAll} />}
          </>
        )}
      </main>
    </div>
  )
}
