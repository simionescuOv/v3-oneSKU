import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useCatalogStore } from '../../store/useCatalogStore'

const BUILD_WORD = 'lăcustă'

const PAGE_TITLES = {
  '/account': 'Account',
  '/catalog': 'Catalog',
  '/stockhub': 'StockHub',
  '/storefront': 'Storefront',
  '/dashboard': 'Dashboard',
  '/settings': 'Settings',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const currentFolderId = useCatalogStore((s) => s.currentFolderId)
  const navigateUp = useCatalogStore((s) => s.navigateUp)
  const getBreadcrumb = useCatalogStore((s) => s.getBreadcrumb)
  const selectionMode = useCatalogStore((s) => s.selectionMode)
  const clearSelection = useCatalogStore((s) => s.clearSelection)

  const isHome = pathname === '/'
  const isCatalog = pathname === '/catalog'
  const inSelection = isCatalog && selectionMode !== null
  const inFolder = isCatalog && currentFolderId !== null
  const showHomeBack = !isHome && !inFolder

  const currentFolderName = inFolder
    ? getBreadcrumb().at(-1)?.name ?? 'Catalog'
    : PAGE_TITLES[pathname] ?? 'oneSku'

  const showBuildWord = (isHome || isCatalog) && !inFolder

  return (
    <header className="flex-none flex items-center px-4 h-14 bg-zinc-900 border-b border-zinc-800 gap-3">
      {(inSelection || inFolder || showHomeBack) && (
        <button
          onClick={inSelection ? clearSelection : inFolder ? navigateUp : () => navigate('/')}
          className="flex items-center justify-center -ml-1 w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <span className="flex flex-col truncate">
        <span className="text-base font-semibold text-zinc-100 tracking-wide truncate">
          {currentFolderName}
        </span>
        {showBuildWord && (
          <span className="text-[11px] text-zinc-500 truncate">build: {BUILD_WORD}</span>
        )}
      </span>
    </header>
  )
}
