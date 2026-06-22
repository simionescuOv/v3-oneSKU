import { Menu, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { NAV_ITEMS } from '../../lib/navItems'

export default function BottomBar({ hidden }) {
  const toggleSideMenu = useAppStore((s) => s.toggleSideMenu)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const searchPlaceholder = useAppStore((s) => s.searchPlaceholder)
  const openCatalogMenu = useAppStore((s) => s.openCatalogMenu)
  const bottomBarHidden = useAppStore((s) => s.bottomBarHidden)

  const { pathname } = useLocation()
  const isCatalog = pathname === '/catalog'
  const MenuIcon = NAV_ITEMS.find((item) => item.path === pathname)?.Icon ?? Menu

  const handleMenuPress = () => {
    if (isCatalog) openCatalogMenu()
    else toggleSideMenu()
  }

  return (
    <footer
      className={[
        'flex-none flex items-center gap-3 px-4 h-16',
        'bg-zinc-900 border-t border-zinc-800',
        'transition-transform duration-300 ease-in-out',
        hidden || bottomBarHidden ? 'translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      <div className="flex-1 flex items-center gap-2 bg-zinc-800 rounded-xl px-3 h-10">
        <Search size={16} className="text-zinc-500 shrink-0" />
        <input
          type="search"
          name="search"
          id="search"
          placeholder={searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          data-lpignore="true"
          data-1p-ignore="true"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
        />
      </div>

      <button
        onClick={handleMenuPress}
        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 active:bg-zinc-700"
      >
        <MenuIcon size={20} />
      </button>
    </footer>
  )
}
