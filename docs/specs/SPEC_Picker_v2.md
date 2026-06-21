# oneSku — SPEC Picker v2 (usePicker + BottomBar)

> **v2** — rescris după auditul de cod (`CURRENT_STATE_CATALOG.md`). Reflectă implementarea reală
> din `src/lib/search.js` + `src/hooks/usePicker.js`, plus deciziile arhitecturale confirmate
> în chat: picker-ul e **motorul central** al aplicației, nu un hook auxiliar.
>
> Înlocuiește `SPEC_MultiSelectPicker.md` (v1).

---

## 0. Concept

`usePicker` e un hook React fără UI care pune la dispoziție **căutare + selecție** pe orice
listă de date. E mecanismul unic prin care BottomBar-ul filtrează conținutul paginii curente
sau prin care un flux separat (Cart, mutare categorie) permite utilizatorului să aleagă
elemente dintr-o listă.

**Regula fundamentală:** inputul de căutare trăiește **exclusiv** în BottomBar. Niciun
bottom-sheet, niciun dialog, niciun modal nu conține **propriul** input de căutare.
Când un bottom-sheet are nevoie de filtrare (ex: lista de valori a unui atribut),
BottomBar-ul **rămâne vizibil** și își schimbă contextul — filtrează datele din interiorul
sheet-ului (vezi §4.5).

---

## 1. Flaguri

| Flag | Valoare | Comportament |
|---|---|---|
| `multiSelect` | `false` (default) | Selecție unică. La tap pe element, hook-ul returnează imediat elementul selectat și se resetează. |
| `multiSelect` | `true` | Selecție multiplă. Elementele selectate se acumulează. Confirmarea e explicită (buton „Salvează"). Anularea (buton „X" sau backdrop) revine fără rezultat. |
| `allowCreate` | `false` (default) | Doar căutare în lista existentă. La zero rezultate, afișează „Niciun rezultat". |
| `allowCreate` | `true` | La zero rezultate, afișează rândul „+ Adaugă «query»" (și/sau FAB — vezi §5). La activare, elementul nou se adaugă în lista locală a picker-ului și se selectează automat. |

**Combinații rezultante:**

| `multiSelect` | `allowCreate` | Scenariu tipic |
|---|---|---|
| `false` | `false` | Picker destinație la mutare categorie — alegi un folder, gata |
| `false` | `true` | Căutare în Catalog — cauți o categorie, dacă nu există o creezi |
| `true` | `false` | Filtrare produse după tags — alegi mai multe tag-uri, confirmi |
| `true` | `true` | Selector atribute categorie — alegi din existente sau creezi noi |

---

## 2. Algoritm de căutare

Implementat în `src/lib/search.js`. Acesta e algoritmul **canonic** — orice componentă
care are nevoie de căutare îl importă de aici, nu își scrie propria variantă.

### 2.1 Normalizare

```js
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
```

- Lowercase.
- NFD decompose + strip combining marks → elimină diacriticele românești
  (ă→a, â→a, î→i, ș→s, ț→t, inclusiv variantele cu sedilă ş/ţ).
- Se aplică pe **ambele părți**: query și eticheta elementului.

### 2.2 Tokenizare

```
query.trim() → normalize() → split(/\s+/)
```

Token-uri multiple, separate prin spații. `"t c"` → `["t", "c"]`.

### 2.3 Matching — `scoreMatch(label, tokens)`

Eticheta e normalizată și spartă în cuvinte (`split(/\s+/)`).

Pentru fiecare token, se caută cel mai bun cuvânt disponibil (un cuvânt deja folosit de alt
token nu poate fi reutilizat — `usedWords` Set):

| Prioritate | Condiție | Rank |
|---|---|---|
| 1 | Prefix pe **primul** cuvânt al etichetei (`word.startsWith(tok)`, index 0) | 0 |
| 2 | Prefix pe un cuvânt **intern** (`word.startsWith(tok)`, index > 0) | 1 |
| 3 | **Substring** (`word.includes(tok)`), **doar dacă `tok.length >= 2`** | 2 |

- Dacă tokenul are un singur caracter, **doar** prefix match e permis (nu substring).
  Motivul: un caracter izolat în interiorul unui cuvânt produce prea mult zgomot.
- Dacă niciun cuvânt nu satisface un token → `scoreMatch` returnează `null` → elementul e
  **exclus** (AND logic strict: toți tokenii trebuie satisfăcuți).

### 2.4 Ordonare — `filterAndSort(items, query, labelFn)`

1. Calculează `scoreMatch` pentru fiecare element (folosind `labelFn` pentru a extrage
   eticheta).
2. Exclude elementele cu scor `null`.
3. Sortează **crescător** după scor total (sumă rank-uri): prefix-pe-primul-cuvânt (0)
   înaintea prefix-intern (1), înaintea substring (2).

---

## 3. Două moduri de operare

### 3.1 Mod inline (BottomBar)

Picker-ul filtrează **în loc** — datele paginii curente se restrâng la rezultatele de
căutare, fără a deschide o suprafață nouă.

**Flux:**
1. Pagina instanțiază `usePicker` cu lista ei de date + flaguri.
2. BottomBar-ul randează input-ul de căutare; utilizatorul tastează.
3. Hook-ul returnează `filteredItems` — pagina le afișează în loc de lista completă.
4. La selecție (tap pe element), pagina decide ce face: navighează, editează, etc.
5. La `allowCreate + zero rezultate`: pagina afișează rândul „+ Adaugă «query»" și/sau
   FAB-ul (vezi §5).

**Exemplu:** Catalog page — căutare printre categorii și foldere. Tap pe categorie =
navighează în ea. Tap pe „+ Adaugă" = creează categorie nouă.

### 3.2 Mod standalone (pagină/sheet separat)

Picker-ul se deschide ca o **suprafață dedicată** (pagină full-screen sau bottom-sheet
mare), cu propriul context de căutare (BottomBar-ul acelei suprafețe), iar la
confirmare/anulare returnează rezultatele către componenta părinte.

**Flux:**
1. Componenta părinte lansează picker-ul (ex: buton „Adaugă produs" din Cart).
2. Picker-ul se deschide cu lista sa de date, propriul context de BottomBar, flagurile sale.
3. Utilizatorul caută, selectează (single sau multi).
4. La confirmare → picker-ul se închide, returnează elementele selectate către părinte.
5. La anulare → picker-ul se închide fără rezultat.

**Exemplu:** Cart — apasă „+" → se deschide picker full-screen cu produsele din Catalog →
selectează produse → confirmă → produsele apar în coș.

**Exemplu:** Mutare categorie — apasă „Mutare" → picker cu lista de foldere (flaguri:
`multiSelect=false`, `allowCreate=false`) → selectează destinația → confirmă → categoria
se mută.

---

## 4. BottomBar — structura și contextualitatea

### 4.1 Layout

```
┌───────────────────────────────────────┐
│  [🔍 Caută...]              [Icon]   │
└───────────────────────────────────────┘
```

Două elemente: input de căutare (stânga, ocupă spațiul disponibil) + buton icon (dreapta).

### 4.2 Butonul icon — dinamic per pagină

Iconul și acțiunea butonului se schimbă în funcție de pagina curentă. Fiecare pagină
definește **ce icon** afișează și **ce acțiune** declanșează (deschide meniul contextual
al paginii respective).

| Pagină | Icon | Acțiune |
|---|---|---|
| Home (`/`) | `Menu` (hamburger) | Deschide meniul lateral (sidebar) |
| Catalog (`/catalog`) | `BookOpen` | Deschide meniul contextual Catalog |
| StockHub (`/stockhub`) | `Warehouse` | Deschide meniul contextual StockHub |
| ... | ... | ... (fiecare pagină își definește propriul set) |

Mapping-ul e definit în `src/lib/navItems.js` (sau echivalent). **Nu există o convenție
fixă de icon** — fiecare pagină alege ce are sens pentru contextul ei.

### 4.3 Meniul contextual — bottom-sheet per pagină

Butonul icon deschide un **bottom-sheet** cu opțiuni specifice paginii curente:

- Opțiunile, iconurile lor și acțiunile sunt definite de fiecare pagină.
- Bottom-sheet-ul e o primitivă generică (`BottomSheet.jsx`) — nu conține logică de
  business, doar backdrop + panel.

### 4.4 Hide/show la scroll

BottomBar-ul se ascunde la scroll în jos în `MainContent` și reapare la scroll în sus.
Implementat cu `translate-y-full` / `translate-y-0` controlat de direcția scroll-ului.
Asta e **independent** de comportamentul de tastatură — nu confunda cele două.

### 4.5 Comportamentul cu bottom-sheet — două moduri

Bottom-sheet-ul (`BottomSheet.jsx`) poate fi deschis în două moduri, controlate de
componenta care îl invocă:

| Mod | BottomBar | Când se folosește |
|---|---|---|
| **Cu căutare** | Rămâne vizibil. Search bar-ul își schimbă contextul și filtrează datele din interiorul sheet-ului. | Când sheet-ul conține o **listă lungă** care trebuie filtrată (ex: valori atribut, opțiuni de filtrare, tag-uri). |
| **Fără căutare** | Se ascunde. Sheet-ul e un modal simplu. | Când sheet-ul conține doar butoane, text static, formulare scurte, opțiuni care se parcurg prin scroll fără nevoie de filtrare (ex: meniu contextual, confirmare, editare nume). |

**Regula rămâne:** inputul de căutare e **mereu** cel din BottomBar — sheet-ul nu
conține niciodată propriul input de căutare separat. Diferența e doar dacă BottomBar-ul
rămâne vizibil sau nu.

### 4.6 Comportamentul cu tastatura

- `AppShell` e `position: fixed` cu dimensiuni controlate de `visualViewport`
  (hook `useViewportHeight`).
- BottomBar e copil normal în flex-column (nu `fixed` separat), deci se ridică natural
  odată cu redimensionarea `AppShell`-ului de către tastatură.
- **Nu există `translateY` legat de tastatură** — singurul `translateY` e cel de
  hide/show la scroll (§4.4).
- `<meta name="viewport" ... interactive-widget=resizes-content>` — pe browsere care
  suportă, layout viewport-ul se redimensionează nativ.

### 4.7 Input — configurare anti-autofill

```jsx
<input
  type="search"
  name="search"
  id="search"
  autoComplete="off"
  enterKeyHint="search"
  data-lpignore="true"
  data-1p-ignore="true"
/>
```

---

## 5. FAB button — mecanism complementar

Când `allowCreate = true` și căutarea produce zero rezultate, pe lângă rândul inline
„+ Adaugă «query»" din listă, poate apărea un **FAB (Floating Action Button)** vizibil
deasupra BottomBar-ului.

**Motivul existenței:** pe ecrane unde lista e goală și rândul „+ Adaugă" ar fi prea sus
(sau ar necesita scroll), FAB-ul oferă un target de tap accesibil imediat, la nivelul
degetului mare.

- Poziție: `position: absolute`, plasat deasupra BottomBar-ului (nu `fixed` — vezi
  `CURRENT_STATE_CATALOG.md` §2.2 pentru motivul tehnic).
- Acțiune: identică cu rândul „+ Adaugă «query»" — creează element nou cu numele din
  query.
- Dispare imediat ce căutarea produce rezultate sau câmpul e gol.

---

## 6. Ce NU face picker-ul (anti-pattern-uri interzise)

| Anti-pattern | Regulă |
|---|---|
| Bottom-sheet cu **propriul** input de căutare (input separat, în interiorul sheet-ului) | **INTERZIS.** Căutarea trece mereu prin BottomBar — sheet-ul primește rezultatele filtrate, nu un câmp propriu. |
| Long-press / touch susținut pe element | **INTERZIS.** Nu există nicăieri în aplicație. Opțiunile per element se accesează prin alte mecanisme (meniu pagină, navigare în element, etc.). |
| Picker care duplică logica de căutare | **INTERZIS.** Orice căutare importă `filterAndSort` din `src/lib/search.js`. |
| `position: fixed` pe elemente flotante în interiorul `AppShell` | **INTERZIS.** `AppShell` e deja `fixed` — descendenții flotanți (FAB, toast, bottom-sheet) trebuie să fie `absolute`, nu `fixed`, ca să se poziționeze relativ la containerul redimensionat, nu la viewport-ul real. |

---

## 7. Starea actuală vs. direcția

| Aspect | Cod actual | Direcție corectă |
|---|---|---|
| `CatalogPage` | Logică ad-hoc de căutare (`filterAndSort` importat direct, fără `usePicker`) | Instanțiază `usePicker({ items, multiSelect: false, allowCreate: true })` |
| `usePicker` | Implementat complet, neimportat nicăieri | Consumat de fiecare pagină care are căutare |
| Algoritm în `usePicker.js` | Importă `scoreMatch` din `search.js` (versiunea cu diacritice + substring) | Corect — deja aliniat |
| Picker UI standalone | Nu există | De construit când vine Cart / mutare categorie |

---

## 8. Instrucțiuni pentru agentul Claude Code

1. **`usePicker` devine consumatorul unic al `filterAndSort`.** `CatalogPage` (și orice
   viitoare pagină cu căutare) instanțiază hook-ul în loc să apeleze `filterAndSort` direct.
   Logica ad-hoc din `CatalogPage` (`searchableNodes`, `searchMatches`,
   `handleCreateFromSearch`) trebuie migrată să treacă prin hook.
2. **Algoritmul canonic e cel din `src/lib/search.js`** — cu normalizare NFD, substring
   fallback pentru tokeni ≥2 caractere, AND logic. Nu duplica logica și nu menține două
   implementări.
3. **Construiește componenta UI standalone** (full-screen picker) doar când vine primul
   consumator real (Cart, mutare categorie). Până atunci, modul inline e suficient.
4. **BottomBar** — extrage mapping-ul icon/acțiune per pagină într-o structură declarativă
   (`navItems.js` sau echivalent), nu `if/else` pe rută.
5. **FAB** — rămâne randat de pagină (nu de hook), dar condiționat de starea hook-ului
   (`filteredItems.length === 0 && query.length > 0 && allowCreate`).
6. **Bottom-sheet cu/fără căutare** — `BottomSheet.jsx` primește un prop (ex: `showSearch`)
   care controlează dacă BottomBar-ul rămâne vizibil sau se ascunde. Logica de comutare a
   contextului de căutare (de la pagină la sheet și înapoi) trebuie gestionată la nivel de
   hook/store, nu hardcodat în `BottomSheet`.

---

*v2 — rescris integral: algoritm aliniat la codul real (diacritice NFD, substring fallback
rank 2, tokeni single-char doar prefix); două moduri de operare (inline + standalone);
BottomBar cu icon/meniu contextual per pagină; bottom-sheet cu/fără căutare (două moduri);
long-press interzis explicit; FAB documentat; anti-pattern-uri codificate.*
