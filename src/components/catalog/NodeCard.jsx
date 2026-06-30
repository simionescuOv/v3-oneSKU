import { Folder, Tag, ChevronRight, Check } from 'lucide-react'

export default function NodeCard({ node, onTap, selectable = false, selected = false, productCount }) {
  const isFolder = node.type === 'folder'

  return (
    <button
      onClick={() => onTap?.(node)}
      className={[
        'w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-900',
        selectable && selected ? 'border-l-2 border-blue-500 bg-zinc-900/60' : '',
      ].join(' ')}
    >
      {selectable && (
        <span
          className={[
            'shrink-0 flex items-center justify-center w-5 h-5 rounded-full border',
            selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-600 text-transparent',
          ].join(' ')}
        >
          <Check size={14} />
        </span>
      )}
      {isFolder
        ? <Folder size={18} className="text-amber-400 shrink-0" />
        : <Tag size={18} className="text-blue-400 shrink-0" />
      }
      <span className="flex-1 text-sm text-zinc-100 truncate">{node.name}</span>
      {isFolder ? (
        !selectable && <ChevronRight size={16} className="text-zinc-600 shrink-0" />
      ) : (
        <span className="text-sm font-semibold text-zinc-400 shrink-0">{productCount ?? 0}</span>
      )}
    </button>
  )
}
