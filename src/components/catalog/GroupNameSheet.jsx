import { useEffect, useRef, useState } from 'react'
import BottomSheet from './BottomSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'

// Bottom-sheet FĂRĂ căutare → BottomBar se ascunde.
// Câmpul de nume nu e căutare (e ca un input de redenumire), deci poate sta în sheet.
export default function GroupNameSheet({ open, onClose, showToast, suppressSuccessToast }) {
  const selectedNodeIds = useCatalogStore((s) => s.selectedNodeIds)
  const groupNodes = useCatalogStore((s) => s.groupNodes)
  const clearSelection = useCatalogStore((s) => s.clearSelection)
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setBottomBarHidden(open)
    if (open) {
      setName('')
      // focus + tastatură
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open, setBottomBarHidden])

  // Asigură restaurarea BottomBar-ului la demontare
  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  if (!open) return null

  const ids = [...selectedNodeIds]

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const ok = groupNodes(ids, trimmed)
    if (!ok) {
      showToast('Un folder cu acest nume există deja')
      inputRef.current?.focus()
      return
    }
    if (!suppressSuccessToast) showToast(`Folder „${trimmed}" creat cu ${ids.length} elemente`)
    onClose()
    clearSelection()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6">
        <h2 className="text-sm font-medium text-zinc-200 mb-3">Folder nou</h2>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="Numele folderului nou"
          autoComplete="off"
          enterKeyHint="done"
          className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
          >
            Anulează
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className={[
              'flex-1 h-11 rounded-xl text-sm font-medium',
              name.trim() ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
            ].join(' ')}
          >
            Creează
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
