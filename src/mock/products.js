// ── Schema de atribute per categorie (SPEC_DatabaseSchema_v2 §4) ──────────────
// Cheia stabilă e `id`-ul atributului; `products.attributes` se cheiază după el,
// niciodată după `name` (care e editabil) — vezi SPEC §0.2.
export const mockCategoryAttributes = [
  // Telefoane (c-4)
  { id: 'attr-tel-culoare', categoryId: 'c-4', name: 'Culoare', type: 'single_choice', position: 0 },
  { id: 'attr-tel-memorie', categoryId: 'c-4', name: 'Memorie', type: 'single_choice', position: 1 },
  { id: 'attr-tel-model',   categoryId: 'c-4', name: 'Model',   type: 'text',          position: 2 },
  // Tricouri (c-6)
  { id: 'attr-tri-marime',  categoryId: 'c-6', name: 'Mărime',  type: 'single_choice', position: 0 },
]

// ── Opțiunile atributelor single_choice (SPEC_DatabaseSchema_v2 §5) ───────────
export const mockAttributeOptions = [
  { id: 'opt-cul-negru',    attributeId: 'attr-tel-culoare', value: 'Negru',    position: 0 },
  { id: 'opt-cul-alb',      attributeId: 'attr-tel-culoare', value: 'Alb',      position: 1 },
  { id: 'opt-cul-albastru', attributeId: 'attr-tel-culoare', value: 'Albastru', position: 2 },
  { id: 'opt-mem-64',       attributeId: 'attr-tel-memorie', value: '64GB',     position: 0 },
  { id: 'opt-mem-128',      attributeId: 'attr-tel-memorie', value: '128GB',    position: 1 },
  { id: 'opt-mem-256',      attributeId: 'attr-tel-memorie', value: '256GB',    position: 2 },
  { id: 'opt-mar-s',        attributeId: 'attr-tri-marime',  value: 'S',        position: 0 },
  { id: 'opt-mar-m',        attributeId: 'attr-tri-marime',  value: 'M',        position: 1 },
  { id: 'opt-mar-l',        attributeId: 'attr-tri-marime',  value: 'L',        position: 2 },
]

// ── Produse (SPEC_DatabaseSchema_v2 §6) ───────────────────────────────────────
// `attributes` cheiat după id de atribut; `listPrice` = preț de listă opțional.
export const mockProducts = [
  { id: 'prod-1', categoryId: 'c-4', name: 'iPhone 13', attributes: { 'attr-tel-culoare': 'Negru', 'attr-tel-memorie': '128GB', 'attr-tel-model': 'A2633' }, listPrice: 3499 },
  { id: 'prod-2', categoryId: 'c-4', name: 'Samsung Galaxy S23', attributes: { 'attr-tel-culoare': 'Albastru', 'attr-tel-memorie': '256GB', 'attr-tel-model': 'SM-S911' }, listPrice: 3999 },
  { id: 'prod-3', categoryId: 'c-4', name: 'Xiaomi Redmi Note 12', attributes: { 'attr-tel-culoare': 'Alb', 'attr-tel-memorie': '64GB' }, listPrice: 1099 },
  { id: 'prod-4', categoryId: 'c-6', name: 'Tricou Basic Alb', attributes: { 'attr-tri-marime': 'M' }, listPrice: 59 },
  { id: 'prod-5', categoryId: 'c-6', name: 'Tricou Premium Negru', attributes: { 'attr-tri-marime': 'L' }, listPrice: 89 },
]

// Node tree for CatalogPage (folder + category hierarchy)
export const mockNodes = [
  // Root folders
  { id: 'f-1', type: 'folder', name: 'Electronice', parentId: null },
  { id: 'f-2', type: 'folder', name: 'Îmbrăcăminte', parentId: null },
  // Root categories
  { id: 'c-1', type: 'category', name: 'Accesorii', parentId: null },
  // Inside Electronice
  { id: 'f-3', type: 'folder', name: 'Telefoane & Tablete', parentId: 'f-1' },
  { id: 'c-2', type: 'category', name: 'Laptopuri', parentId: 'f-1' },
  { id: 'c-3', type: 'category', name: 'TV & Audio', parentId: 'f-1' },
  // Inside Telefoane & Tablete
  { id: 'c-4', type: 'category', name: 'Telefoane', parentId: 'f-3' },
  { id: 'c-5', type: 'category', name: 'Tablete', parentId: 'f-3' },
  // Inside Îmbrăcăminte
  { id: 'c-6', type: 'category', name: 'Tricouri', parentId: 'f-2' },
  { id: 'c-7', type: 'category', name: 'Jachete', parentId: 'f-2' },

  // Root: lanț de adâncime Auto & Moto → Piese Auto → Anvelope → Jante & Cauciucuri
  { id: 'f-8', type: 'folder', name: 'Auto & Moto', parentId: null },
  { id: 'f-9', type: 'folder', name: 'Piese Auto', parentId: 'f-8' },
  { id: 'f-10', type: 'folder', name: 'Anvelope', parentId: 'f-9' },
  { id: 'f-11', type: 'folder', name: 'Jante & Cauciucuri', parentId: 'f-10' },
  // Root: alt folder nou, fără adâncime
  { id: 'f-12', type: 'folder', name: 'Casă & Grădină', parentId: null },

  // Categorii noi la rădăcină
  { id: 'c-9', type: 'category', name: 'Cărți', parentId: null },
  { id: 'c-10', type: 'category', name: 'Jucării', parentId: null },
  // Inside Electronice
  { id: 'c-11', type: 'category', name: 'Drone', parentId: 'f-1' },
  { id: 'c-12', type: 'category', name: 'Console Gaming', parentId: 'f-1' },
  // Inside Telefoane & Tablete
  { id: 'c-13', type: 'category', name: 'Smartwatch-uri', parentId: 'f-3' },
  { id: 'c-14', type: 'category', name: 'Powerbank-uri', parentId: 'f-3' },
  // Inside Îmbrăcăminte
  { id: 'c-15', type: 'category', name: 'Pantaloni', parentId: 'f-2' },
  { id: 'c-16', type: 'category', name: 'Rochii', parentId: 'f-2' },
  // Inside Auto & Moto
  { id: 'c-17', type: 'category', name: 'Uleiuri Motor', parentId: 'f-8' },
  { id: 'c-18', type: 'category', name: 'Accesorii Interior', parentId: 'f-8' },
  // Inside Piese Auto
  { id: 'c-19', type: 'category', name: 'Filtre', parentId: 'f-9' },
  { id: 'c-20', type: 'category', name: 'Plăcuțe Frână', parentId: 'f-9' },
  // Inside Anvelope
  { id: 'c-21', type: 'category', name: 'Anvelope Iarnă', parentId: 'f-10' },
  { id: 'c-22', type: 'category', name: 'Anvelope Vară', parentId: 'f-10' },
  // Inside Jante & Cauciucuri (cel mai adânc)
  { id: 'c-23', type: 'category', name: 'Jante Aliaj 17"', parentId: 'f-11' },
  { id: 'c-24', type: 'category', name: 'Jante Aliaj 18"', parentId: 'f-11' },
  { id: 'c-25', type: 'category', name: 'Capace Roți', parentId: 'f-11' },
  // Inside Casă & Grădină
  { id: 'c-26', type: 'category', name: 'Mobilier Grădină', parentId: 'f-12' },
  { id: 'c-27', type: 'category', name: 'Unelte', parentId: 'f-12' },
  { id: 'c-28', type: 'category', name: 'Decorațiuni', parentId: 'f-12' },
]
