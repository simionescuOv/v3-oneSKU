import { useRef, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'

// Emite scroll events în sus spre BottomBar via callback prop.
// NU atașăm scroll pe window — per spec §8.2.

export default function MainContent({ onScrollDown, onScrollUp }) {
  const ref = useRef(null)
  const lastY = useRef(0)

  const handleScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const current = el.scrollTop
    if (current > lastY.current + 4) {
      onScrollDown?.()
    } else if (current < lastY.current - 4) {
      onScrollUp?.()
    }
    lastY.current = current
  }, [onScrollDown, onScrollUp])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <main ref={ref} className="flex-1 overflow-y-auto">
      <Outlet />
    </main>
  )
}
