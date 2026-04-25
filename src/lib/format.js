// src/lib/format.js
export const fmt = (v) =>
  'Rp' + Math.round(Number(v) || 0).toLocaleString('id-ID')

export const fmtPnl = (v) => {
  const n = Math.round(Number(v) || 0)
  return (n >= 0 ? '+' : '') + fmt(n)
}

export const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const calcAge = (d) => {
  if (!d) return '-'
  const now = new Date(), then = new Date(d)
  let y = now.getFullYear() - then.getFullYear()
  let m = now.getMonth() - then.getMonth()
  if (m < 0) { y--; m += 12 }
  return `${y} Thn ${m} Bln`
}

export const calcMonths = (d) => {
  if (!d) return null
  const now = new Date(), then = new Date(d)
  const m = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth())
  return Math.max(m, 1)
}
