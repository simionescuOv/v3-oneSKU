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

  const handleCrumbCatalog = () => { storeNavigate(null); routerNavigate('/catalog') }
  const handleCrumbFolder = (folderId) => { storeNavigate(folderId); routerNavigate('/catalog') }

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

  const ancestors = getAncestorFolders(categoryId)

  return (
    <div className="flex flex-col h-full">
      {/* Header propriu — back + breadcrumb (Catalogul nu are TopBar generic) */}
      <div className="flex-none flex items-center gap-1 px-2 py-2 border-b border-zinc-800">
        <button
          onClick={() => routerNavigate('/catalog')}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <button onClick={handleCrumbCatalog} className="shrink-0 px-2.5 py-1 rounded-lg border border-zinc-700 text-sm text-zinc-300 active:text-zinc-100">
            Catalog
          </button>
          {ancestors.map((f) => (
            <span key={f.id} className="flex items-center gap-1.5 shrink-0">
              <span className="text-zinc-600 text-sm">|</span>
              <button onClick={() => handleCrumbFolder(f.id)} className="text-sm text-zinc-400 active:text-zinc-100 whitespace-nowrap">
                {f.name}
              </button>
            </span>
          ))}
          <span className="text-zinc-600 text-sm shrink-0">|</span>
          <span className="text-sm text-amber-400 font-semibold min-w-0 truncate">{category.name}</span>
        </div>
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
