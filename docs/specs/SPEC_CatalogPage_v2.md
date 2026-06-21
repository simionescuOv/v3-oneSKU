# oneSku — SPEC Catalog Page v2

> **v2** — rescris după auditul de cod (`CURRENT_STATE_CATALOG.md`). Reflectă starea reală a
> implementării, integrează deciziile confirmate în chat, și marchează clar ce e implementat
> vs. ce e de construit.
>
> Înlocuiește `SPEC_CatalogPage.md` (v1).
>
> Dependență: `SPEC_Picker_v2.md` (hook-ul `usePicker` și regulile BottomBar).

---

## 0. Rolul paginii

Pagina Catalog gestionează **arborele de categorii** al tenantului. E o pagină de
**administrare** (gestiune), nu de consultare — utilizatorul creează, organizează, mută,
șterge categorii și foldere.

**Contrast cu StockHub:** în Catalog navighezi pe categorii (intri în foldere, vezi
categoriile-frunză); în StockHub vezi produse-first și filtrezi pe categorie din dialog
(vezi ARCHITECTURE.md §6.4).

---

## 1. Structura arborelui

| Tip nod | Rol | Poate avea copii | Poate avea produse |
|---|---|---|---|
| `folder` | Organizare ierarhică, N nivele de adâncime | Da (foldere sau categorii) | Nu |
| `category` | Frunză — conține produsele | Nu (e mereu frunză) | Da |

- **Navigare:** tap pe folder → intri în folder (afișezi copiii). Tap pe categorie →
  navighezi în pagina categoriei (produse, schema de atribute).
- **Back:** buton săgeată stânga în TopBar sau gesture de back → urcă un nivel.
- **Breadcrumb:** afișat în TopBar, arată calea curentă (ex: `Catalog > Electronice > Telefoane`).

---

## 2. Layout — listă verticală

> **Stare actuală:** implementat ca **listă verticală** cu rânduri (`divide-y`), nu grid
> de carduri 2 coloane.
>
> **Decizie inițială (v1):** grid 2 coloane, stil eMAG mobile.
>
> **Status:** lista verticală a fost adoptată în implementare și funcționează. Dacă se
> revine la grid, e o decizie separată de UI, nu de arhitectură — nu blochează nimic.

Fiecare rând (`NodeCard`) afișează:
- Icon: `Folder` / `FolderOpen` pentru foldere, `Tag` pentru categorii.
- Nume.
- Tap → navighează (intri în folder sau în categorie).
- **Nu există** icon de meniu, buton de opțiuni, sau alt handler pe card în afară de
  `onClick`. **Nu există long-press.**

---

## 3. Empty state

Când catalogul e gol (nicio categorie, niciun folder):
- Afișează text explicativ care instruiește utilizatorul să scrie în bara de căutare
  pentru a adăuga prima categorie.
- **Nu există buton CTA vizibil** (v1 prevedea un buton „Adaugă prima categorie" —
  a fost înlocuit cu instrucțiunea de a folosi search bar-ul).

---

## 4. Căutare — alimentată de `usePicker`

### 4.1 Configurație

```
usePicker({
  items: categorii + foldere din nivelul curent (sau tot arborele dacă search e activ),
  labelFn: (node) => node.name,
  multiSelect: false,
  allowCreate: true
})
```

### 4.2 Comportament

- La tastare în BottomBar, hook-ul filtrează **toate** nodurile (nu doar nivelul curent) —
  căutarea e **globală** în arbore.
- Rezultatele sunt regrupate ierarhic (`buildSearchTree`): fiecare rezultat e afișat sub
  folderul-ancestor, ca utilizatorul să înțeleagă contextul.
  - Folder ancestor care **nu** e el însuși rezultat → header static (necliccabil).
  - Folder care **e** rezultat → rând apăsabil (tap navighează în el).
- La `allowCreate + zero rezultate`:
  - Rând inline „+ Adaugă «query»" în listă.
  - FAB button deasupra BottomBar-ului (target de tap accesibil).
  - Ambele fac același lucru: creează categorie nouă cu numele din query, în folderul
    curent (`currentFolderId`).
  - Dacă numele există deja → toast „Categoria există deja".

### 4.3 Ce caută

- **Categorii** (`node_type = 'category'`).
- **Foldere** (`node_type = 'folder'`).
- Ambele, simultan — query `"î"` găsește folderul „Îmbrăcăminte".

---

## 5. Meniul contextual (buton din BottomBar)

### 5.1 Declanșare

- Butonul din dreapta BottomBar-ului, cu icon `BookOpen` (specific paginii Catalog).
- Tap → deschide bottom-sheet **fără căutare** (BottomBar se ascunde — e un meniu
  simplu cu opțiuni, nu o listă de filtrat).
- **NU există long-press** și **NU există meniu per-element** pe carduri.

### 5.2 Conținut (stare implementată)

```
┌──────────────────────────────┐
│ ▸ Config                     │  ← acordeon, tap expandează/colapsează
│   ├── 🔲 Grupare             │  ← stub (toast „în curând")
│   └── 📂 Mutare              │  ← stub (toast „în curând")
│                              │
│ 📖 Unfold / 📕 Fold          │  ← toggle tree view
└──────────────────────────────┘
```

### 5.3 Opțiuni planificate (de conectat la UI)

Logica e implementată în `useCatalogStore` dar neconectată la interfață:

| Opțiune | Logică în store | UI status |
|---|---|---|
| **Grupare** | `groupNodes(nodeIds, folderName)` | Stub — necesită: mod selecție, action-bar, picker denumire. Doar la rădăcină, min 2 elemente negrupate |
| **Mutare** | `moveNodes(nodeIds, destinationId)` + `getValidMoveDestinations(nodeId)` (anti-ciclu) | Stub — necesită: mod selecție, picker destinație (standalone, `multiSelect=false`, `allowCreate=false`) |
| **Ștergere categorie** | `deleteCategory(id)` → soft-delete (`deleted_at`) | Neconectat — va fi accesat din pagina categoriei, nu din meniul Catalog |
| **Ștergere folder** | `deleteFolder(id)` → promovează conținut la părinte, apoi șterge | Neconectat — confirmare necesară înainte de execuție |

### 5.4 Unfold / Fold (feature nou, v1 nu-l conținea)

- Toggle între vizualizarea normală (navigare pe foldere) și o vizualizare **tree complet**
  (toate nodurile, recursiv, indentat, de la rădăcină).
- Stare: `useCatalogStore.treeExpanded` + `toggleTreeExpanded()`.
- Când e activ:
  - Pagina randează `FullTree` — ignoră breadcrumb-ul și navigarea pe foldere.
  - Rândurile din tree sunt **doar vizuale** (fără tap) — scopul e orientarea rapidă,
    nu navigarea.
- Icon comutator: `UnfoldVertical` (activare) / `FoldVertical` (dezactivare).

---

## 6. Operații organizatorice — specificații de comportament

### 6.1 Grupare

- **Disponibilă doar la nivel de rădăcină** (nu în interiorul unui folder).
- **Minim 2 elemente negrupate** trebuie să existe pentru a activa opțiunea.
- Flux:
  1. Utilizatorul activează „Grupare" din meniu.
  2. Pagina intră în **mod selecție**: cardurile devin selectabile (checkbox/highlight).
  3. Utilizatorul selectează ≥2 elemente.
  4. Action-bar apare (jos sau sus) cu buton „Grupează".
  5. La confirmare → picker denumire (input simplu pentru numele folderului nou).
  6. Se creează folderul, elementele selectate devin copiii lui.

### 6.2 Mutare

- **Orice element** poate fi mutat (categorie sau folder întreg).
- Flux:
  1. Utilizatorul activează „Mutare" din meniu.
  2. Mod selecție → selectează elementul de mutat.
  3. Se deschide **picker standalone** (`multiSelect=false`, `allowCreate=false`)
     cu lista de foldere valide ca destinații.
  4. **Anti-ciclu:** un nod nu poate fi mutat în el însuși sau într-un descendent al
     lui. Picker-ul primește doar destinațiile valide (calculate cu
     `getValidMoveDestinations`).
  5. La confirmare → `parent_id` al nodului se actualizează.
- La migrarea pe Supabase, anti-ciclul se enforțează server-side prin RPC
  (vezi `SPEC_CatalogRPC.md`).

### 6.3 Ștergere categorie (soft-delete + recuperare temporară)

- Categoriile nu se șterg definitiv imediat — trec prin **soft-delete** (`deleted_at = now()`).
- Categoria dispare din listele active.
- **Recuperare:** pe o perioadă scurtă de timp, categoria poate fi restaurată.
  La restaurare, `parent_id → null` (revine la rădăcină, nu la locația originală —
  folderul original ar fi putut fi șters/mutat între timp).
- **Mecanismul de acces la Trash și durata de retenție** — de definit la implementare.
  Nu e o funcționalitate complexă: scopul e protecție contra ștergerii accidentale
  sau a răzgândirii imediate, nu un sistem elaborat de arhivare.

### 6.4 Ștergere folder (hard-delete + promovare)

- Folderele **nu** au soft-delete — se șterg imediat.
- La ștergere:
  - **Folder cu conținut:** prompt de confirmare → conținutul (copiii) se
    **promovează la părintele folderului** (`parent_id` copiilor ← `parent_id`
    folderului), apoi folderul se șterge.
  - **Folder gol:** prompt „Păstrezi sau ștergi?" → ștergere directă.
- La migrarea pe Supabase, `ON DELETE RESTRICT` pe `parent_id` garantează că
  promovarea trebuie să fi rulat înainte de DELETE — plasa de siguranță
  (vezi `SPEC_DatabaseSchema_v2.md` §0.3).

---

## 7. Fișiere relevante (referință rapidă)

| Fișier | Rol |
|---|---|
| `src/pages/CatalogPage.jsx` | Pagina — căutare, meniu, FAB, tree view |
| `src/lib/search.js` | `normalize`, `scoreMatch`, `filterAndSort` (algoritm canonic) |
| `src/hooks/usePicker.js` | Hook generic — de conectat la CatalogPage |
| `src/components/shell/BottomBar.jsx` | Search input + buton icon dinamic |
| `src/components/shell/AppShell.jsx` | Layout fix, `visualViewport` |
| `src/hooks/useViewportHeight.js` | Hook pt. dimensionare AppShell la tastatură |
| `src/components/catalog/BottomSheet.jsx` | Primitivă bottom-sheet (backdrop + panel) |
| `src/components/catalog/NodeCard.jsx` | Rând folder/categorie, doar `onClick` |
| `src/store/useCatalogStore.js` | Zustand: CRUD, tree ops, trash — implementate |
| `src/lib/navItems.js` | Mapping icon/acțiune per pagină pentru BottomBar |

---

## 8. Anti-pattern-uri (din v1 și din experiența de implementare)

| Anti-pattern | Status |
|---|---|
| Long-press pe card pentru meniu contextual | **INTERZIS DEFINITIV** — nu a existat niciodată în cod, a fost idee de spec respinsă |
| Bottom-sheet cu **propriul** input de căutare separat | **INTERZIS** — căutarea trece mereu prin BottomBar (care rămâne vizibil sau nu, în funcție de modul sheet-ului) |
| `translateY` pe BottomBar legat de tastatură | **INTERZIS** — singurul `translateY` e hide/show la scroll |
| `position: fixed` pe FAB/toast/sheet în interiorul AppShell | **INTERZIS** — folosește `absolute` (AppShell e deja `fixed`) |
| Grid 2 coloane ca decizie arhitecturală | **DESCHIS** — codul are listă; grid-ul e o posibilitate de UI, nu o constrângere |

---

## 9. Instrucțiuni pentru agentul Claude Code

1. **Conectează `usePicker` la `CatalogPage`**: înlocuiește logica ad-hoc de căutare
   (`searchableNodes`, `searchMatches`, `handleCreateFromSearch`) cu o instanțiere de
   `usePicker`. Comportamentul vizibil rămâne identic — refactoring intern, nu schimbare
   de funcționalitate.
2. **Unfold/Fold** — e deja implementat și funcțional. Documentează-l în `STATUS.md`
   dacă nu e acolo.
3. **Operațiile organizatorice** (Grupare, Mutare, Ștergere) — logica e în store.
   Când conectezi la UI, respectă fluxurile din §6 (mod selecție → picker/confirmare →
   acțiune). **Nu inventa mecanisme de interacțiune noi** — folosește ce e descris aici.
4. **La migrarea pe Supabase:** logica de tree din `useCatalogStore` (`moveNodes`,
   `deleteFolder`, `restoreFromTrash`) se mută în RPC-uri server-side
   (vezi `SPEC_CatalogRPC.md`). Store-ul devine client simplu care apelează RPC-urile.
5. **Nu readăuga long-press** — sub nicio formă, pe nicio componentă.
6. **Trash-ul e simplu:** soft-delete + posibilitate de recuperare. Nu construi un
   sistem elaborat de management al Trash-ului — scopul e protecție contra greșelilor,
   nu arhivare.

---

*v2 — rescris integral: aliniat la codul real (listă nu grid, FAB, meniu pagină nu
long-press, Unfold/Fold documentat, empty state fără buton CTA); long-press interzis
definitiv; Trash simplificat (soft-delete + recuperare, fără management elaborat);
bottom-sheet cu/fără căutare (două moduri); referințe la fișierele reale din repo;
dependință explicită de SPEC_Picker_v2.*
