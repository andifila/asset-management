// src/lib/LangContext.jsx
import { createContext, useContext, useState } from 'react'
import { translations } from './lang'

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'id')

  const toggle = () => {
    const next = lang === 'id' ? 'en' : 'id'
    setLang(next)
    localStorage.setItem('lang', next)
  }

  const t = (key) => translations[lang]?.[key] ?? translations.id[key] ?? key

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
