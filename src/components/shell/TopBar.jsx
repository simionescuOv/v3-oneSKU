import { useLocation } from 'react-router-dom'

export default function TopBar() {
  const { pathname } = useLocation()

  if (pathname !== '/') return null

  return (
    <header className="flex-none flex items-center px-4 h-14 bg-zinc-900 border-b border-zinc-800 gap-3">
      <span className="text-base font-semibold text-zinc-100 tracking-wide truncate">
        oneSku
      </span>
    </header>
  )
}
