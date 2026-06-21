import { useEffect } from 'react'

export default function BottomSheet({ open, onClose, children, className = '' }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="absolute inset-0 z-30 bg-black/50"
        onPointerDown={onClose}
      />
      <div
        className={[
          'absolute bottom-0 left-0 right-0 z-40',
          'bg-zinc-900 rounded-t-2xl',
          'flex flex-col',
          'max-h-[90dvh]',
          className,
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        {children}
      </div>
    </>
  )
}
