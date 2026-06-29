import { useEffect, useState } from 'react'
import { ChevronRight, ChevronLeft, Plus, Type, List } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'

// Schema de atribute a categoriei — bottom-sheet FĂRĂ căutare (BottomBar ascuns).
// Trei vizualizări în același sheet: listă atribute → adăugare atribut → opțiunile
// unui atribut single_choice.
export default function SchemaSheet({ open, onClose, categoryId, showToast }) {
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const attributeOptions = useCatalogStore((s) => s.attributeOptions)
  const addAttribute = useCatalogStore((s) => s.addAttribute)
  const addAttributeOption = useCatalogStore((s) => s.addAttributeOption)
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  const [view, setView] = useState('list') // 'list' | 'add' | 'options'
  const [attrName, setAttrName] = useState('')
  const [attrType, setAttrType] = useState('text')
  const [optionValue, setOptionValue] = useState('')
  const [activeAttrId, setActiveAttrId] = useState(null)

  useEffect(() => {
    setBottomBarHidden(open)
    if (open) {
      setView('list')
      setAttrName('')
      setAttrType('text')
      setOptionValue('')
      setActiveAttrId(null)
    }
  }, [open, setBottomBarHidden])

  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  if (!open) return null

  const attrs = categoryAttributes
    .filter((a) => a.categoryId === categoryId)
    .sort((a, b) => a.position - b.position)
  const activeAttr = attrs.find((a) => a.id === activeAttrId)
  const activeOptions = attributeOptions
    .filter((o) => o.attributeId === activeAttrId)
    .sort((a, b) => a.position - b.position)

  const handleAddAttr = () => {
    const ok = addAttribute(categoryId, attrName, attrType)
    if (!ok) {
      showToast('Există deja un atribut cu acest nume')
      return
    }
    setAttrName('')
    setAttrType('text')
    setView('list')
  }

  const handleAddOption = () => {
    const ok = addAttributeOption(activeAttrId, optionValue)
    if (!ok) {
      showToast('Există deja această valoare')
      return
    }
    setOptionValue('')
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6">
        {view === 'list' && (
          <>
            <h2 className="text-sm font-medium text-zinc-200 mb-3 text-center">Schema categoriei</h2>
            <div className="divide-y divide-zinc-800 max-h-[50dvh] overflow-y-auto">
              {attrs.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    if (a.type === 'single_choice') { setActiveAttrId(a.id); setView('options') }
                  }}
                  className="w-full flex items-center gap-3 py-3 text-left active:bg-zinc-800/60"
                >
                  {a.type === 'single_choice'
                    ? <List size={16} className="text-amber-400 shrink-0" />
                    : <Type size={16} className="text-zinc-400 shrink-0" />}
                  <span className="flex-1 text-sm text-zinc-100 truncate">{a.name}</span>
                  <span className="text-xs text-zinc-500 shrink-0">
                    {a.type === 'single_choice' ? 'listă' : 'text'}
                  </span>
                  {a.type === 'single_choice' && <ChevronRight size={14} className="text-zinc-600 shrink-0" />}
                </button>
              ))}
              {attrs.length === 0 && (
                <div className="py-6 text-center text-sm text-zinc-500">Niciun atribut definit</div>
              )}
            </div>
            <button
              onClick={() => setView('add')}
              className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
            >
              <Plus size={18} /> Adaugă atribut
            </button>
          </>
        )}

        {view === 'add' && (
          <>
            <div className="flex items-center mb-3">
              <button onClick={() => setView('list')} className="text-zinc-400 active:text-zinc-100">
                <ChevronLeft size={20} />
              </button>
              <h2 className="flex-1 text-sm font-medium text-zinc-200 text-center pr-5">Atribut nou</h2>
            </div>
            <input
              type="text"
              value={attrName}
              onChange={(e) => setAttrName(e.target.value)}
              placeholder="Numele atributului (ex: Culoare)"
              autoComplete="off"
              className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-3">
              {[
                { val: 'text', label: 'Text', Icon: Type },
                { val: 'single_choice', label: 'Listă cu o alegere', Icon: List },
              ].map(({ val, label, Icon }) => (
                <button
                  key={val}
                  onClick={() => setAttrType(val)}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm',
                    attrType === val ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700',
                  ].join(' ')}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddAttr}
              disabled={!attrName.trim()}
              className={[
                'mt-4 w-full h-11 rounded-xl text-sm font-medium',
                attrName.trim() ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
              ].join(' ')}
            >
              Creează
            </button>
          </>
        )}

        {view === 'options' && activeAttr && (
          <>
            <div className="flex items-center mb-3">
              <button onClick={() => setView('list')} className="text-zinc-400 active:text-zinc-100">
                <ChevronLeft size={20} />
              </button>
              <h2 className="flex-1 text-sm font-medium text-zinc-200 text-center pr-5 truncate">
                {activeAttr.name} — opțiuni
              </h2>
            </div>
            <div className="divide-y divide-zinc-800 max-h-[40dvh] overflow-y-auto">
              {activeOptions.map((o) => (
                <div key={o.id} className="py-2.5 text-sm text-zinc-100">{o.value}</div>
              ))}
              {activeOptions.length === 0 && (
                <div className="py-6 text-center text-sm text-zinc-500">Nicio opțiune</div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <input
                type="text"
                value={optionValue}
                onChange={(e) => setOptionValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && optionValue.trim()) handleAddOption() }}
                placeholder="Valoare nouă..."
                autoComplete="off"
                className="flex-1 bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleAddOption}
                disabled={!optionValue.trim()}
                className={[
                  'shrink-0 flex items-center justify-center w-11 h-11 rounded-xl',
                  optionValue.trim() ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
                ].join(' ')}
              >
                <Plus size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
