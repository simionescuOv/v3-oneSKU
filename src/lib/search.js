const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g')

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '')
}

export function scoreMatch(label, tokens) {
  const words = normalize(label).split(/\s+/)
  let total = 0
  const usedWords = new Set()
  for (const tok of tokens) {
    let best = null
    for (let i = 0; i < words.length; i++) {
      if (usedWords.has(i)) continue
      const word = words[i]
      if (word.startsWith(tok)) {
        const rank = i === 0 ? 0 : 1
        if (best === null || rank < best.rank) best = { idx: i, rank }
      } else if (tok.length >= 2 && word.includes(tok)) {
        if (best === null || 2 < best.rank) best = { idx: i, rank: 2 }
      }
    }
    if (best === null) return null
    usedWords.add(best.idx)
    total += best.rank
  }
  return total
}

export function filterAndSort(items, query, getLabel = (x) => x) {
  const q = normalize(query.trim())
  if (!q) return items
  const tokens = q.split(/\s+/)
  const scored = []
  for (const item of items) {
    const s = scoreMatch(getLabel(item), tokens)
    if (s !== null) scored.push({ item, score: s })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.map((s) => s.item)
}
