import { useEffect, useMemo } from 'react'
import { Folder, Home } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'
import { filterAndSort } from '../../lib/search'

// Bottom-sheet CU căutare → BottomBar rămâne vizibil, contextul de căutare
// se schimbă la lista de destinații. Filtrarea se face DOAR din bara din
// BottomBar (useAppStore.searchQuery) — sheet-ul nu are input propriu.
export default function MoveDestinationSheet({ open, onClose, showToast }) {
  const selectedNodeIds = useCatalogStore((s) => s.selectedNodeIds)
  const currentFolderId = useCatalogStore((s) => s.currentFolderId)
  const treeExpanded = useCatalogStore((s) => s.treeExpanded)
  const getValidMoveDestinations = useCatalogStore((s) => s.getValidMoveDestinations)
  const getChildren = useCatalogStore((s) => s.getChildren)
  const moveNodes = useCatalogStore((s) => s.moveNodes)
  const clearSelection = useCatalogStore((s) => s.clearSelection)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)

  const ids = useMemo(() => [...selectedNodeIds], [selectedNodeIds])

  // Schimbă contextul de căutare la deschidere; restaurează la închidere.
  useEffect(() => {
    if (!open) return
    clearSearch()
    setSearchPlaceholder('Caută folder destinație...')
    return () => {
      clearSearch()
      setSearchPlaceholder('Caută categorie sau folder...')
    }
  }, [open, clearSearch, setSearchPlaceholder])

  // Dacă selecția are mai multe elemente, destinațiile valide sunt
  // intersecția destinațiilor valide ale tuturor (IMPL_GrupareMutare §C3) —
  // store-ul expune getValidMoveDestinations per nod (SPEC_CatalogRPC §1.1).
  // În mod fold (arbore restrâns), destinațiile se limitează la folderele
  // din nivelul curent — nu se poate muta direct în alt nivel al arborelui.
  const validFolders = useMemo(() => {
    if (!open || ids.length === 0) return []
    const perNode = ids.map((id) => getValidMoveDestinations(id))
    const [first, ...rest] = perNode
    const allValid = first.filter((folder) => rest.every((list) => list.some((f) => f.id === folder.id)))
    if (treeExpanded) return allValid
    const localFolderIds = new Set(
      getChildren(currentFolderId).filter((n) => n.type === 'folder').map((n) => n.id)
    )
    return allValid.filter((folder) => localFolderIds.has(folder.id))
  }, [open, ids, getValidMoveDestinations, treeExpanded, getChildren, currentFolderId])

  const filteredFolders = useMemo(
    () => filterAndSort(validFolders, searchQuery, (f) => f.name),
    [validFolders, searchQuery]
  )

  if (!open) return null

  const handleMove = (targetParentId, targetName) => {
    const ok = moveNodes(ids, targetParentId)
    if (!ok) {
      showToast('Mutare invalidă (destinație în interiorul selecției)')
      return
    }
    showToast(`${ids.length} ${ids.length === 1 ? 'element mutat' : 'elemente mutate'} în „${targetName}"`)
    onClose()
    clearSelection()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="pb-6">
        <h2 className="px-4 text-sm font-medium text-zinc-200 mb-2">Mută în…</h2>
        <div className="max-h-[60dvh] overflow-y-auto divide-y divide-zinc-800">
          {/* „⌂ Rădăcină" — fixat sus; în mod fold, doar dacă suntem deja la rădăcină */}
          {(treeExpanded || currentFolderId === null) && (
            <button
              onClick={() => handleMove(null, 'Rădăcină')}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800"
            >
              <Home size={18} className="text-zinc-400 shrink-0" />
              <span className="flex-1 text-sm text-zinc-100">Rădăcină</span>
              {currentFolderId === null && (
                <span className="text-xs text-zinc-500 shrink-0">(curent)</span>
              )}
            </button>
          )}

          {filteredFolders.map((folder) => {
            const isCurrent = folder.id === currentFolderId
            return (
              <button
                key={folder.id}
                onClick={() => handleMove(folder.id, folder.name)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800"
              >
                <Folder size={18} className="text-amber-400 shrink-0" />
                <span className={[
                  'flex-1 text-sm truncate',
                  isCurrent ? 'text-zinc-500' : 'text-zinc-100',
                ].join(' ')}>
                  {folder.name}
                </span>
                {isCurrent && <span className="text-xs text-zinc-500 shrink-0">(curent)</span>}
              </button>
            )
          })}

          {filteredFolders.length === 0 && searchQuery.trim() && (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              Niciun folder găsit
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
