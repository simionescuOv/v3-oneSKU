import { X, ChevronRight } from 'lucide-react'
import { useCatalogStore } from '../../store/useCatalogStore'

// Bară de acțiune pentru modul selecție (Grupare / Mutare).
// position: absolute, deasupra BottomBar-ului (NU fixed, NU sub TopBar — bottom-design).
export default function ActionBar({ onContinue }) {
  const selectionMode = useCatalogStore((s) => s.selectionMode)
  const selectedNodeIds = useCatalogStore((s) => s.selectedNodeIds)
  const clearSelection = useCatalogStore((s) => s.clearSelection)

  if (!selectionMode) return null

  const count = selectedNodeIds.size
  const minRequired = selectionMode === 'group' ? 2 : 1
  const canContinue = count >= minRequired

  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center gap-3 px-4 h-14 bg-zinc-800 border-t border-zinc-700"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
    >
      <button
        onClick={clearSelection}
        className="shrink-0 flex items-center gap-1.5 text-sm text-zinc-300 active:text-zinc-100"
      >
        <X size={18} />
        Anulează
      </button>

      <span className="flex-1 text-center text-sm font-medium text-zinc-100">
        {count} {count === 1 ? 'selectat' : 'selectate'}
      </span>

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className={[
          'shrink-0 flex items-center justify-center w-10 h-10 rounded-xl',
          canContinue
            ? 'bg-blue-600 text-white active:bg-blue-700'
            : 'bg-zinc-700 text-zinc-500',
        ].join(' ')}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
