import { useEffect, useMemo } from 'react'
import { Folder, Home } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'
import { filterAndSort } from '../../lib/search'

// SPEC_MutareCrossFolder §3.4 — bottom-sheet CU căutare (BottomBar rămâne
// vizibil). Alege destinația pentru folderul temporar care conține selecția
// cross-folder; `getValidMoveDestinations(tempFolderId)` exclude automat
// folderul temporar și descendenții lui (nodurile mutate în el).
export default function DestinationPicker({ open, onClose, tempFolderId, onPicked, allRootSelection = false }) {
  const getValidMoveDestinations = useCatalogStore((s) => s.getValidMoveDestinations)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)

  useEffect(() => {
    if (!open) return
    clearSearch()
    setSearchPlaceholder('Caută folder destinație...')
    return () => {
      clearSearch()
      setSearchPlaceholder('Caută categorie sau folder...')
    }
  }, [open, clearSearch, setSearchPlaceholder])

  const validFolders = useMemo(() => {
    if (!open || !tempFolderId) return []
    return getValidMoveDestinations(tempFolderId)
  }, [open, tempFolderId, getValidMoveDestinations])

  const filteredFolders = useMemo(
    () => filterAndSort(validFolders, searchQuery, (f) => f.name),
    [validFolders, searchQuery]
  )

  if (!open) return null

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="pb-6">
        <h2 className="px-4 text-sm font-medium text-zinc-200 mb-2">Mută în…</h2>
        <div className="max-h-[60dvh] overflow-y-auto divide-y divide-zinc-800">
          {/* „⌂ Rădăcină" — mereu primul, fixat sus. Când toate elementele
              selectate erau deja la rădăcină, devine „New folder" și sare
              peste întrebarea „New folder?" din pasul următor. */}
          <button
            onClick={() => onPicked(null, allRootSelection ? 'New folder' : 'Rădăcină', allRootSelection)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800"
          >
            <Home size={18} className="text-zinc-400 shrink-0" />
            <span className="flex-1 text-sm text-zinc-100">{allRootSelection ? 'New folder' : 'Rădăcină'}</span>
          </button>

          {filteredFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onPicked(folder.id, folder.name, false)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800"
            >
              <Folder size={18} className="text-amber-400 shrink-0" />
              <span className="flex-1 text-sm text-zinc-100 truncate">{folder.name}</span>
            </button>
          ))}

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
