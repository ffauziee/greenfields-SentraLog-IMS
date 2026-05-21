import { useEffect } from 'react'
import { cn } from '../lib/cn'

/**
 * Auto-dismissing toast notification.
 * Props:
 *   message  — text to display
 *   type     — 'success' | 'error' | 'info' (defaults to info)
 *   onClose  — called after 3s or when user clicks ×
 */
export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }

  return (
    <div className={cn(
      'fixed top-4 left-1/2 -translate-x-1/2 z-50',
      'text-white px-6 py-3 rounded-lg shadow-lg',
      'flex items-center gap-3',
      colors[type] || colors.info,
    )}>
      <span>{message}</span>
      <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
    </div>
  )
}
