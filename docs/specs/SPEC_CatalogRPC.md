# oneSku — SPEC Catalog RPC (Supabase server-side functions)

> Funcțiile de business care nu pot fi enforțate prin constrângeri SQL simple și trebuie
> implementate ca **RPC-uri Supabase** (funcții `plpgsql` apelabile din client via
> `supabase.rpc()`).
>
> Dependență: `SPEC_DatabaseSchema_v2.md` (schema tabelelor, triggerele de validare,
> `ON DELETE RESTRICT` pe `parent_id`).
>
> Fiecare funcție e descrisă cu: scop, pre-condiții, algoritm SQL, post-condiții,
> tratarea erorilor.

---

## 0. Context

Logica de arbore din `useCatalogStore.js` (Zustand) operează acum pe date locale.
La migrarea pe Supabase, aceste operații se mută server-side ca funcții RPC, iar store-ul
devine un client simplu:

```js
// Înainte (Zustand local):
moveNodes(nodeId, destinationId)

// După (Supabase RPC):
const { error } = await supabase.rpc('move_node', {
  p_node_id: nodeId,
  p_new_parent_id: destinationId
})
```

**De ce server-side, nu client-side?**
- Anti-ciclul necesită un query recursiv pe arborele complet — e o operație de citire +
  validare + scriere care trebuie să fie **atomică** (într-o singură tranzacție).
- Promovarea la ștergere folder necesită update pe copii + delete pe folder în aceeași
  tranzacție — dacă se face din client în doi pași, un crash între ei lasă date inconsistente.
- `ON DELETE RESTRICT` pe `parent_id` (din schema v2) va **bloca** orice DELETE pe un nod
  care mai are copii — promovarea trebuie să fi rulat **în aceeași tranzacție**.

---

## 1. `move_node` — mutare cu anti-ciclu

### Scop

Mută un nod (folder sau categorie) sub un alt părinte, cu validarea că destinația nu e
nodul însuși sau un descendent al lui (anti-ciclu).

### Semnătură

```sql
create or replace function move_node(
  p_tenant_id   uuid,
  p_node_id     uuid,
  p_new_parent_id uuid  -- null = mută la rădăcină
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_parent_id uuid;
begin
  -- 1. Verifică existența nodului și apartenența la tenant
  select parent_id into v_current_parent_id
    from categories
   where id = p_node_id
     and tenant_id = p_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Nodul % nu există sau e șters', p_node_id;
  end if;

  -- 2. Dacă destinația e aceeași cu părintele curent, nu face nimic
  if p_new_parent_id is not distinct from v_current_parent_id then
    return;
  end if;

  -- 3. Dacă destinația nu e null (nu e rădăcina), validează:
  if p_new_parent_id is not null then

    -- 3a. Destinația există, aparține aceluiași tenant, nu e ștearsă
    if not exists (
      select 1 from categories
       where id = p_new_parent_id
         and tenant_id = p_tenant_id
         and deleted_at is null
    ) then
      raise exception 'Destinația % nu există sau e ștearsă', p_new_parent_id;
    end if;

    -- 3b. Destinația trebuie să fie folder, nu categorie (categoriile sunt frunze)
    if (select node_type from categories where id = p_new_parent_id) = 'category' then
      raise exception 'Destinația % este o categorie (frunză), nu poate avea copii', p_new_parent_id;
    end if;

    -- 3c. Anti-ciclu: destinația NU e nodul însuși sau un descendent al lui
    if p_new_parent_id = p_node_id then
      raise exception 'Un nod nu poate fi mutat în el însuși';
    end if;

    if exists (
      with recursive descendants as (
        select id from categories where parent_id = p_node_id
        union all
        select c.id from categories c
          join descendants d on c.parent_id = d.id
      )
      select 1 from descendants where id = p_new_parent_id
    ) then
      raise exception 'Destinația % este un descendent al nodului % — mutarea ar crea un ciclu',
        p_new_parent_id, p_node_id;
    end if;
  end if;

  -- 4. Efectuează mutarea
  update categories
     set parent_id = p_new_parent_id,
         position = coalesce(
           (select max(position) + 1 from categories
             where tenant_id = p_tenant_id
               and parent_id is not distinct from p_new_parent_id
               and deleted_at is null),
           0
         )
   where id = p_node_id;
end $$;
```

### Post-condiții

- Nodul are `parent_id` = destinația.
- `position` = ultimul din noul părinte (apare la sfârșitul listei).
- `updated_at` actualizat automat (trigger `moddatetime`).
- Dacă destinația era invalidă → excepție, nicio modificare.

### Mapping la store

| Store (Zustand) | RPC |
|---|---|
| `moveNodes(nodeIds, destinationId)` | `move_node(tenant_id, node_id, new_parent_id)` — apelat per nod |
| `getValidMoveDestinations(nodeId)` | Nu mai e necesar ca funcție separată — validarea e în RPC. Totuși, pentru UI (picker-ul de destinații), clientul poate apela `get_valid_move_targets` (vezi §1.1). |

### 1.1 `get_valid_move_targets` — helper pentru UI picker

```sql
create or replace function get_valid_move_targets(
  p_tenant_id   uuid,
  p_node_id     uuid
)
returns table (id uuid, parent_id uuid, name text, depth integer)
language sql
stable
security definer
as $$
  with recursive
    -- Descendenții nodului (excluși din destinații)
    excluded as (
      select id from categories where id = p_node_id
      union all
      select c.id from categories c join excluded e on c.parent_id = e.id
    ),
    -- Toți folderii tenantului, cu adâncime
    folders as (
      select c.id, c.parent_id, c.name, 0 as depth
        from categories c
       where c.tenant_id = p_tenant_id
         and c.node_type = 'folder'
         and c.deleted_at is null
         and c.parent_id is null
      union all
      select c.id, c.parent_id, c.name, f.depth + 1
        from categories c
        join folders f on c.parent_id = f.id
       where c.node_type = 'folder'
         and c.deleted_at is null
    )
  select f.id, f.parent_id, f.name, f.depth
    from folders f
   where f.id not in (select id from excluded)
   order by f.depth, f.name;
$$;
```

Returnează toate folderele valide ca destinații (fără nodul însuși și descendenții lui),
cu `depth` pentru indentare în picker UI.

---

## 2. `delete_folder` — ștergere folder cu promovare conținut

### Scop

Șterge un folder, promovând toți copiii (foldere și categorii) la părintele folderului.
**Nu e soft-delete** — rândul folder se șterge definitiv.

### Semnătură

```sql
create or replace function delete_folder(
  p_tenant_id   uuid,
  p_folder_id   uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type   text;
  v_parent_id   uuid;
begin
  -- 1. Verifică existența și tipul
  select node_type, parent_id into v_node_type, v_parent_id
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Folderul % nu există sau e șters', p_folder_id;
  end if;

  if v_node_type <> 'folder' then
    raise exception 'Nodul % nu este un folder (este %)', p_folder_id, v_node_type;
  end if;

  -- 2. Promovează copiii la părintele folderului
  --    (parent_id copiilor ← parent_id folderului)
  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = p_tenant_id;

  -- 3. Șterge folderul
  --    ON DELETE RESTRICT pe parent_id garantează că dacă promovarea
  --    nu a rulat (bug), DELETE-ul eșuează — plasă de siguranță.
  delete from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;
end $$;
```

### Post-condiții

- Copiii folderului au `parent_id` = fostul părinte al folderului (sau `null` dacă
  folderul era la rădăcină).
- Rândul folder nu mai există.
- `updated_at` al copiilor actualizat automat.
- Dacă folderul nu exista sau nu era folder → excepție, nicio modificare.

### Plasă de siguranță

Dacă din orice motiv promovarea din pasul 2 nu se execută (bug, eroare parțială), pasul 3
va eșua cu eroarea de FK `RESTRICT` — nu se poate șterge un nod care mai are copii.
Tranzacția e implicit atomică (ambele operații în aceeași funcție = aceeași tranzacție PG).

### Mapping la store

| Store (Zustand) | RPC |
|---|---|
| `deleteFolder(id)` | `delete_folder(tenant_id, folder_id)` |

---

## 3. `soft_delete_category` — trimitere în Trash

### Scop

Marchează o categorie ca ștearsă (soft-delete). Produsele rămân atașate — nu se șterg.
Scopul e protecția contra ștergerilor accidentale sau a răzgândirilor imediate.

```sql
create or replace function soft_delete_category(
  p_tenant_id    uuid,
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type text;
begin
  select node_type into v_node_type
    from categories
   where id = p_category_id
     and tenant_id = p_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Categoria % nu există sau e deja ștearsă', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Nodul % nu este o categorie (este %) — folderele nu au soft-delete',
      p_category_id, v_node_type;
  end if;

  update categories
     set deleted_at = now()
   where id = p_category_id
     and tenant_id = p_tenant_id;
end $$;
```

### Post-condiții

- `deleted_at` setat la momentul curent.
- Categoria dispare din listele „live" (orice query corect filtrează `deleted_at is null`).
- Produsele rămân atașate (`products.category_id` neschimbat) — se pot restaura odată cu
  categoria.

---

## 4. `restore_from_trash` — restaurare la rădăcină

### Scop

Restaurează o categorie din Trash. Conform arhitecturii, restaurarea merge **la rădăcină**,
nu la locația originală — folderul original ar fi putut fi șters/mutat între timp.

```sql
create or replace function restore_from_trash(
  p_tenant_id    uuid,
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type text;
  v_deleted_at timestamptz;
begin
  select node_type, deleted_at into v_node_type, v_deleted_at
    from categories
   where id = p_category_id
     and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Categoria % nu există', p_category_id;
  end if;

  if v_deleted_at is null then
    raise exception 'Categoria % nu este în Trash', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Doar categoriile pot fi restaurate din Trash (nodul % este %)',
      p_category_id, v_node_type;
  end if;

  update categories
     set deleted_at = null,
         parent_id = null,   -- restaurare LA RĂDĂCINĂ, nu la locația originală
         position = coalesce(
           (select max(position) + 1 from categories
             where tenant_id = p_tenant_id
               and parent_id is null
               and deleted_at is null),
           0
         )
   where id = p_category_id
     and tenant_id = p_tenant_id;
end $$;
```

### Post-condiții

- `deleted_at` = null, `parent_id` = null (rădăcină).
- `position` = ultimul la rădăcină (apare la sfârșitul listei).
- Produsele categoriei redevin vizibile (nu au fost șterse, doar categoria era ascunsă).

---

## 5. `create_category` — creare cu validare

### Scop

Creează un nod (folder sau categorie) cu validările necesare — nu e un simplu INSERT.

```sql
create or replace function create_category(
  p_tenant_id   uuid,
  p_parent_id   uuid,        -- null = la rădăcină
  p_name        text,
  p_node_type   text          -- 'folder' sau 'category'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
begin
  -- 1. Validare node_type
  if p_node_type not in ('folder', 'category') then
    raise exception 'node_type invalid: %', p_node_type;
  end if;

  -- 2. Dacă are părinte, verifică că părintele e folder (nu categorie)
  if p_parent_id is not null then
    if not exists (
      select 1 from categories
       where id = p_parent_id
         and tenant_id = p_tenant_id
         and node_type = 'folder'
         and deleted_at is null
    ) then
      raise exception 'Părintele % nu există, nu e folder, sau e șters', p_parent_id;
    end if;
  end if;

  -- 3. Insert (unicitatea globală e enforțată de indexul uq_categories_global_name)
  insert into categories (tenant_id, parent_id, name, node_type, position)
  values (
    p_tenant_id,
    p_parent_id,
    p_name,
    p_node_type,
    coalesce(
      (select max(position) + 1 from categories
        where tenant_id = p_tenant_id
          and parent_id is not distinct from p_parent_id
          and deleted_at is null),
      0
    )
  )
  returning id into v_new_id;

  return v_new_id;
end $$;
```

### Tratarea duplicatelor

Indexul `uq_categories_global_name` (din schema v2, IMPL_GrupareMutare §A1) va
arunca o eroare de unicitate dacă un nod cu același nume există deja oriunde în
arborele tenantului (printre cele neșterse), indiferent de părinte. Clientul
prinde eroarea și afișează toast „Categoria/Folderul există deja".

---

## 6. `group_nodes` — grupare (creare folder + mutare copii)

### Scop

Creează un folder nou și mută nodurile selectate ca copii ai lui. Disponibil **doar la
rădăcină** (conform arhitecturii).

```sql
create or replace function group_nodes(
  p_tenant_id    uuid,
  p_node_ids     uuid[],      -- array de ID-uri de mutat
  p_folder_name  text
)
returns uuid                   -- ID-ul folderului nou creat
language plpgsql
security definer
as $$
declare
  v_folder_id uuid;
  v_node_id uuid;
begin
  -- 1. Validare: minim 2 noduri
  if array_length(p_node_ids, 1) is null or array_length(p_node_ids, 1) < 2 then
    raise exception 'Gruparea necesită minim 2 elemente';
  end if;

  -- 2. Validare: toate nodurile sunt la rădăcină (parent_id is null) și neșterse
  if exists (
    select 1 from unnest(p_node_ids) as nid
     where not exists (
       select 1 from categories
        where id = nid
          and tenant_id = p_tenant_id
          and parent_id is null
          and deleted_at is null
     )
  ) then
    raise exception 'Toate nodurile trebuie să fie la rădăcină și neșterse';
  end if;

  -- 3. Creează folderul la rădăcină
  v_folder_id := create_category(p_tenant_id, null, p_folder_name, 'folder');

  -- 4. Mută nodurile ca copii ai folderului
  foreach v_node_id in array p_node_ids loop
    update categories
       set parent_id = v_folder_id
     where id = v_node_id
       and tenant_id = p_tenant_id;
  end loop;

  return v_folder_id;
end $$;
```

---

## 7. Seed tenant (pentru development)

La inițializarea proiectului, un singur tenant trebuie să existe:

```sql
-- Migration: seed_tenant.sql (rulează o singură dată)
insert into tenants (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Tenant')
on conflict (id) do nothing;
```

UUID-ul fix simplifică development-ul — clientul îl poate hardcoda temporar în loc să
implementeze autentificarea completă.

---

## 8. Ordinea de creare (migration-uri)

```
001_extensions.sql          — moddatetime
002_tenants.sql             — tabel + trigger updated_at
003_categories.sql          — tabel + indexuri + trigger updated_at
004_categories_triggers.sql — enforce_category_tree_rules (opțional)
005_category_attributes.sql — tabel + indexuri + trigger updated_at
006_attribute_options.sql   — tabel + indexuri
007_products.sql            — tabel + indexuri + trigger updated_at
008_products_triggers.sql   — enforce_product_on_leaf (opțional)
009_rpc_functions.sql       — toate funcțiile RPC din acest document
010_seed_tenant.sql         — tenant default
```

---

## 9. Instrucțiuni pentru agentul Claude Code

1. **Scrie fiecare funcție RPC ca migration separată** sau grupate în `009_rpc_functions.sql`.
   Folosește `create or replace function` — permite re-rulare idempotentă.
2. **Testează anti-ciclul** cu un arbore de test: `A → B → C`, mută `A` în `C` → trebuie
   să eșueze. Mută `A` în rădăcină → trebuie să reușească.
3. **Testează RESTRICT la delete_folder**: încearcă DELETE pe folder fără promovare →
   trebuie să eșueze cu eroare FK.
4. La integrarea cu clientul React, **fiecare apel RPC returnează eroare sau succes** —
   clientul trebuie să trateze erorile (toast cu mesajul din excepție).
5. **Nu activa RLS** în acest pas — funcțiile folosesc `p_tenant_id` ca parametru explicit.
6. **UUID-ul fix de tenant** (`00000000-...0001`) e soluție temporară. Când vine autentificarea,
   se înlocuiește cu `auth.uid()` → lookup tenant.

---

*SPEC_CatalogRPC — 6 funcții RPC: move_node (cu anti-ciclu recursiv), get_valid_move_targets,
delete_folder (cu promovare + RESTRICT), soft_delete_category, restore_from_trash (la rădăcină),
create_category (cu validare), group_nodes; seed tenant; ordine migration-uri.*
