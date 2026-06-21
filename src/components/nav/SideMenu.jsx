import { useNavigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { NAV_ITEMS } from '../../lib/navItems'

export default function SideMenu() {
  const open = useAppStore((s) => s.sideMenuOpen)
  const close = useAppStore((s) => s.closeSideMenu)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleNav = (path) => {
    navigate(path)
    close()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={close}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800">
          <span className="text-base font-semibold text-zinc-100">oneSku</span>
          <button
            onClick={close}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, Icon }) => {
            const active = pathname === path
            return (
              <button
                key={path}
                onClick={() => handleNav(path)}
                className={[
                  'w-full flex items-center gap-4 px-5 py-3.5 text-sm font-medium',
                  'transition-colors',
                  active
                    ? 'text-zinc-100 bg-zinc-800'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
                ].join(' ')}
              >
                <Icon size={20} />
                {label}
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
