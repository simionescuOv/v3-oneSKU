import { X } from 'lucide-react'
import { useCatalogStore } from '../../store/useCatalogStore'

// Bară de acțiune pentru modul selecție (Organize).
// position: absolute, deasupra BottomBar-ului (NU fixed, NU sub TopBar — bottom-design).
export default function ActionBar({ onContinue }) {
  const selectionMode = useCatalogStore((s) => s.selectionMode)
  const selectedNodeIds = useCatalogStore((s) => s.selectedNodeIds)
  const clearSelection = useCatalogStore((s) => s.clearSelection)

  if (!selectionMode) return null

  const count = selectedNodeIds.size
  const canContinue = count >= 1

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

      <span className="flex-1" />

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className={[
          'shrink-0 flex items-center px-4 h-10 rounded-xl text-sm font-medium',
          canContinue
            ? 'bg-blue-600 text-white active:bg-blue-700'
            : 'bg-zinc-700 text-zinc-500',
        ].join(' ')}
      >
        {`Organize  <  ${count}  >`}
      </button>
    </div>
  )
}
