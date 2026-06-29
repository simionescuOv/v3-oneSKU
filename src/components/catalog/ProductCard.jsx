import { Package } from 'lucide-react'

// Rând de produs în pagina categoriei. Stil consecvent cu NodeCard.
// `meta` = atributele-cheie rezumate (ex: „Negru · 128GB"); `listPrice` opțional.
export default function ProductCard({ product, meta, onTap }) {
  return (
    <button
      onClick={() => onTap?.(product)}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-900"
    >
      <Package size={18} className="text-blue-400 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-zinc-100 truncate">{product.name}</span>
        {meta && <span className="block text-xs text-zinc-500 truncate">{meta}</span>}
      </span>
      {product.listPrice != null && (
        <span className="shrink-0 text-sm font-medium text-zinc-200">{product.listPrice} RON</span>
      )}
    </button>
  )
}
