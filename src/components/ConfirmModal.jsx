// src/components/ConfirmModal.jsx
import { useLang } from '../lib/LangContext'

export default function ConfirmModal({ name, onConfirm, onCancel, loading }) {
  const { t } = useLang()
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">×</div>
        <div className="confirm-title">{t('confirmDeleteTitle')}</div>
        {name && <div className="confirm-name">"{name}"</div>}
        <div className="confirm-sub">{t('confirmDeleteSub')}</div>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={loading}>{t('cancel')}</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? t('deleting') : t('delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
