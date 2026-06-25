import { useEffect, useRef, useState } from 'react'
import BottomSheet from './BottomSheet'
import { useAppStore } from '../../store/useAppStore'

// SPEC_MutareCrossFolder §3.5 — bottom-sheet FĂRĂ căutare (BottomBar se
// ascunde). Două stări vizuale în ACELAȘI sheet, fără tranziție de navigare:
// întrebare inițială → expandare inline la „Da" cu input de nume.
export default function SubgroupSheet({ open, onClose, onConfirmNo, onConfirmYes }) {
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setBottomBarHidden(open)
    if (open) {
      setExpanded(false)
      setName('')
    }
  }, [open, setBottomBarHidden])

  // Asigură restaurarea BottomBar-ului la demontare
  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  useEffect(() => {
    if (!expanded) return
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [expanded])

  if (!open) return null

  const trimmed = name.trim()

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6">
        <h2 className="text-sm font-medium text-zinc-200 mb-4 text-center">New sub-group?</h2>

        {!expanded ? (
          <div className="flex gap-3">
            <button
              onClick={onConfirmNo}
              className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
            >
              Nu
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
            >
              Da
            </button>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && trimmed) onConfirmYes(trimmed) }}
              placeholder="Nume subfolder..."
              autoComplete="off"
              enterKeyHint="done"
              className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setExpanded(false)}
                className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
              >
                Anulează
              </button>
              <button
                onClick={() => onConfirmYes(trimmed)}
                disabled={!trimmed}
                className={[
                  'flex-1 h-11 rounded-xl text-sm font-medium',
                  trimmed ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
                ].join(' ')}
              >
                Creează
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
