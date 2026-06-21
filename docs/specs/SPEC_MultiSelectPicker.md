# usePicker — Spec de integrare (v2)

> **Actualizare față de versiunea anterioară (`useMultiSelectPicker`):**
> Hook-ul a fost generalizat cu flaguri (`multiSelect`, `allowCreate`) și algoritmul de căutare a fost îmbunătățit (tokenizat, multi-cuvânt, AND logic, prioritizare prefix-first).
> Denumirea se schimbă din `useMultiSelectPicker` → `usePicker`.

---

## Scop

Hook generic de căutare/selecție/creare, reutilizabil în toată aplicația. Zero UI — expune doar stare și handlers. Componentele UI care îl consumă sunt separate.

---

## Flaguri și moduri de funcționare

Două flaguri independente generează toate combinațiile necesare:

| `multiSelect` | `allowCreate` | Comportament |
|---|---|---|
| `false` | `false` | **Search-only single select.** Cauți, alegi un element → exit imediat, trimite rezultatul. Fără rândul „+ Adaugă". |
| `false` | `true` | **Single select + create.** Cauți, alegi sau creezi → exit imediat, trimite rezultatul. Dacă nu există match exact, apare „+ Adaugă «query»". |
| `true` | `false` | **Multi select.** Selectezi N elemente (pills), confirmi cu Salvare. onChange doar la Salvare. Fără creare. |
| `true` | `true` | **Multi select + create.** Selectezi N, poți crea valori noi on-the-fly, confirmi cu Salvare. (Comportamentul din versiunea anterioară.) |

### Comportament la confirmare

- **Single select** (`multiSelect: false`): la alegere (tap pe element sau tap pe „+ Adaugă"), hook-ul apelează `onChange` imediat și se închide. Nu există buton Salvare/Anulare.
- **Multi select** (`multiSelect: true`): `onChange` se apelează **exclusiv la Salvare**, niciodată la selectare individuală sau la Anulare.

---

## Algoritmul de căutare — tokenizat, prefix-first

### Tokenizare și matching

1. Query-ul utilizatorului se sparge în tokeni după spații: `"t c"` → `["t", "c"]`.
2. Fiecare token trebuie să matcheze **un cuvânt diferit** din elementul căutat, la **începutul cuvântului** (prefix de cuvânt).
3. Toți tokenii trebuie satisfăcuți (**AND logic**).
4. Un cuvânt din element nu poate fi folosit de doi tokeni diferiți.

### Prioritizare (2 niveluri)

| Prioritate | Condiție |
|---|---|
| **1 — Prefix match** | Tokenul matchează la **începutul elementului** (primul cuvânt) |
| **2 — Inner word match** | Tokenul matchează la începutul unui cuvânt intern (nu primul) |

Scorul total = suma priorităților per token. Rezultatele se sortează crescător după scor (scor mai mic = mai relevant).

### Exemple

Query: `"t c"`
- „**T**elevizor **c**olor" → MATCH, scor 0+1=1 (t→primul cuvânt=0, c→al doilea=1)
- „acum **t**rebuia **c**eva" → MATCH, scor 1+1=2 (ambele pe cuvinte interne)
- „**T**elevizor mare" → NU (c nu matchează nimic)

Rezultat sortat: „Televizor color" apare înaintea „acum trebuia ceva".

### Implementare de referință — funcția de scoring

```js
function scoreMatch(label, tokens) {
  const words = label.toLowerCase().split(/\s+/);
  let total = 0;
  const usedWords = new Set();
  for (const tok of tokens) {
    let best = null;
    for (let i = 0; i < words.length; i++) {
      if (usedWords.has(i)) continue;
      if (words[i].startsWith(tok)) {
        const rank = i === 0 ? 0 : 1;
        if (best === null || rank < best.rank) best = { idx: i, rank };
      }
    }
    if (best === null) return null; // token fără match → exclude elementul
    usedWords.add(best.idx);
    total += best.rank;
  }
  return total; // scor: mai mic = mai relevant
}
```

---

## Implementare de referință — hook-ul `usePicker`

```jsx
import { useState, useCallback, useMemo } from "react";

export function usePicker({
  options = [],
  value = [],
  multiSelect = false,
  allowCreate = false,
  maxSelections = Infinity,
  onChange,
}) {
  const [localOptions, setLocalOptions] = useState([...options]);
  const [tempSelected, setTempSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [markedForDelete, setMarkedForDelete] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Sincronizare options externe
  // (dacă options se schimbă din părinte, localOptions se actualizează)
  // Notă: localOptions conține și valorile create on-the-fly pe durata sesiunii.

  const open = useCallback(() => {
    setTempSelected(multiSelect ? [...value] : []);
    setQuery("");
    setMarkedForDelete(false);
    setIsOpen(true);
  }, [value, multiSelect]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setMarkedForDelete(false);
  }, []);

  const commit = useCallback((selected) => {
    const newItems = selected.filter((s) => !options.includes(s));
    onChange?.({ selected, newItems });
  }, [options, onChange]);

  // ── Selectare ──────────────────────────────────────────
  const handleSelect = useCallback((val) => {
    if (!multiSelect) {
      // SINGLE: alegi → commit + close imediat
      commit([val]);
      close();
      return;
    }
    // MULTI: adaugă la selecție, rămâne deschis
    setTempSelected((prev) => {
      if (prev.includes(val)) return prev;
      if (prev.length >= maxSelections) return prev;
      return [...prev, val];
    });
    setQuery("");
    setMarkedForDelete(false);
  }, [multiSelect, maxSelections, commit, close]);

  const handleRemove = useCallback((val) => {
    setTempSelected((prev) => prev.filter((s) => s !== val));
    setMarkedForDelete(false);
  }, []);

  // ── Query ──────────────────────────────────────────────
  const handleQueryChange = useCallback((val) => {
    setQuery(val);
    if (val.length > 0) setMarkedForDelete(false);
  }, []);

  // ── Backspace pe input gol (multi select) ──────────────
  const handleBackspace = useCallback(() => {
    if (query !== "" || tempSelected.length === 0) return;
    if (!markedForDelete) setMarkedForDelete(true);
    else {
      setTempSelected((p) => p.slice(0, -1));
      setMarkedForDelete(false);
    }
  }, [query, tempSelected, markedForDelete]);

  // ── Creare on-the-fly (allowCreate) ────────────────────
  const handleAddNew = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Adaugă în lista locală (supraviețuiește între deschideri)
    setLocalOptions((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    );
    if (!multiSelect) {
      // SINGLE + CREATE: commit + close imediat
      commit([trimmed]);
      close();
      return;
    }
    // MULTI + CREATE: adaugă la selecție, rămâne deschis
    if (tempSelected.length >= maxSelections) return;
    setTempSelected((prev) => [...prev, trimmed]);
    setQuery("");
  }, [query, multiSelect, tempSelected, maxSelections, commit, close]);

  // ── Salvare explicită (doar multi select) ──────────────
  const handleSave = useCallback(() => {
    commit(tempSelected);
    close();
  }, [tempSelected, commit, close]);

  // ── Cancel ─────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    close();
  }, [close]);

  // ── Filtrare + sortare ─────────────────────────────────
  const isAtMax = tempSelected.length >= maxSelections;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];
    const scored = [];
    for (const opt of localOptions) {
      if (multiSelect && tempSelected.includes(opt)) continue;
      if (!tokens.length) {
        scored.push({ opt, score: 0 });
        continue;
      }
      const s = scoreMatch(opt, tokens);
      if (s !== null) scored.push({ opt, score: s });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.opt);
  }, [localOptions, query, multiSelect, tempSelected]);

  const exactExists = localOptions.some(
    (o) => o.toLowerCase() === query.trim().toLowerCase()
  );
  const showAddRow =
    allowCreate && query.trim().length > 0 && !exactExists;

  return {
    // Stare
    isOpen,
    tempSelected,
    localOptions,
    query,
    markedForDelete,
    filteredOptions,
    isAtMax,
    showAddRow,
    multiSelect,
    allowCreate,
    // Acțiuni
    open,
    close,
    handleSelect,
    handleRemove,
    handleQueryChange,
    handleBackspace,
    handleAddNew,
    handleSave,
    handleCancel,
  };
}
```

---

## Două forme de UI care consumă hook-ul

Hook-ul nu știe și nu-i pasă unde se randează. Componentele UI citesc starea din hook și apelează handlers. Există două forme de UI:

### 1. Inline (BottomBar)
- Căutarea se face tastând direct în bara de căutare din BottomBar (care e mereu jos).
- Rezultatele apar într-un bottom-sheet deschis deasupra barei.
- Single select: tap pe rezultat → se închide imediat, se trimite rezultatul.
- Folosit la: adăugare categorie (Catalog), denumire grup, alegere destinație la mutare.

### 2. Dialog (bottom-sheet full)
- Se deschide un bottom-sheet dedicat, cu pills pentru selecțiile active.
- Căutarea tot din bara de jos (regula globală — §3.2 din SPEC_CatalogPage.md).
- Footer cu Anulare / Salvare (doar la multiSelect).
- Folosit la: adăugare tags pe produs, selectare din liste lungi.

**Regula critică (din arhitectura aplicației):** inputul de căutare este **ÎNTOTDEAUNA** în BottomBar, **niciodată** în interiorul unui bottom-sheet. Bottom-sheet-urile afișează doar lista filtrată; filtrarea vine din bara de jos.

---

## Integrare în părinte

### Props hook-ului

| Prop | Tip | Default | Descriere |
|---|---|---|---|
| `options` | `string[]` | `[]` | Lista de opțiuni disponibile |
| `value` | `string[]` | `[]` | Selecțiile curente (pentru multi select, populează pills la deschidere) |
| `multiSelect` | `boolean` | `false` | `false` = single select (exit imediat); `true` = multi select (confirmare cu Salvare) |
| `allowCreate` | `boolean` | `false` | `true` = apare „+ Adaugă «query»" când nu există match exact |
| `maxSelections` | `number` | `Infinity` | Limita de selecții (doar multi select) |
| `onChange` | `fn({selected, newItems})` | — | Callback la confirmare. `selected` = array final. `newItems` = valorile create on-the-fly care nu existau în `options`. |

### Regula critică: `options` trăiește în componenta părinte

Dacă hook-ul e folosit repetat (ex: adaugi mai multe produse cu câmp tags), lista de opțiuni trebuie să trăiască **în componenta care gestionează lista de items**, nu în formularul individual. Altfel valorile create on-the-fly se pierd la unmount.

```jsx
// ✅ Corect — tagOptions supraviețuiește între items
function ItemsPage() {
  const [tagOptions, setTagOptions] = useState([]);
  const handleSave = (item) => {
    setTagOptions(prev => [...new Set([...prev, ...item.tags])]);
  };
  return <ItemForm tagOptions={tagOptions} onSave={handleSave} />;
}

// ❌ Greșit — tagOptions se resetează la fiecare item nou
function ItemForm() {
  const [tagOptions, setTagOptions] = useState([]); // moare la unmount
}
```

### Ce returnează `onChange`

```js
onChange({ selected, newItems })
// selected: string[] — array-ul complet al selecțiilor confirmate
// newItems: string[] — subset din selected care NU exista în options inițiale
//                       (util pentru persistență în DB)
```

---

## Ce NU se modifică

- Comportamentul Backspace în două trepte (doar multi select)
- Faptul că `onChange` se apelează **exclusiv la confirmare** (tap imediat la single, Salvare la multi), niciodată la Anulare
- Faptul că `localOptions` crește pe durata sesiunii și nu se resetează între deschideri
- Algoritmul de scoring: tokenizat, AND logic, prefix-first
