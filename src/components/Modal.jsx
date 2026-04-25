// src/components/Modal.jsx
import { useLang } from '../lib/LangContext'

export default function Modal({ title, onClose, onSave, saving, error, children }) {
  const { t } = useLang()
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children}
          {error && <div className="modal-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-save" onClick={onSave} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
