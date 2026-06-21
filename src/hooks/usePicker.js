import { useState, useCallback, useMemo } from 'react'
import { scoreMatch } from '../lib/search'

export function usePicker({
  options = [],
  value = [],
  multiSelect = false,
  allowCreate = false,
  maxSelections = Infinity,
  onChange,
}) {
  const [localOptions, setLocalOptions] = useState([...options])
  const [tempSelected, setTempSelected] = useState([])
  const [query, setQuery] = useState('')
  const [markedForDelete, setMarkedForDelete] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => {
    setTempSelected(multiSelect ? [...value] : [])
    setQuery('')
    setMarkedForDelete(false)
    setIsOpen(true)
  }, [value, multiSelect])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setMarkedForDelete(false)
  }, [])

  const commit = useCallback((selected) => {
    const newItems = selected.filter((s) => !options.includes(s))
    onChange?.({ selected, newItems })
  }, [options, onChange])

  const handleSelect = useCallback((val) => {
    if (!multiSelect) {
      commit([val])
      close()
      return
    }
    setTempSelected((prev) => {
      if (prev.includes(val)) return prev
      if (prev.length >= maxSelections) return prev
      return [...prev, val]
    })
    setQuery('')
    setMarkedForDelete(false)
  }, [multiSelect, maxSelections, commit, close])

  const handleRemove = useCallback((val) => {
    setTempSelected((prev) => prev.filter((s) => s !== val))
    setMarkedForDelete(false)
  }, [])

  const handleQueryChange = useCallback((val) => {
    setQuery(val)
    if (val.length > 0) setMarkedForDelete(false)
  }, [])

  const handleBackspace = useCallback(() => {
    if (query !== '' || tempSelected.length === 0) return
    if (!markedForDelete) setMarkedForDelete(true)
    else {
      setTempSelected((p) => p.slice(0, -1))
      setMarkedForDelete(false)
    }
  }, [query, tempSelected, markedForDelete])

  const handleAddNew = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    setLocalOptions((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    )
    if (!multiSelect) {
      commit([trimmed])
      close()
      return
    }
    if (tempSelected.length >= maxSelections) return
    setTempSelected((prev) => [...prev, trimmed])
    setQuery('')
  }, [query, multiSelect, tempSelected, maxSelections, commit, close])

  const handleSave = useCallback(() => {
    commit(tempSelected)
    close()
  }, [tempSelected, commit, close])

  const handleCancel = useCallback(() => {
    close()
  }, [close])

  const isAtMax = tempSelected.length >= maxSelections

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const tokens = q ? q.split(/\s+/) : []
    const scored = []
    for (const opt of localOptions) {
      if (multiSelect && tempSelected.includes(opt)) continue
      if (!tokens.length) {
        scored.push({ opt, score: 0 })
        continue
      }
      const s = scoreMatch(opt, tokens)
      if (s !== null) scored.push({ opt, score: s })
    }
    scored.sort((a, b) => a.score - b.score)
    return scored.map((s) => s.opt)
  }, [localOptions, query, multiSelect, tempSelected])

  const exactExists = localOptions.some(
    (o) => o.toLowerCase() === query.trim().toLowerCase()
  )
  const showAddRow = allowCreate && query.trim().length > 0 && !exactExists

  return {
    isOpen, tempSelected, localOptions, query, markedForDelete,
    filteredOptions, isAtMax, showAddRow, multiSelect, allowCreate,
    open, close, handleSelect, handleRemove, handleQueryChange,
    handleBackspace, handleAddNew, handleSave, handleCancel,
  }
}
