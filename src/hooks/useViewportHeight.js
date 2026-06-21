import { useState, useEffect } from 'react'

export function useViewportHeight() {
  const [metrics, setMetrics] = useState(() => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop ?? 0,
  }))

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setMetrics({ height: vv.height, offsetTop: vv.offsetTop })
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return metrics
}
