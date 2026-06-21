import { useCallback, useRef } from 'react'

export function useLongPress(onLongPress, { delay = 500 } = {}) {
  const timer = useRef(null)
  const fired = useRef(false)

  const start = useCallback((e) => {
    fired.current = false
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress(e)
    }, delay)
  }, [onLongPress, delay])

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  // Returns true if long-press fired, so tap handler can bail
  const didFire = useCallback(() => fired.current, [])

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e) => e.preventDefault(),
    didFire,
  }
}
