import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const PAGE_TITLES = {
  '/account': 'Account',
  '/catalog': 'Catalog',
  '/stockhub': 'StockHub',
  '/storefront': 'Storefront',
  '/dashboard': 'Dashboard',
  '/settings': 'Settings',
}

// Catalog are propriul header (back + breadcrumb clicabil, vezi CatalogPage)
// — TopBar-ul generic n-ar adăuga decât o bară redundantă acolo.
export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (pathname === '/catalog') return null

  const isHome = pathname === '/'

  return (
    <header className="flex-none flex items-center px-4 h-14 bg-zinc-900 border-b border-zinc-800 gap-3">
      {!isHome && (
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center -ml-1 w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <span className="text-base font-semibold text-zinc-100 tracking-wide truncate">
        {PAGE_TITLES[pathname] ?? 'oneSku'}
      </span>
    </header>
  )
}
