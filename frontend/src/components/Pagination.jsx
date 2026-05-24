import { memo, useMemo } from 'react'
import { cn } from '../lib/cn'

const Pagination = memo(function Pagination({ page, totalPages, onPageChange }) {
  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const res = [1]
    const start = Math.max(2, page - 2)
    const end = Math.min(totalPages - 1, page + 2)
    if (start > 2) res.push('...')
    for (let i = start; i <= end; i++) res.push(i)
    if (end < totalPages - 1) res.push('...')
    res.push(totalPages)
    return res
  }, [page, totalPages])

  if (totalPages <= 1) return null
  return (
    <div className="flex justify-center items-center gap-1 mt-4">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
        className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Prev</button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
        ) : (
          <button key={p} onClick={() => onPageChange(p)}
            className={cn(
              'px-3 py-1 border rounded text-sm transition-colors',
              p === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'
            )}>{p}</button>
        )
      )}
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
        className="px-3 py-1 border rounded disabled:opacity-50 text-sm">Next</button>
    </div>
  )
})

export default Pagination
