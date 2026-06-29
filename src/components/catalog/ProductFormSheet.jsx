import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'

// Formular de adăugare produs — bottom-sheet FĂRĂ căutare (BottomBar ascuns).
// Câmpurile se generează din schema categoriei: text → input; single_choice →
// chips de opțiuni (cu posibilitatea de a adăuga o valoare nouă în listă, §5.2).
export default function ProductFormSheet({ open, onClose, categoryId, initialName, showToast, onCreated }) {
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const attributeOptions = useCatalogStore((s) => s.attributeOptions)
  const addAttributeOption = useCatalogStore((s) => s.addAttributeOption)
  const addProduct = useCatalogStore((s) => s.addProduct)
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  const [name, setName] = useState('')
  const [values, setValues] = useState({})
  const [listPrice, setListPrice] = useState('')
  const [optionDrafts, setOptionDrafts] = useState({})

  useEffect(() => {
    setBottomBarHidden(open)
    if (open) {
      setName(initialName ?? '')
      setValues({})
      setListPrice('')
      setOptionDrafts({})
    }
  }, [open, initialName, setBottomBarHidden])

  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  if (!open) return null

  const attrs = categoryAttributes
    .filter((a) => a.categoryId === categoryId)
    .sort((a, b) => a.position - b.position)

  const optionsOf = (attrId) =>
    attributeOptions.filter((o) => o.attributeId === attrId).sort((a, b) => a.position - b.position)

  const setValue = (attrId, val) => setValues((prev) => ({ ...prev, [attrId]: val }))

  const handleAddOption = (attrId) => {
    const draft = (optionDrafts[attrId] ?? '').trim()
    if (!draft) return
    const ok = addAttributeOption(attrId, draft)
    if (!ok) {
      showToast('Există deja această valoare')
      return
    }
    setValue(attrId, draft)
    setOptionDrafts((prev) => ({ ...prev, [attrId]: '' }))
  }

  const handleCreate = () => {
    // Păstrăm doar atributele completate (nu trimitem chei goale).
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v != null && String(v).trim() !== '')
    )
    const ok = addProduct(categoryId, name, cleaned, listPrice)
    if (!ok) {
      showToast('Există deja un produs cu acest nume')
      return
    }
    onCreated?.()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 overflow-y-auto max-h-[80dvh]">
        <h2 className="text-sm font-medium text-zinc-200 mb-3 text-center">Produs nou</h2>

        <label className="block text-xs text-zinc-500 mb-1">Nume</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Numele produsului"
          autoComplete="off"
          className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
        />

        {attrs.map((a) => (
          <div key={a.id} className="mt-4">
            <label className="block text-xs text-zinc-500 mb-1">{a.name}</label>
            {a.type === 'text' ? (
              <input
                type="text"
                value={values[a.id] ?? ''}
                onChange={(e) => setValue(a.id, e.target.value)}
                autoComplete="off"
                className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {optionsOf(a.id).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setValue(a.id, values[a.id] === o.value ? undefined : o.value)}
                      className={[
                        'px-3 h-9 rounded-lg text-sm',
                        values[a.id] === o.value ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700',
                      ].join(' ')}
                    >
                      {o.value}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={optionDrafts[a.id] ?? ''}
                    onChange={(e) => setOptionDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddOption(a.id) }}
                    placeholder="Valoare nouă..."
                    autoComplete="off"
                    className="flex-1 bg-zinc-800 rounded-xl px-3 h-9 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleAddOption(a.id)}
                    disabled={!(optionDrafts[a.id] ?? '').trim()}
                    className={[
                      'shrink-0 flex items-center justify-center w-9 h-9 rounded-lg',
                      (optionDrafts[a.id] ?? '').trim() ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
                    ].join(' ')}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        <label className="block text-xs text-zinc-500 mb-1 mt-4">Preț de listă (RON, opțional)</label>
        <input
          type="number"
          inputMode="decimal"
          value={listPrice}
          onChange={(e) => setListPrice(e.target.value)}
          placeholder="ex: 249"
          autoComplete="off"
          className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex gap-3 mt-5">
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
