import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Settings, Trash2 } from 'lucide-react'
import { useCatalogStore } from '../store/useCatalogStore'
import { useAppStore } from '../store/useAppStore'
import { usePicker } from '../hooks/usePicker'
import ProductCard from '../components/catalog/ProductCard'
import BottomSheet from '../components/catalog/BottomSheet'
import ProductFormSheet from '../components/catalog/ProductFormSheet'
import SchemaSheet from '../components/catalog/SchemaSheet'

export default function CategoryPage() {
  const { categoryId } = useParams()
  const routerNavigate = useNavigate()

  const nodes = useCatalogStore((s) => s.nodes)
  const products = useCatalogStore((s) => s.products)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const getAncestorFolders = useCatalogStore((s) => s.getAncestorFolders)
  const storeNavigate = useCatalogStore((s) => s.navigate)
  const deleteCategory = useCatalogStore((s) => s.deleteCategory)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const catalogMenuOpen = useAppStore((s) => s.catalogMenuOpen)
  const closeCatalogMenu = useAppStore((s) => s.closeCatalogMenu)

  const [toast, setToast] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const toastTimer = useRef(null)

  const category = nodes.find((n) => n.id === categoryId)
  const attrs = useMemo(
    () => categoryAttributes.filter((a) => a.categoryId === categoryId).sort((a, b) => a.position - b.position),
    [categoryAttributes, categoryId]
  )
  const categoryProducts = useMemo(
    () => products.filter((p) => p.categoryId === categoryId && !p.deletedAt),
    [products, categoryId]
  )

  // ── Placeholder + curățare search la intrare/ieșire ──────────────────────────
  useEffect(() => {
    clearSearch()
    setSearchPlaceholder('Caută produs în categorie...')
    return () => {
      clearSearch()
      setSearchPlaceholder('Caută categorie sau folder...')
    }
  }, [clearSearch, setSearchPlaceholder])

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Căutare produse (usePicker inline, ca în Catalog) ────────────────────────
  const { filteredItems: matches, showCreate } = usePicker({
    mode: 'inline',
    items: categoryProducts,
    labelFn: (p) => p.name,
    query: searchQuery,
    multiSelect: false,
    allowCreate: true,
  })

  const productMeta = useCallback(
    (product) => attrs.map((a) => product.attributes?.[a.id]).filter(Boolean).join(' · '),
    [attrs]
  )

  const ELLIPSIS_CRUMB = useMemo(() => ({ id: '__ellipsis__', name: '…' }), [])

  const fullCrumbs = useMemo(() => {
    const ancestorCrumbs = getAncestorFolders(categoryId).map((f) => ({ id: f.id, name: f.name }))
    return [
      { id: null, name: 'Catalog' },
      ...ancestorCrumbs,
      { id: categoryId, name: category?.name ?? '' },
    ]
  }, [getAncestorFolders, categoryId, category?.name])

  const isCrumbTruncated = fullCrumbs.length > 2
  const collapsedCrumbs = isCrumbTruncated
    ? [fullCrumbs[0], ELLIPSIS_CRUMB, fullCrumbs[fullCrumbs.length - 1]]
    : fullCrumbs

  const [crumbsExpanded, setCrumbsExpanded] = useState(false)

  const crumbClasses = (crumb, isLast) => {
    const isRootCrumb = crumb.id === null
    return [
      'text-sm',
      isRootCrumb
        ? isLast
          ? 'shrink-0 px-2.5 py-1 rounded-lg border border-blue-400/60 text-blue-400 font-semibold'
          : 'shrink-0 px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
        : isLast
          ? 'text-amber-400 font-semibold'
          : 'text-zinc-400 hover:text-zinc-100',
    ].join(' ')
  }

  const goToCrumb = (id) => {
    setCrumbsExpanded(false)
    if (id === null || id === categoryId) {
      storeNavigate(null)
      if (id === null) routerNavigate('/catalog')
    } else {
      storeNavigate(id)
      routerNavigate('/catalog')
    }
  }

  const handleDelete = () => {
    deleteCategory(categoryId)
    setDeleteOpen(false)
    closeCatalogMenu()
    routerNavigate('/catalog')
  }

  // Categorie inexistentă (id greșit sau ștearsă) → înapoi la Catalog.
  if (!category) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="text-zinc-400 text-sm mb-4">Categoria nu există.</p>
        <button
          onClick={() => routerNavigate('/catalog')}
          className="px-4 h-10 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
        >
          Înapoi la Catalog
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none flex items-start gap-1 px-2 py-2 border-b border-zinc-800">
        <button
          onClick={() => routerNavigate('/')}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={20} />
        </button>

        {crumbsExpanded && isCrumbTruncated ? (
          <div className="flex flex-wrap content-start items-center gap-x-1.5 gap-y-1.5 min-h-8 min-w-0 flex-1">
            {fullCrumbs.map((crumb, i, arr) => {
              const isLast = i === arr.length - 1
              return (
                <span key={crumb.id ?? `full-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-zinc-600 text-sm">|</span>}
                  {isLast ? (
                    <span className={crumbClasses(crumb, true)}>{crumb.name}</span>
                  ) : (
                    <button onClick={() => goToCrumb(crumb.id)} className={crumbClasses(crumb, false)}>
                      {crumb.name}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-h-8 min-w-0 flex-1 overflow-hidden">
            {collapsedCrumbs.map((crumb, i, arr) => {
              const isLast = i === arr.length - 1
              const isEllipsis = crumb === ELLIPSIS_CRUMB
              return (
                <span
                  key={crumb.id ?? (isEllipsis ? 'ellipsis' : `c-${i}`)}
                  className={['flex items-center gap-1.5', isLast ? 'min-w-0 flex-1' : 'shrink-0'].join(' ')}
                >
                  {i > 0 && <span className="text-zinc-600 text-sm shrink-0">|</span>}
                  {isEllipsis ? (
                    <button
                      onClick={() => setCrumbsExpanded(true)}
                      className="shrink-0 px-1.5 rounded text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    >
                      …
                    </button>
                  ) : isLast ? (
                    <span className={[crumbClasses(crumb, true), 'min-w-0 truncate'].join(' ')}>
                      {crumb.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => goToCrumb(crumb.id)}
                      className={[crumbClasses(crumb, false), 'whitespace-nowrap'].join(' ')}
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Rezumat */}
      <div className="flex-none px-4 py-2 text-xs text-zinc-500 border-b border-zinc-900">
        {categoryProducts.length} {categoryProducts.length === 1 ? 'produs' : 'produse'}
      </div>

      {/* Listă produse */}
      {categoryProducts.length === 0 && !searchQuery.trim() ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Niciun produs în această categorie.<br />
            Scrie un nume în bara de căutare ca să adaugi primul produs.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          {matches.map((product) => (
            <ProductCard key={product.id} product={product} meta={productMeta(product)} onTap={() => {}} />
          ))}
          {showCreate && (
            <button
              onClick={() => setFormOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-blue-400 active:bg-zinc-900"
            >
              <Plus size={18} className="shrink-0" />
              <span className="text-sm">Adaugă „{searchQuery.trim()}"</span>
            </button>
          )}
          {matches.length === 0 && !showCreate && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">Niciun produs găsit</div>
          )}
        </div>
      )}

      {/* FAB „+" — la match inexact în căutare */}
      {showCreate && (
        <button
          onClick={() => setFormOpen(true)}
          className="absolute right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl active:bg-blue-700"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-2xl shadow-xl">
          <span className="flex-1 text-sm text-zinc-100">{toast}</span>
        </div>
      )}

      {/* Meniu contextual — Schema categoriei / Ștergere */}
      <BottomSheet open={catalogMenuOpen} onClose={closeCatalogMenu}>
        <div className="px-4 pb-6">
          <button
            onClick={() => { closeCatalogMenu(); setSchemaOpen(true) }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-zinc-400"><Settings size={18} /></span>
            <span className="flex-1 text-left">Schema categoriei</span>
          </button>
          <button
            onClick={() => { closeCatalogMenu(); setDeleteOpen(true) }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-red-400 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-red-400"><Trash2 size={18} /></span>
            <span className="flex-1 text-left">Șterge categoria</span>
          </button>
        </div>
      </BottomSheet>

      {/* Confirmare ștergere */}
      <BottomSheet open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="px-4 pb-6">
          <h2 className="text-sm font-medium text-zinc-200 mb-4 text-center">
            Ștergi categoria „{category.name}"?
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteOpen(false)}
              className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
            >
              Nu
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 h-11 rounded-xl bg-red-600 text-sm font-medium text-white active:bg-red-700"
            >
              Șterge
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Schema + formular produs */}
      <SchemaSheet
        open={schemaOpen}
        onClose={() => setSchemaOpen(false)}
        categoryId={categoryId}
        showToast={showToast}
      />
      <ProductFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        categoryId={categoryId}
        initialName={searchQuery.trim()}
        showToast={showToast}
        onCreated={() => { clearSearch() }}
      />
    </div>
  )
}
