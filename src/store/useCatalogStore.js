import { create } from 'zustand'
import { mockNodes } from '../mock/products'

let _nextId = 100
const genId = (prefix) => `${prefix}-${++_nextId}`

function getDescendantIds(nodes, id) {
  const result = new Set()
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()
    const children = nodes.filter((n) => n.parentId === cur)
    for (const c of children) {
      result.add(c.id)
      queue.push(c.id)
    }
  }
  return result
}

export const useCatalogStore = create((set, get) => ({
  nodes: [...mockNodes],
  trash: [],
  currentFolderId: null,
  treeExpanded: false,
  toggleTreeExpanded: () => set((s) => ({ treeExpanded: !s.treeExpanded })),

  // ── Navigation ──────────────────────────────────────────────────────
  navigate: (folderId) => set({ currentFolderId: folderId }),

  navigateUp: () => {
    const { nodes, currentFolderId } = get()
    if (!currentFolderId) return
    const current = nodes.find((n) => n.id === currentFolderId)
    set({ currentFolderId: current?.parentId ?? null })
  },

  // ── Derived helpers (not reactive — call inside actions) ─────────────
  getBreadcrumb: () => {
    const { nodes, currentFolderId } = get()
    if (!currentFolderId) return []
    const crumbs = []
    let id = currentFolderId
    while (id) {
      const node = nodes.find((n) => n.id === id)
      if (!node) break
      crumbs.unshift(node)
      id = node.parentId
    }
    return crumbs
  },

  getChildren: (parentId) => {
    const { nodes } = get()
    const children = nodes.filter((n) => n.parentId === parentId)
    // folders first, then categories
    return [
      ...children.filter((n) => n.type === 'folder'),
      ...children.filter((n) => n.type === 'category'),
    ]
  },

  // Lanțul de foldere-părinte (root → părinte direct), excluzând nodul însuși
  getAncestorFolders: (nodeId) => {
    const { nodes } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return []
    const chain = []
    let parentId = node.parentId
    while (parentId) {
      const parent = nodes.find((n) => n.id === parentId)
      if (!parent) break
      chain.unshift(parent)
      parentId = parent.parentId
    }
    return chain
  },

  // ── CRUD ─────────────────────────────────────────────────────────────
  addCategory: (name, parentId = null) => {
    const { nodes } = get()
    const exists = nodes.some(
      (n) => n.type === 'category' && n.name.toLowerCase() === name.toLowerCase() && n.parentId === parentId
    )
    if (exists) return false
    const newNode = { id: genId('c'), type: 'category', name: name.trim(), parentId, products: 0 }
    set({ nodes: [...nodes, newNode] })
    return true
  },

  addFolder: (name, parentId = null) => {
    const { nodes } = get()
    const exists = nodes.some(
      (n) => n.type === 'folder' && n.name.toLowerCase() === name.toLowerCase() && n.parentId === parentId
    )
    if (exists) return false
    const newNode = { id: genId('f'), type: 'folder', name: name.trim(), parentId }
    set({ nodes: [...nodes, newNode] })
    return true
  },

  renameNode: (id, name) => {
    set((s) => ({
      nodes: s.nodes.map((n) => n.id === id ? { ...n, name: name.trim() } : n),
    }))
  },

  // Soft delete category → trash
  deleteCategory: (id) => {
    const { nodes, trash } = get()
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    set({
      nodes: nodes.filter((n) => n.id !== id),
      trash: [...trash, node],
    })
  },

  // Hard delete folder → promote children to folder's parent
  deleteFolder: (id) => {
    set((s) => {
      const folder = s.nodes.find((n) => n.id === id)
      if (!folder) return {}
      const newParent = folder.parentId
      return {
        nodes: s.nodes
          .filter((n) => n.id !== id)
          .map((n) => n.parentId === id ? { ...n, parentId: newParent } : n),
      }
    })
  },

  restoreFromTrash: (id) => {
    set((s) => {
      const node = s.trash.find((n) => n.id === id)
      if (!node) return {}
      return {
        trash: s.trash.filter((n) => n.id !== id),
        nodes: [...s.nodes, { ...node, parentId: null }], // always to root
      }
    })
  },

  permanentDelete: (id) => {
    set((s) => ({ trash: s.trash.filter((n) => n.id !== id) }))
  },

  // ── Group (only at root, creates/uses folder) ────────────────────────
  groupNodes: (ids, folderName) => {
    set((s) => {
      let folder = s.nodes.find(
        (n) => n.type === 'folder' && n.name.toLowerCase() === folderName.toLowerCase() && n.parentId === null
      )
      let nodes = s.nodes
      if (!folder) {
        folder = { id: genId('f'), type: 'folder', name: folderName.trim(), parentId: null }
        nodes = [...nodes, folder]
      }
      return {
        nodes: nodes.map((n) => ids.includes(n.id) ? { ...n, parentId: folder.id } : n),
      }
    })
  },

  // ── Move ─────────────────────────────────────────────────────────────
  moveNodes: (ids, targetParentId) => {
    const { nodes } = get()
    // Anti-cycle: reject if any id is an ancestor of targetParentId
    for (const id of ids) {
      const descendants = getDescendantIds(nodes, id)
      descendants.add(id)
      if (targetParentId && descendants.has(targetParentId)) return false
    }
    set((s) => ({
      nodes: s.nodes.map((n) => ids.includes(n.id) ? { ...n, parentId: targetParentId } : n),
    }))
    return true
  },

  // Returns folder ids that are valid move destinations (excludes movedIds and their descendants)
  getValidMoveDestinations: (movedIds) => {
    const { nodes } = get()
    const excluded = new Set(movedIds)
    for (const id of movedIds) {
      const desc = getDescendantIds(nodes, id)
      for (const d of desc) excluded.add(d)
    }
    return nodes.filter((n) => n.type === 'folder' && !excluded.has(n.id))
  },
}))
