export const mockCategories = [
  { id: 'cat-1', name: 'Electronice', product_count: 12 },
  { id: 'cat-2', name: 'Îmbrăcăminte', product_count: 34 },
  { id: 'cat-3', name: 'Accesorii', product_count: 9 },
]

export const mockProducts = [
  { id: 'prod-1', name: 'Căști Bluetooth Pro', category_id: 'cat-1', category_name: 'Electronice', price: 249, sku_count: 1 },
  { id: 'prod-2', name: 'Geacă de Iarnă Slim', category_id: 'cat-2', category_name: 'Îmbrăcăminte', price: 389, sku_count: 4 },
  { id: 'prod-3', name: 'Tricou Basic', category_id: 'cat-2', category_name: 'Îmbrăcăminte', price: 59, sku_count: 3 },
  { id: 'prod-4', name: 'Husă telefon universală', category_id: 'cat-3', category_name: 'Accesorii', price: 29, sku_count: 2 },
]

// Node tree for CatalogPage (folder + category hierarchy)
export const mockNodes = [
  // Root folders
  { id: 'f-1', type: 'folder', name: 'Electronice', parentId: null },
  { id: 'f-2', type: 'folder', name: 'Îmbrăcăminte', parentId: null },
  // Root categories
  { id: 'c-1', type: 'category', name: 'Accesorii', parentId: null, products: 9 },
  // Inside Electronice
  { id: 'f-3', type: 'folder', name: 'Telefoane & Tablete', parentId: 'f-1' },
  { id: 'c-2', type: 'category', name: 'Laptopuri', parentId: 'f-1', products: 7 },
  { id: 'c-3', type: 'category', name: 'TV & Audio', parentId: 'f-1', products: 12 },
  // Inside Telefoane & Tablete
  { id: 'c-4', type: 'category', name: 'Telefoane', parentId: 'f-3', products: 24 },
  { id: 'c-5', type: 'category', name: 'Tablete', parentId: 'f-3', products: 8 },
  // Inside Îmbrăcăminte
  { id: 'c-6', type: 'category', name: 'Tricouri', parentId: 'f-2', products: 34 },
  { id: 'c-7', type: 'category', name: 'Jachete', parentId: 'f-2', products: 18 },

  // Root: lanț de adâncime Auto & Moto → Piese Auto → Anvelope → Jante & Cauciucuri
  { id: 'f-8', type: 'folder', name: 'Auto & Moto', parentId: null },
  { id: 'f-9', type: 'folder', name: 'Piese Auto', parentId: 'f-8' },
  { id: 'f-10', type: 'folder', name: 'Anvelope', parentId: 'f-9' },
  { id: 'f-11', type: 'folder', name: 'Jante & Cauciucuri', parentId: 'f-10' },
  // Root: alt folder nou, fără adâncime
  { id: 'f-12', type: 'folder', name: 'Casă & Grădină', parentId: null },

  // Categorii noi la rădăcină
  { id: 'c-9', type: 'category', name: 'Cărți', parentId: null, products: 21 },
  { id: 'c-10', type: 'category', name: 'Jucării', parentId: null, products: 15 },
  // Inside Electronice
  { id: 'c-11', type: 'category', name: 'Drone', parentId: 'f-1', products: 6 },
  { id: 'c-12', type: 'category', name: 'Console Gaming', parentId: 'f-1', products: 10 },
  // Inside Telefoane & Tablete
  { id: 'c-13', type: 'category', name: 'Smartwatch-uri', parentId: 'f-3', products: 13 },
  { id: 'c-14', type: 'category', name: 'Powerbank-uri', parentId: 'f-3', products: 9 },
  // Inside Îmbrăcăminte
  { id: 'c-15', type: 'category', name: 'Pantaloni', parentId: 'f-2', products: 27 },
  { id: 'c-16', type: 'category', name: 'Rochii', parentId: 'f-2', products: 19 },
  // Inside Auto & Moto
  { id: 'c-17', type: 'category', name: 'Uleiuri Motor', parentId: 'f-8', products: 11 },
  { id: 'c-18', type: 'category', name: 'Accesorii Interior', parentId: 'f-8', products: 14 },
  // Inside Piese Auto
  { id: 'c-19', type: 'category', name: 'Filtre', parentId: 'f-9', products: 8 },
  { id: 'c-20', type: 'category', name: 'Plăcuțe Frână', parentId: 'f-9', products: 5 },
  // Inside Anvelope
  { id: 'c-21', type: 'category', name: 'Anvelope Iarnă', parentId: 'f-10', products: 16 },
  { id: 'c-22', type: 'category', name: 'Anvelope Vară', parentId: 'f-10', products: 20 },
  // Inside Jante & Cauciucuri (cel mai adânc)
  { id: 'c-23', type: 'category', name: 'Jante Aliaj 17"', parentId: 'f-11', products: 4 },
  { id: 'c-24', type: 'category', name: 'Jante Aliaj 18"', parentId: 'f-11', products: 3 },
  { id: 'c-25', type: 'category', name: 'Capace Roți', parentId: 'f-11', products: 7 },
  // Inside Casă & Grădină
  { id: 'c-26', type: 'category', name: 'Mobilier Grădină', parentId: 'f-12', products: 12 },
  { id: 'c-27', type: 'category', name: 'Unelte', parentId: 'f-12', products: 22 },
  { id: 'c-28', type: 'category', name: 'Decorațiuni', parentId: 'f-12', products: 17 },
]
