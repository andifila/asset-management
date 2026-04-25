// src/components/ConfirmModal.jsx
export default function ConfirmModal({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">×</div>
        <div className="confirm-title">Hapus item ini?</div>
        {name && <div className="confirm-name">"{name}"</div>}
        <div className="confirm-sub">Tindakan ini tidak dapat dibatalkan.</div>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={loading}>Batal</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}
