import { useStockStore } from '../store/useStockStore'

export default function StockHubPage() {
  const spaces = useStockStore((s) => s.spaces)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">StockHub</h1>
        <p className="text-sm text-zinc-500">Gestiunea spațiilor de stoc.</p>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Spaces · {spaces.length}
        </h2>
        <ul className="space-y-2">
          {spaces.map((space) => (
            <li
              key={space.id}
              className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-100">{space.name}</span>
                {space.allow_negative_stock && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    negativ permis
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-xs text-zinc-500">
                <span>{space.product_count} produse</span>
                <span
                  className={space.total_units < 0 ? 'text-red-400' : ''}
                >
                  {space.total_units} unități
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="h-64" />
    </div>
  )
}
