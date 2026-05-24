import { useState } from 'react'

export function useToast(defaultType = 'success') {
  const [toast, setToast] = useState(null)
  const showToast = (message, type = defaultType) => setToast({ message, type })
  const closeToast = () => setToast(null)
  return { toast, showToast, closeToast }
}
