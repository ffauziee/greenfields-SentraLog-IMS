import { memo } from 'react'

const Pagination = memo(function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex justify-center gap-2 mt-4">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
        className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
      <span className="px-3 py-1">{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
        className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
    </div>
  )
})

export default Pagination
