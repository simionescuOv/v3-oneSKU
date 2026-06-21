import { Folder, Tag, ChevronRight } from 'lucide-react'

export default function NodeCard({ node, onTap }) {
  const isFolder = node.type === 'folder'

  return (
    <button
      onClick={() => onTap?.(node)}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-900"
    >
      {isFolder
        ? <Folder size={18} className="text-amber-400 shrink-0" />
        : <Tag size={18} className="text-blue-400 shrink-0" />
      }
      <span className="flex-1 text-sm text-zinc-100 truncate">{node.name}</span>
      {isFolder ? (
        <ChevronRight size={16} className="text-zinc-600 shrink-0" />
      ) : (
        <span className="text-xs text-zinc-500 shrink-0">{node.products ?? 0} produse</span>
      )}
    </button>
  )
}
