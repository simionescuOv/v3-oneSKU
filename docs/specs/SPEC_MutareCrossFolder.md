# oneSku — SPEC Mutare Cross-Folder (Unfold Mode)

> Funcționalitate nouă: selecție de noduri din foldere diferite și mutarea lor
> într-o destinație comună, cu opțiunea de a crea un subfolder la destinație.
>
> Implementare pe branch: `mutare-mod-unfold`
>
> Dependențe: `SPEC_CatalogPage_v2.md`, `SPEC_CatalogRPC.md`, `SPEC_DatabaseSchema_v2.md`

---

## 1. Modificare schemă DB

### 1.1 Coloană nouă pe `categories`

```sql
-- Migration: 011_categories_is_temp.sql
alter table categories
  add column is_temp boolean not null default false;

-- Index pentru cleanup și filtrare
create index idx_categories_is_temp on categories(tenant_id) where is_temp = true;
```

**Regula:** orice query care afișează noduri în UI adaugă `and is_temp = false`.
Folderele temporare nu sunt niciodată vizibile utilizatorului — nici în navigare,
nici în Unfold, nici în picker-ul de destinație.

---

## 2. RPC-uri noi (Supabase)

### 2.1 `create_temp_folder` — creare folder temporar la rădăcină

```sql
create or replace function create_temp_folder(
  p_tenant_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_folder_id uuid;
begin
  insert into categories (tenant_id, parent_id, name, node_type, is_temp, position)
  values (
    p_tenant_id,
    null,
    '__temp_' || gen_random_uuid()::text,
    'folder',
    true,
    -1  -- poziție negativă: nu interferează cu ordinea nodurilor reale
  )
  returning id into v_folder_id;

  return v_folder_id;
end $$;
```

### 2.2 `dissolve_temp_folder` — desfășoară conținut și șterge folderul temporar

Promovează copiii folderului temporar la părintele său (destinația aleasă de utilizator),
apoi șterge folderul temporar. Reutilizează logica din `delete_folder`.

```sql
create or replace function dissolve_temp_folder(
  p_tenant_id  uuid,
  p_folder_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_parent_id uuid;
  v_is_temp   boolean;
begin
  select parent_id, is_temp into v_parent_id, v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Folderul temporar % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  -- Promovează copiii la părintele folderului temporar (destinația finală)
  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = p_tenant_id;

  -- Șterge folderul temporar (RESTRICT garantează că promovarea a rulat)
  delete from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;
end $$;
```

### 2.3 `promote_temp_folder` — transformă folderul temporar în subfolder permanent

```sql
create or replace function promote_temp_folder(
  p_tenant_id  uuid,
  p_folder_id  uuid,
  p_new_name   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_is_temp boolean;
begin
  select is_temp into v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Folderul % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  if p_new_name is null or trim(p_new_name) = '' then
    raise exception 'Numele subfolderului nu poate fi gol';
  end if;

  update categories
     set is_temp = false,
         name    = trim(p_new_name)
   where id = p_folder_id
     and tenant_id = p_tenant_id;
  -- Unicitatea numelui la același nivel e enforțată de uq_categories_sibling_name
end $$;
```

### 2.4 `cleanup_temp_folders` — curățare de siguranță

Șterge folderele temporare rămase orfane (crash în mijlocul fluxului, sesiune abandonată).
De apelat la mount-ul aplicației sau periodic.

```sql
create or replace function cleanup_temp_folders(
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  -- Mută întâi copiii la rădăcină (dacă există — caz de crash după mutare parțială)
  update categories
     set parent_id = null
   where parent_id in (
     select id from categories
      where tenant_id = p_tenant_id
        and is_temp = true
   )
   and tenant_id = p_tenant_id;

  -- Șterge folderele temporare goale
  delete from categories
   where tenant_id = p_tenant_id
     and is_temp = true;
end $$;
```

---

## 3. Modificări UI — `CatalogPage.jsx`

### 3.1 Activarea modului Mutare

Opțiunea „Mutare" din meniul contextual (bottom-sheet-ul paginii Catalog):
- Dacă `treeExpanded = false` → setează `treeExpanded = true` automat
- Setează `selectionMode = 'move'` în store
- Închide bottom-sheet-ul meniului
- Pagina intră în mod selecție

### 3.2 Modul selecție în Unfold

Când `selectionMode = 'move'` și `treeExpanded = true`:
- Fiecare nod din `FullTree` afișează un **checkbox** în stânga
- Toate nodurile sunt selectabile, indiferent de folderul din care fac parte
- Nodurile cu `is_temp = true` sunt filtrate din tree (nu apar, nu sunt selectabile)
- **ActionBar** apare deasupra BottomBar-ului cu: `[X Anulează]` și `[Mută (N) →]`
  - N = numărul de noduri selectate
  - „Mută" e dezactivat dacă N = 0

### 3.3 Fluxul complet la apăsarea „Mută (N)"

```
1. apel RPC: create_temp_folder(tenant_id)
   → returnează temp_folder_id

2. pentru fiecare nod selectat:
   apel RPC: move_node(tenant_id, node_id, temp_folder_id)
   (anti-ciclul existent validează fiecare mutare individual)

3. se deschide DestinationPicker (bottom-sheet, vezi §3.4)

4. utilizatorul alege destinația → destination_id

5. apel RPC: move_node(tenant_id, temp_folder_id, destination_id)
   → folderul temporar ajunge la destinație

6. se deschide SubgroupSheet (bottom-sheet, vezi §3.5)
```

### 3.4 DestinationPicker — bottom-sheet destinație

- Bottom-sheet **cu căutare** (BottomBar rămâne vizibil, filtrează lista de destinații)
- Lista: toți folderii validi returnați de `get_valid_move_targets(tenant_id, temp_folder_id)`
  - Folderul temporar e exclus automat de RPC (e propriul său descendent virtual)
  - Nodurile cu `is_temp = true` sunt excluse din lista returnată de RPC
- Selecție unică (`multiSelect = false`, `allowCreate = false`)
- La tap pe destinație → confirmă și continuă la pasul 5 din §3.3

### 3.5 SubgroupSheet — bottom-sheet „New sub-group?"

Bottom-sheet **fără căutare** (BottomBar se ascunde). Conține două stări vizuale
în același sheet — nu se deschide un sheet nou.

**Starea inițială:**

```
┌──────────────────────────────────┐
│                                  │
│   New sub-group?                 │
│                                  │
│   [  Nu  ]      [  Da  ]         │
│                                  │
└──────────────────────────────────┘
```

**La tap „Da" — sheet-ul se extinde (același sheet, fără tranziție de navigare):**

```
┌──────────────────────────────────┐
│                                  │
│   New sub-group?                 │
│                                  │
│   ┌──────────────────────────┐   │
│   │ Nume subfolder...        │   │
│   └──────────────────────────┘   │
│                                  │
│   [Anulează]      [Creează]      │
│                                  │
└──────────────────────────────────┘
```

- Inputul de nume apare prin animație (expand) în același sheet
- „Creează" e dezactivat dacă inputul e gol
- La „Creează" → `promote_temp_folder(tenant_id, temp_folder_id, new_name)`
- La „Nu" → `dissolve_temp_folder(tenant_id, temp_folder_id)`
- La „Anulează" (din starea extinsă) → revine la starea inițială (nu închide sheet-ul)

**La finalizare (oricare variantă):**
- Sheet-ul se închide
- `selectionMode = null`
- `treeExpanded` rămâne `true` (utilizatorul vede rezultatul mutării în Unfold)
- Toast: „N elemente mutate" (+ „în subfolderul «Nume»" dacă s-a creat subfolder)

### 3.6 Anulare flux

La apăsarea „X Anulează" din ActionBar (înainte de a apăsa „Mută"):
- `selectionMode = null`
- Selecția se golește
- `treeExpanded` rămâne `true`
- **Nu** se creează niciun folder temporar (acesta se creează abia la pasul „Mută")

Dacă utilizatorul iese din aplicație sau dă back **după** crearea folderului temporar
(între pașii 1-6 din §3.3): `cleanup_temp_folders` apelat la remount curăță automat.

---

## 4. Modificări store — `useCatalogStore.js`

State nou:
```js
selectionMode: null,          // null | 'move'
selectedNodeIds: new Set(),   // Set<uuid>
```

Acțiuni noi:
```js
setSelectionMode(mode)        // 'move' | null
toggleNodeSelection(nodeId)   // adaugă/scoate din Set
clearSelection()              // golește Set
```

---

## 5. Modificări query-uri existente

**Orice query / selector care returnează noduri pentru UI** adaugă condiția:

```js
// Client-side (Zustand local):
.filter(node => !node.is_temp)

// Supabase query:
.eq('is_temp', false)
```

Locuri afectate:
- `useCatalogStore` — toți selectorii care returnează noduri
- `get_valid_move_targets` RPC — adaugă `and c.is_temp = false` în CTE-ul `folders`
- `FullTree` component — filtrează înainte de randare
- Breadcrumb — filtrează ancestorii

---

## 6. Ordinea de implementare recomandată

```
1. Migration 011_categories_is_temp.sql
2. RPC-uri noi (adăugate în 009_rpc_functions.sql sau fișier nou 012_rpc_move_cross.sql)
3. Actualizare get_valid_move_targets — adaugă filtru is_temp
4. Actualizare store — state selectionMode + selectedNodeIds + acțiuni
5. Actualizare FullTree — checkbox în selectionMode, filtru is_temp
6. ActionBar component (deasupra BottomBar, vizibil când selectionMode activ)
7. DestinationPicker bottom-sheet
8. SubgroupSheet bottom-sheet (cu expandare inline la „Da")
9. Conectare flux complet în CatalogPage
10. cleanup_temp_folders apelat în useEffect la mount CatalogPage
```

---

## 7. Cazuri limită

| Caz | Comportament |
|---|---|
| Utilizatorul selectează un folder și un copil al lui | Ambele se mută în temp folder. La `move_node` pe copil după ce părintele e deja în temp folder: copilul e acum la rădăcina temp-ului (mutat odată cu părintele). Rezultat: structura ierarhică originală se păstrează în temp folder — e corect. |
| Selecție de 1 singur element | Flux identic — nu există caz special pentru un singur element. |
| Destinație = rădăcina catalogului | `destination_id = null` în `move_node`. Valid — folderul temporar ajunge la rădăcină, SubgroupSheet apare normal. |
| `promote_temp_folder` eșuează (nume duplicat la destinație) | Eroare de unicitate din DB. Toast cu eroarea. Sheet-ul rămâne deschis, utilizatorul poate schimba numele. |
| Crash după pasul 1 (temp folder creat, nicio mutare) | `cleanup_temp_folders` la remount șterge folderul gol. |
| Crash după pasul 2 (unele noduri mutate în temp) | `cleanup_temp_folders` promovează copiii la rădăcină, șterge temp. Nodurile selectate parțial ajung la rădăcina catalogului — utilizatorul le vede și le poate remuta. |

---

*SPEC_MutareCrossFolder — branch: `mutare-mod-unfold`. Dependențe: schema v2 + RPC catalog existente.*
