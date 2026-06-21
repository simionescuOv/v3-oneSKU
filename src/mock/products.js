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
]
