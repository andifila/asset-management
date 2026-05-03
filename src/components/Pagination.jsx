// src/components/Pagination.jsx
export const PAGE_SIZE = 10

export function paginate(arr, page) {
  return arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

export default function Pagination({ total, page, onChange }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) return null
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      <span className="page-info">Hal {page} / {pages}</span>
      <button className="page-btn" disabled={page === pages} onClick={() => onChange(page + 1)}>Next ›</button>
    </div>
  )
}
