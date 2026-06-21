# oneSku — STATUS

> Actualizat de Claude Code după fiecare sesiune de lucru.

---

## Sesiunea 1 — Schelă inițială

### Structura de foldere

```
src/
├── mock/
│   ├── spaces.js        # 3 spaces mock (Depozit Central, Showroom, Consignație)
│   └── products.js      # 3 categorii + 4 produse mock
├── store/
│   ├── useAppStore.js   # UI state: side menu open/closed
│   ├── useCatalogStore.js  # Categorii + produse (sursă: mock → Supabase)
│   └── useStockStore.js    # Spaces (sursă: mock → Supabase)
├── components/
│   ├── shell/
│   │   ├── AppShell.jsx     # Layout root: TopBar + MainContent + BottomBar
│   │   ├── TopBar.jsx       # Header fixat sus, afișează titlul paginii curente
│   │   ├── MainContent.jsx  # Zona scrollabilă, emite scroll events, randează <Outlet />
│   │   └── BottomBar.jsx    # Search bar + buton hamburger, hide/show la scroll
│   └── nav/
│       └── SideMenu.jsx     # Meniu lateral overlay cu cele 6 secțiuni
└── pages/
    ├── AccountPage.jsx
    ├── CatalogPage.jsx      # Listă statică: categorii + produse din mock
    ├── StockHubPage.jsx     # Listă statică: spaces din mock
    ├── StorefrontPage.jsx
    ├── DashboardPage.jsx
    └── SettingsPage.jsx
```

### Rute active

| URL           | Pagină          |
|---------------|-----------------|
| `/`           | redirect → `/catalog` |
| `/account`    | AccountPage     |
| `/catalog`    | CatalogPage     |
| `/stockhub`   | StockHubPage    |
| `/storefront` | StorefrontPage  |
| `/dashboard`  | DashboardPage   |
| `/settings`   | SettingsPage    |

### Mock data

- **`src/mock/spaces.js`** — 3 spaces cu `name`, `allow_negative_stock`, `product_count`, `total_units`
- **`src/mock/products.js`** — 3 categorii + 4 produse cu `name`, `category_name`, `price`, `sku_count`
- Consumate prin store-uri Zustand (`useCatalogStore`, `useStockStore`)
- La conectarea Supabase: se înlocuiește doar inițializarea din store — componentele rămân intacte

### Comportamente implementate

- **Dark theme** — `class="dark"` pe `<html>`, Tailwind dark mode via `'class'`
- **AppShell 100dvh** — layout stabil pe mobile (100dvh cu fallback 100svh)
- **BottomBar hide/show** — scroll down ascunde bara, scroll up o readuce; scroll events pe `MainContent`, NU pe `window`
- **SideMenu** — overlay cu backdrop, navigare prin `useNavigate`, item activ evidențiat
- **TopBar** — titlul se schimbă dinamic cu pagina curentă

---

## Urmează (neimplementat)

### Catalog
- [ ] Flux creare/editare categorii
- [ ] Grupare categorii în foldere (arbore ierarhic)
- [ ] Schema categoriei (atribute dinamice)
- [ ] Adăugare produs (individual)
- [ ] Import produse din xlsx (SheetJS)
- [ ] Filtrare produse (OR per atribut, AND între atribute)
- [ ] Tag Vocabulary global (Tag Groups + Tag Values)

### StockHub
- [ ] Pagina unui Space (tab Stoc + tab Flux)
- [ ] Dialogul de filtrare (model eMAG, categorie ca filtru)
- [ ] Tab Flux — feed WhatsApp-style al tranzacțiilor

### Storefront
- [ ] Layer de prezentare (override-uri publice)
- [ ] Link public fără autentificare

### Tranzacții / Cart
- [ ] Coșul ca motor de mișcare stoc
- [ ] Clonare automată la prima apariție produs în Space

### Infrastructură
- [ ] Conectare Supabase (Auth + PostgreSQL)
- [ ] Persistență Zustand via Supabase
- [ ] PWA manifest + service worker
- [ ] Users / Roles (TBD în arhitectură)
