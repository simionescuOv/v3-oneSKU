# oneSku — Spec schemă bază de date v2 (Supabase / PostgreSQL)

> **v2** — revizuită după critică DBA. Schimbările față de v1 sunt marcate cu `🔧 CHANGED`, `➕ ADDED` sau `⏸ DEFERRED` și explicate inline.
>
> Acoperă modulul **Catalog** (categorii, schema dinamică de atribute, produse, tags). StockHub, Tranzacții, Users/Roles, Orders rămân `[TBD]` — schema e proiectată să se extindă spre ele fără refactorizare (vezi §7).

---

## 0. Decizii de design confirmate

| Decizie | Alegere | Motiv |
|---|---|---|
| Reprezentare arbore categorii | **Adjacency List** (`parent_id`) | Simplu, suficient la scara curentă; PostgreSQL suportă nativ `WITH RECURSIVE` |
| Multi-tenant | **`tenant_id` pe fiecare tabel, fără excepție** | 🔧 v1 sărea peste 3 tabele — acum e consecvent (vezi §0.1) |
| Schema dinamică a categoriei | **Tabel separat `category_attributes`** | Queryabil, validabil, CRUD pe rânduri |
| Opțiuni pentru "single choice" | **Tabel separat `category_attribute_options`** | Redenumire/reordonare curată |
| Valori atribute pe produs | **JSONB pe rândul produsului, cheiat după `attribute_id` (UUID)** | 🔧 v1 cheia după `name` — fragil la redenumire (vezi §0.2) |
| `ON DELETE` pe `parent_id` | **`restrict`**, nu `cascade` | 🔧 v1 avea `cascade` — contrazicea regula de promovare (vezi §0.3) |

### 0.1 `tenant_id` peste tot — corecția consecvenței

v1 declara „`tenant_id` pe fiecare tabel" dar îl omitea pe `category_attribute_options`, `tag_values` și `product_tags`. v2 îl pune peste tot. Motivul nu e doar consecvența: când se activează RLS, o policy pe un tabel **fără** `tenant_id` trebuie să facă join către părinte ca să afle tenantul — mai lent și mai fragil decât un filtru direct pe coloană. Coloana e ieftină acum, dureroasă de adăugat retroactiv.

### 0.2 De ce JSONB cheiat după UUID, nu după nume

v1 stoca `attributes = {"Culoare": "Roșu"}`, cu cheia = `name`-ul atributului. Problema: `name` e editabil de tenant. La redenumirea „Culoare" → „Color", **toate** produsele existente rămân cu cheia veche orfană, fără update automat.

v2 cheiază după `category_attributes.id` (UUID imuabil): `attributes = {"a1b2...": "Roșu"}`. Redenumirea atributului nu mai atinge niciun produs. Costul: lizibilitate redusă când inspectezi rândul în DB — dar afișarea se face oricum prin join cu `category_attributes` ca să iei `name`-ul curent, deci utilizatorul nu vede niciodată UUID-ul. **Niciodată nu lega valorile de un string editabil de utilizator.**

### 0.3 De ce `restrict`, nu `cascade`, pe `parent_id`

Arhitectura cere ca la ștergerea unui folder copiii să se **promoveze la părinte**, nu să se șteargă. Un FK cu `on delete cascade` face exact opusul: orice `DELETE` pe un nod șterge tăcut tot subarborele. Risc de pierdere de date prin bug de aplicație, ștergere manuală în consolă, sau cascadare peste categorii deja în Trash. `restrict` forțează logica de promovare să fie explicită — cascade-ul nu trebuie să se poată întâmpla accidental aici.

---

## 1. Extensii necesare

➕ ADDED — `updated_at` nu se actualizează singur în Postgres; rămâne blocat la valoarea de la insert dacă nu există trigger.

```sql
create extension if not exists moddatetime schema extensions;
-- folosit la §2-§5 pentru a menține updated_at corect la fiecare UPDATE
```

---

## 2. Tabel: `tenants`

```sql
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_tenants_updated_at
  before update on tenants
  for each row execute procedure extensions.moddatetime(updated_at);
```

> Un singur tenant va exista la început, dar fiecare tabel referențiază `tenant_id` de la start.

---

## 3. Tabel: `categories`

Reprezintă **atât foldere cât și categorii**. Distincția e dată de `node_type`, nu de tabele separate — un nod poate fi promovat/retrogradat fără schimbare de entitate.

```sql
create table categories (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  parent_id     uuid references categories(id) on delete restrict,  -- 🔧 era cascade
  name          text not null,
  node_type     text not null check (node_type in ('folder', 'category')),
  position      integer not null default 0,
  deleted_at    timestamptz,                   -- soft-delete (doar node_type = 'category')
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_categories_tenant_parent on categories(tenant_id, parent_id);

-- 🔧 index pe deleted_at — păstrat, dar vezi indexul parțial de mai jos pt. listele live
create index idx_categories_deleted_at on categories(deleted_at) where deleted_at is not null;

-- ➕ unicitate: două noduri-frate nu pot avea același nume (printre cele NEsterse)
create unique index uq_categories_sibling_name
  on categories(tenant_id, parent_id, name)
  where deleted_at is null;

create trigger trg_categories_updated_at
  before update on categories
  for each row execute procedure extensions.moddatetime(updated_at);
```

**Reguli de business:**

- `node_type = 'category'` → frunză; poate avea `category_attributes` și produse; nu are copii.
- `node_type = 'folder'` → poate avea copii; nu are produse directe.
- **Soft-delete**: doar categoriile au `deleted_at`. La restaurare din Trash, `parent_id` → `null` (rădăcină).
- **Ștergere folder**: NU e soft-delete. Logica de aplicație (RPC) promovează copiii (`parent_id` copiilor ← `parent_id` folderului), apoi șterge rândul folder. Cu `on delete restrict`, dacă promovarea nu s-a făcut, `DELETE`-ul **eșuează** în loc să cascadeze — exact plasa de siguranță dorită.
- **Anti-ciclu la mutare**: validare în aplicație cu query recursiv înainte de `UPDATE parent_id` (vezi §10).

➕ **Constrângere de frunză (opțional, recomandat la 1 tenant)** — trigger ușor care prinde devreme bug-urile, cât sunt ieftine:

```sql
create or replace function enforce_category_tree_rules()
returns trigger language plpgsql as $$
begin
  -- un nod cu copii nu poate fi/deveni 'category' (categoriile sunt frunze)
  if exists (select 1 from categories where parent_id = new.id) then
    if new.node_type = 'category' then
      raise exception 'O categorie nu poate avea copii (id=%)', new.id;
    end if;
  end if;
  -- un nod nou nu poate fi copil al unei 'category' (doar folderele au copii)
  if new.parent_id is not null then
    if (select node_type from categories where id = new.parent_id) = 'category' then
      raise exception 'Părintele % este o categorie (frunză), nu poate avea copii', new.parent_id;
    end if;
  end if;
  return new;
end $$;

create trigger trg_categories_tree_rules
  before insert or update on categories
  for each row execute procedure enforce_category_tree_rules();
```

---

## 4. Tabel: `category_attributes`

Schema dinamică a unei categorii.

```sql
create table category_attributes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  name          text not null,                 -- afișat, editabil de tenant, ex: "Culoare"
  attribute_type text not null check (attribute_type in ('text', 'single_choice')),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_category_attributes_category on category_attributes(category_id);

-- ➕ CRITIC: două atribute cu același nume în aceeași categorie ar produce coliziune
-- de mapping; chiar dacă JSONB e cheiat după id, numele duplicat încurcă UI-ul.
create unique index uq_category_attributes_name
  on category_attributes(category_id, name);

create trigger trg_category_attributes_updated_at
  before update on category_attributes
  for each row execute procedure extensions.moddatetime(updated_at);
```

> `id`-ul (UUID) e cheia stabilă folosită în `products.attributes`. `name` e doar pentru afișare și poate fi schimbat oricând fără efect asupra produselor.

---

## 5. Tabel: `category_attribute_options`

Opțiunile pentru un atribut `single_choice`.

```sql
create table category_attribute_options (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,  -- ➕ consecvență
  attribute_id  uuid not null references category_attributes(id) on delete cascade,
  value         text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_attribute_options_attribute on category_attribute_options(attribute_id);

-- ➕ anti-duplicat: nu vrei "128GB" de două ori în aceeași listă
create unique index uq_attribute_options_value
  on category_attribute_options(attribute_id, value);
```

> Doar atributele `single_choice` au rânduri aici. Pentru `text`, tabelul rămâne neutilizat.

---

## 6. Tabel: `products`

```sql
create table products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete restrict,  -- 🔧 era implicit
  name          text not null,
  attributes    jsonb not null default '{}',   -- 🔧 chei = category_attributes.id, NU name
                                                -- ex: {"a1b2c3...": "Roșu", "d4e5f6...": "128GB"}
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_products_tenant_category on products(tenant_id, category_id);

-- 🔧 jsonb_path_ops: index mai mic și mai rapid dacă filtrarea e doar containment (@>)
create index idx_products_attributes on products using gin(attributes jsonb_path_ops);

create trigger trg_products_updated_at
  before update on products
  for each row execute procedure extensions.moddatetime(updated_at);
```

**Constrângeri de business:**

- `category_id` trebuie să refere mereu un nod `node_type = 'category'`, niciodată `'folder'`. Enforțat de aplicație + opțional de trigger:

```sql
create or replace function enforce_product_on_leaf()
returns trigger language plpgsql as $$
begin
  if (select node_type from categories where id = new.category_id) <> 'category' then
    raise exception 'Produsele se atașează doar la noduri category, nu folder (id=%)', new.category_id;
  end if;
  return new;
end $$;

create trigger trg_products_leaf
  before insert or update of category_id on products
  for each row execute procedure enforce_product_on_leaf();
```

- Cheile din `attributes` = `id`-urile din `category_attributes` ale categoriei produsului. La afișare/editare, aplicația face join ca să mapeze `id → name` curent.

---

## ⚠️ Decizie deschisă: PREȚ și COST

v1 nu conține nicio coloană de preț, deși arhitectura le folosește repetat (carduri „2.499 RON", „Preț Mediu Ponderat" și „Cost" în tab-ul Flux, §6.5). **Aceasta e o decizie de model care trebuie luată înainte de prima încărcare de date reale**, nu un detaliu de retrofitat ușor. Întrebarea: prețul/costul trăiește în **Catalog** (preț de listă pe produs/variantă) sau e **exclusiv concept de Space/tranzacție** (costul intră odată cu marfa, prețul mediu ponderat se calculează per Space)?

Citind §6.5 (PMP = preț mediu **ponderat**, calculat din tranzacții) pare că **costul e atribut de tranzacție**, agregat per Space — deci NU se stochează static pe produs. Prețul de **vânzare** însă pare candidat pentru Catalog (sau pentru layer-ul de Storefront).

Recomandare provizorie (de confirmat în chat înainte de implementare):
- `products.list_price numeric(12,2)` — preț de listă orientativ, opțional, în Catalog.
- Costul **NU** pe produs; vine prin `transaction_items.unit_cost` (StockHub), PMP calculat la nivel de `stock`.

**Nu implementa nimic aici până nu confirmi modelul** — o coloană greșită de preț e exact genul de decizie scumpă de schimbat după ce intră date.

---

## 7. Note de extensibilitate (StockHub / Tranzacții — viitor)

Nu se creează acum. Cum susține schema actuală extensia, fără refactorizare:

- **`spaces`** — `tenant_id` + `allow_negative_stock boolean` (setat o singură dată la creare, §6.7).
- **`stock`** — PK compus `(space_id, product_id)`; stocul există per pereche, nu pe produs (Catalog nu deține stoc, §6.1).
- **`transactions`** + **`transaction_items`** — `source`/`destination` = fie `'catalog'`, fie `space_id`. `transaction_items.unit_cost` alimentează PMP. „Clonarea automată la prima apariție" (§7.3): la procesare, dacă `product_id` n-are rând în `stock` pentru `space_id`, se inserează unul cu cantitatea din coș.
- **Variante / SKU** — arhitectura le declară first-class (§5.3), dar nu sunt în schema Catalog acum. Punct de atenție: `products.attributes` la nivel de produs intră în tensiune cu atribute per-variantă (mărime/culoare per SKU). Când vine feature-ul, atașezi `product_variants(id, product_id, sku, attributes jsonb, ...)`, iar `stock` se va lega de `variant_id`, nu de `product_id`. Proiectează `stock` cu asta în minte de la prima migrare StockHub ca să nu reproiectezi PK-ul.
- `products.category_id` rămâne sursa de adevăr pentru apartenența la categorie (dimensiune de filtrare în Space, §6.2) — nu se duplică nicăieri.

---

## 8. Tag Vocabulary — ⏸ DEFERRED

🔧 v1 crea acum 3 tabele de tags. v2 le **amână** până ești efectiv pe feature-ul de Tags: nu există încă UI sau date, focusul activ e Catalog, iar principiul „clean slate" zice să nu cari decizii premature. Schema lor e independentă de restul Catalog-ului și nu blochează nimic.

SQL-ul de referință (de rulat **când** ataci feature-ul, cu `tenant_id` adăugat consecvent):

```sql
create table tag_groups (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create unique index uq_tag_groups_name on tag_groups(tenant_id, name);

create table tag_values (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,  -- ➕ consecvență
  tag_group_id uuid not null references tag_groups(id) on delete cascade,
  value        text not null,
  created_at   timestamptz not null default now()
);
create unique index uq_tag_values_value on tag_values(tag_group_id, value);
create index idx_tag_values_group on tag_values(tag_group_id);

create table product_tags (
  tenant_id    uuid not null references tenants(id) on delete cascade,  -- ➕ consecvență
  product_id   uuid not null references products(id) on delete cascade,
  tag_value_id uuid not null references tag_values(id) on delete cascade,
  primary key (product_id, tag_value_id)
);
create index idx_product_tags_tag on product_tags(tag_value_id);
```

---

## 9. Row Level Security (RLS) — ⏸ DEFERRED complet

🔧 v1 pregătea policy-uri ca migration dezactivată. v2 amână **și scrierea** lor până ai al doilea tenant real. Motivul: la 1 tenant, RLS rezolvă o problemă inexistentă, iar policy-urile vor fi rescrise oricum când vezi cum arată autentificarea concretă (`auth.uid()`, claims JWT, etc.). Coloanele `tenant_id` **sunt** prezente peste tot de la început — asta e asigurarea ieftină și greu de retrofitat; restul aparatului nu.

Când vine momentul, șablonul (de adaptat la modelul real de auth):

```sql
alter table categories enable row level security;
create policy tenant_isolation on categories
  using (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
-- similar pentru fiecare tabel cu tenant_id (acum toate îl au)
```

---

## 10. Rezumat tabele (ordinea de creare / dependențe)

```
[acum]
tenants
  └── categories (parent_id → self ON DELETE RESTRICT, tenant_id → tenants)
        ├── category_attributes (category_id → categories)
        │     └── category_attribute_options (attribute_id → category_attributes)
        └── products (category_id → categories ON DELETE RESTRICT, tenant_id → tenants)

[amânat — la feature-ul Tags]
tag_groups → tag_values → product_tags

[viitor — StockHub]
spaces → stock(space_id, product_id) → transactions → transaction_items
```

---

## 11. Instrucțiuni pentru agentul Claude Code

1. **Verifică contra codului React existent** (componente Catalog, hook `usePicker`, mock-data) — atenție specială la forma `products.attributes`: v2 cheiază după **`attribute_id` (UUID)**, nu după `name`. Dacă mock-data folosește nume ca chei, semnalează discrepanța și propune migrarea înainte de orice altceva.
2. Scrie migration-urile SQL ca **fișiere separate** (Supabase migrations), versionate în repo. Ordinea: extensii → tenants → categories (+ triggere) → category_attributes → options → products (+ triggere).
3. Implementează în aplicație funcțiile neenforțabile pur SQL:
   - **anti-ciclu la mutare** (query recursiv `WITH RECURSIVE` care verifică că `new_parent_id` nu e descendent al nodului mutat);
   - **promovare conținut la ștergere folder** (update `parent_id` copii → `parent_id` folder, apoi delete folder — `restrict` va bloca delete-ul dacă promovarea n-a rulat, ca plasă de siguranță);
   - **restaurare din Trash la rădăcină** (`parent_id` → null, `deleted_at` → null).
4. Triggerele de validare (`enforce_category_tree_rules`, `enforce_product_on_leaf`) sunt **recomandate** la 1 tenant — prind bug-uri devreme. Dacă preferi să le ții doar în aplicație, documentează decizia.
5. **NU** crea tabelele de Tags (§8) și **NU** scrie/activa RLS (§9) în acest pas.
6. **Confirmă cu Bibicu în chat** decizia de Preț/Cost (secțiunea ⚠️) înainte de a adăuga orice coloană de preț.
7. La generarea client-ului, folosește `supabase gen types typescript` pentru tipuri sincronizate cu schema reală.

---

*v2 — corecții: `parent_id` ON DELETE RESTRICT (anti-pierdere date); JSONB cheiat după UUID imuabil (anti-orfanare la redenumire); constrângeri de unicitate adăugate (atribute, opțiuni, frați); `tenant_id` consecvent pe toate tabelele; triggere `moddatetime` pentru `updated_at`; triggere opționale de integritate arbore/frunză; `gin jsonb_path_ops`; Tags și RLS amânate; decizie de Preț/Cost ridicată explicit.*
