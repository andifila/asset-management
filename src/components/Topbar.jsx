import { Settings, Bell } from 'lucide-react'
import { useLang } from '../lib/LangContext'

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

const todayStr = (lang) => new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
  weekday: 'short', day: 'numeric', month: 'short',
})

export default function Topbar({ session, title }) {
  const { lang, toggle } = useLang()
  const name   = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'Kamu'
  const avatar = session?.user?.user_metadata?.avatar_url

  return (
    <header className="new-topbar">
      <div className="new-topbar-left">
        {title ? (
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
            {title}
          </span>
        ) : (
          <span className="new-topbar-greeting">
            {getGreeting(lang)}, {name} 👋
          </span>
        )}
      </div>

      <div className="new-topbar-right">
        <span style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{todayStr(lang)}</span>

        <button className="btn-lang" onClick={toggle}>
          <span className={lang === 'id' ? 'lang-active' : ''}>ID</span>
          <span className="lang-sep">·</span>
          <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
        </button>

        <button className="btn-icon" title="Notifications" style={{ position: 'relative' }}>
          <Bell size={14} />
        </button>

        <button className="btn-icon" title="Settings">
          <Settings size={14} />
        </button>

        {avatar && (
          <img
            src={avatar}
            referrerPolicy="no-referrer"
            alt="avatar"
            style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border2)', cursor: 'pointer' }}
          />
        )}
      </div>
    </header>
  )
}
