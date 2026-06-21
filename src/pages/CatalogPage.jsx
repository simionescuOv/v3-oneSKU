import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Plus, Layers, FolderInput, ChevronRight, ChevronDown, Folder, Tag,
  Settings, UnfoldVertical, FoldVertical,
} from 'lucide-react'
import { useCatalogStore } from '../store/useCatalogStore'
import { useAppStore } from '../store/useAppStore'
import { filterAndSort } from '../lib/search'
import NodeCard from '../components/catalog/NodeCard'
import BottomSheet from '../components/catalog/BottomSheet'

function buildSearchTree(matches, getAncestorFolders) {
  const root = { node: null, children: [], categories: [], matched: false }

  function getOrCreateChild(cursor, folderNode) {
    let existing = cursor.children.find((c) => c.node.id === folderNode.id)
    if (!existing) {
      existing = { node: folderNode, children: [], categories: [], matched: false }
      cursor.children.push(existing)
    }
    return existing
  }

  for (const item of matches) {
    const chain = getAncestorFolders(item.id)
    let cursor = root
    for (const folder of chain) {
      cursor = getOrCreateChild(cursor, folder)
    }
    if (item.type === 'category') {
      cursor.categories.push(item)
    } else {
      // folder matched directly — represent it as its own (tappable) node in the tree
      const entry = getOrCreateChild(cursor, item)
      entry.matched = true
    }
  }
  return root
}

function SearchGroup({ group, depth, onTap }) {
  const indent = 16 + depth * 16
  return (
    <>
      {group.node && (
        group.matched ? (
          <button
            onClick={() => onTap(group.node)}
            className="w-full flex items-center gap-2 py-2 text-left text-xs font-medium text-amber-400 bg-zinc-900/60 active:bg-zinc-900"
            style={{ paddingLeft: indent, paddingRight: 16 }}
          >
            <Folder size={14} className="shrink-0" />
            <span className="flex-1 truncate">{group.node.name}</span>
            <ChevronRight size={14} className="text-zinc-600 shrink-0" />
          </button>
        ) : (
          <div
            className="flex items-center gap-2 py-2 text-xs font-medium text-amber-400 bg-zinc-900/60"
            style={{ paddingLeft: indent, paddingRight: 16 }}
          >
            <Folder size={14} className="shrink-0" />
            {group.node.name}
          </div>
        )
      )}
      {group.categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onTap(cat)}
          className="w-full flex items-center gap-3 py-3.5 text-left active:bg-zinc-900"
          style={{ paddingLeft: indent + (group.node ? 16 : 0), paddingRight: 16 }}
        >
          <Tag size={18} className="text-blue-400 shrink-0" />
          <span className="flex-1 text-sm text-zinc-100 truncate">{cat.name}</span>
          <span className="text-xs text-zinc-500 shrink-0">{cat.products ?? 0} produse</span>
        </button>
      ))}
      {group.children.map((child) => (
        <SearchGroup key={child.node.id} group={child} depth={depth + 1} onTap={onTap} />
      ))}
    </>
  )
}

function FullTree({ parentId, depth, getChildren }) {
  const children = getChildren(parentId)
  return children.map((node) => (
    <div key={node.id}>
      <div
        className="flex items-center gap-2 py-2.5 text-sm border-b border-zinc-900"
        style={{ paddingLeft: 16 + depth * 16, paddingRight: 16 }}
      >
        {node.type === 'folder'
          ? <Folder size={16} className="text-amber-400 shrink-0" />
          : <Tag size={16} className="text-blue-400 shrink-0" />
        }
        <span className="flex-1 text-zinc-100 truncate">{node.name}</span>
        {node.type === 'category' && (
          <span className="text-xs text-zinc-500 shrink-0">{node.products ?? 0} produse</span>
        )}
      </div>
      {node.type === 'folder' && (
        <FullTree parentId={node.id} depth={depth + 1} getChildren={getChildren} />
      )}
    </div>
  ))
}

export default function CatalogPage() {
  const nodes = useCatalogStore((s) => s.nodes)
  const currentFolderId = useCatalogStore((s) => s.currentFolderId)
  const navigate = useCatalogStore((s) => s.navigate)
  const navigateUp = useCatalogStore((s) => s.navigateUp)
  const getBreadcrumb = useCatalogStore((s) => s.getBreadcrumb)
  const getChildren = useCatalogStore((s) => s.getChildren)
  const getAncestorFolders = useCatalogStore((s) => s.getAncestorFolders)
  const addCategory = useCatalogStore((s) => s.addCategory)
  const treeExpanded = useCatalogStore((s) => s.treeExpanded)
  const toggleTreeExpanded = useCatalogStore((s) => s.toggleTreeExpanded)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const catalogMenuOpen = useAppStore((s) => s.catalogMenuOpen)
  const closeCatalogMenu = useAppStore((s) => s.closeCatalogMenu)

  const [toast, setToast] = useState(null)
  const [configOpen, setConfigOpen] = useState(false)
  const toastTimer = useRef(null)
  const isPopRef = useRef(false)

  const currentChildren = getChildren(currentFolderId)
  const isRoot = currentFolderId === null
  const isSearching = searchQuery.trim().length > 0

  // ── Placeholder ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setSearchPlaceholder('Caută categorie sau folder...')
  }, [setSearchPlaceholder])

  // ── Back gesture (Android/browser) → navigate to parent folder ──────────────
  useEffect(() => {
    const onPopState = () => {
      isPopRef.current = true
      navigateUp()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [navigateUp])

  useEffect(() => {
    if (isPopRef.current) {
      isPopRef.current = false
      return
    }
    if (currentFolderId !== null) {
      window.history.pushState({ catalogFolder: currentFolderId }, '')
    }
  }, [currentFolderId])

  // Clear search when leaving the page would also be sensible, but query lives
  // in useAppStore and is reset by other pages' own placeholder effects.

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Tap ──────────────────────────────────────────────────────────────────────
  const handleTap = useCallback((node) => {
    if (node.type === 'folder') {
      navigate(node.id)
    } else {
      showToast(`Produse din „${node.name}" — în curând`)
    }
  }, [navigate, showToast])

  // ── Search (= unicul mecanism de adăugare categorie) ─────────────────────────
  // Caută atât în categorii, cât și în foldere (ex: „i” → folderul „Îmbrăcăminte”)
  const searchableNodes = useMemo(
    () => nodes.filter((n) => n.type === 'category' || n.type === 'folder'),
    [nodes]
  )
  const searchMatches = useMemo(
    () => (isSearching ? filterAndSort(searchableNodes, searchQuery, (n) => n.name) : []),
    [isSearching, searchableNodes, searchQuery]
  )
  const searchTree = useMemo(
    () => (isSearching ? buildSearchTree(searchMatches, getAncestorFolders) : null),
    [isSearching, searchMatches, getAncestorFolders]
  )

  const handleCreateFromSearch = useCallback(() => {
    const name = searchQuery.trim()
    if (!name) return
    const ok = addCategory(name, currentFolderId)
    if (!ok) showToast('Categoria există deja')
    else {
      showToast(`„${name}" adăugată`)
      clearSearch()
    }
  }, [searchQuery, addCategory, currentFolderId, clearSearch, showToast])

  // ── Context menu (stub — neoperațional acum) ─────────────────────────────────
  const handleStub = useCallback(() => {
    closeCatalogMenu()
    showToast('Funcționalitate în curând')
  }, [closeCatalogMenu, showToast])

  const configMenuItems = [
    { label: 'Grupare', icon: <Layers size={18} />, action: handleStub },
    { label: 'Mutare', icon: <FolderInput size={18} />, action: handleStub },
  ]

  const handleToggleTree = useCallback(() => {
    toggleTreeExpanded()
    closeCatalogMenu()
  }, [toggleTreeExpanded, closeCatalogMenu])

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb bar */}
      {!isRoot && !treeExpanded && (
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto border-b border-zinc-800">
          <button
            onClick={() => navigate(null)}
            className="text-xs text-zinc-400 shrink-0 hover:text-zinc-100"
          >
            Catalog
          </button>
          {getBreadcrumb().map((crumb, i, arr) => (
            <span key={crumb.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight size={12} className="text-zinc-600" />
              <button
                onClick={() => navigate(crumb.id)}
                className={[
                  'text-xs',
                  i === arr.length - 1 ? 'text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-100',
                ].join(' ')}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Main content */}
      {treeExpanded ? (
        <div className="flex-1 overflow-y-auto">
          <FullTree parentId={null} depth={0} getChildren={getChildren} />
        </div>
      ) : isSearching ? (
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
          <SearchGroup group={searchTree} depth={0} onTap={handleTap} />
          {searchMatches.length === 0 && (
            <button
              onClick={handleCreateFromSearch}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-blue-400 active:bg-zinc-900"
            >
              <Plus size={18} className="shrink-0" />
              <span className="text-sm">Adaugă „{searchQuery.trim()}"</span>
            </button>
          )}
        </div>
      ) : currentChildren.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Catalogul e gol.<br />
            Scrie un nume în bara de căutare ca să creezi prima categorie.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
          {currentChildren.map((node) => (
            <NodeCard key={node.id} node={node} onTap={handleTap} />
          ))}
        </div>
      )}

      {/* FAB „+" — vizibil doar când căutarea nu are rezultate */}
      {isSearching && searchMatches.length === 0 && (
        <button
          onClick={handleCreateFromSearch}
          className="absolute right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl active:bg-blue-700"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-2xl shadow-xl">
          <span className="flex-1 text-sm text-zinc-100">{toast}</span>
        </div>
      )}

      {/* Context menu — Config (Grupare / Mutare) + Unfold/Fold */}
      <BottomSheet open={catalogMenuOpen} onClose={closeCatalogMenu}>
        <div className="px-4 pb-6">
          <button
            onClick={() => setConfigOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-zinc-400"><Settings size={18} /></span>
            <span className="flex-1 text-left">Config</span>
            <span className="text-zinc-500">
              {configOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          </button>
          {configOpen && (
            <div className="pl-6">
              {configMenuItems.map(({ label, icon, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
                >
                  <span className="text-zinc-400">{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleToggleTree}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-zinc-400">
              {treeExpanded ? <FoldVertical size={18} /> : <UnfoldVertical size={18} />}
            </span>
            <span className="flex-1 text-left">{treeExpanded ? 'Fold' : 'Unfold'}</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
