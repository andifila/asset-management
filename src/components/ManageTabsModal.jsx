// src/components/ManageTabsModal.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TAB_TYPES = [
  { value: 'summary', label: 'Ringkasan' },
  { value: 'bibit',   label: 'BIBIT (Reksa Dana)' },
  { value: 'binance', label: 'Binance (Crypto)' },
  { value: 'fisik',   label: 'Aset Fisik' },
  { value: 'kas',     label: 'Kas & JHT' },
  { value: 'custom',  label: 'Custom (Kosong)' },
]

export default function ManageTabsModal({ tabs, uid, onClose, onSaved }) {
  const [localTabs, setLocalTabs] = useState(tabs.map(t => ({ ...t })))
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('custom')
  const [showAdd, setShowAdd] = useState(false)

  const moveUp = (idx) => {
    if (idx === 0) return
    const arr = [...localTabs]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    setLocalTabs(arr)
  }

  const moveDown = (idx) => {
    if (idx === localTabs.length - 1) return
    const arr = [...localTabs]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    setLocalTabs(arr)
  }

  const renameTab = (id, label) => {
    setLocalTabs(prev => prev.map(t => t.id === id ? { ...t, label } : t))
  }

  const deleteTab = (id) => {
    if (localTabs.length <= 1) return
    setLocalTabs(prev => prev.filter(t => t.id !== id))
  }

  const addTab = () => {
    if (!newLabel.trim()) return
    const tempId = `new_${Date.now()}`
    setLocalTabs(prev => [...prev, { id: tempId, label: newLabel.trim(), type: newType, isNew: true }])
    setNewLabel('')
    setNewType('custom')
    setShowAdd(false)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('tab_configs').delete().eq('user_id', uid)
    const toInsert = localTabs.map((t, i) => ({
      user_id: uid,
      label: t.label,
      type: t.type,
      position: i,
    }))
    const { data } = await supabase.from('tab_configs').insert(toInsert).select()
    setSaving(false)
    onSaved(data || [])
  }

  const typeLabel = (type) => TAB_TYPES.find(t => t.value === type)?.label || type

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box manage-tabs-box">
        <div className="modal-header">
          <h3 className="modal-title">Kelola Tab</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="manage-tabs-hint">Seret urutan, rename, atau tambah tab baru.</p>

          <div className="tabs-list">
            {localTabs.map((tab, idx) => (
              <div key={tab.id} className="tab-item">
                <div className="tab-item-order">
                  <button className="btn-icon" onClick={() => moveUp(idx)} disabled={idx === 0} title="Naik">↑</button>
                  <button className="btn-icon" onClick={() => moveDown(idx)} disabled={idx === localTabs.length - 1} title="Turun">↓</button>
                </div>

                <div className="tab-item-label">
                  {editingId === tab.id ? (
                    <input
                      className="tab-rename-input"
                      value={tab.label}
                      onChange={e => renameTab(tab.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingId(null) }}
                      autoFocus
                    />
                  ) : (
                    <span className="tab-item-name" onDoubleClick={() => setEditingId(tab.id)}>{tab.label}</span>
                  )}
                  <span className="tab-type-badge">{typeLabel(tab.type)}</span>
                </div>

                <div className="tab-item-actions">
                  <button className="btn-icon" onClick={() => setEditingId(tab.id)} title="Rename">✏</button>
                  <button
                    className="btn-icon del"
                    onClick={() => deleteTab(tab.id)}
                    title="Hapus"
                    disabled={localTabs.length <= 1}
                  >×</button>
                </div>
              </div>
            ))}
          </div>

          {showAdd ? (
            <div className="add-tab-form">
              <div className="field-row">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Label Tab</label>
                  <input
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    placeholder="Nama tab baru"
                    onKeyDown={e => e.key === 'Enter' && addTab()}
                    autoFocus
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Tipe</label>
                  <select value={newType} onChange={e => setNewType(e.target.value)}>
                    {TAB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="add-tab-actions">
                <button className="btn-add" onClick={addTab}>Tambah</button>
                <button className="btn-xs" onClick={() => { setShowAdd(false); setNewLabel(''); setNewType('custom') }}>Batal</button>
              </div>
            </div>
          ) : (
            <button className="btn-add add-tab-btn" onClick={() => setShowAdd(true)}>+ Tambah Tab Baru</button>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={save} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
