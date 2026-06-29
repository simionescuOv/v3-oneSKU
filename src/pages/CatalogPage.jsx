import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Plus, FolderInput, ChevronRight, ChevronLeft, ChevronDown, Folder, Tag,
  UnfoldVertical, FoldVertical, Check,
} from 'lucide-react'
import { useCatalogStore } from '../store/useCatalogStore'
import { useAppStore } from '../store/useAppStore'
import { filterAndSort, normalize } from '../lib/search'
import { usePicker } from '../hooks/usePicker'
import NodeCard from '../components/catalog/NodeCard'
import BottomSheet from '../components/catalog/BottomSheet'
import ActionBar from '../components/catalog/ActionBar'
import DestinationPicker from '../components/catalog/DestinationPicker'
import SubgroupSheet from '../components/catalog/SubgroupSheet'

const nodeLabel = (node) => node.name
const ELLIPSIS_CRUMB = { id: '__ellipsis__', name: '…' }
// Dezactivat temporar — notificările de succes după creare/mutare (erorile rămân vizibile).
const SHOW_ACTION_TOASTS = false

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

// A3 — Scoring-ul ordonează categoriile în interiorul unui grup-folder, dar NU
// rearanjează grupurile-folder între ele: ordinea folderelor rămâne cea naturală
// (după poziția în arbore), independent de scorul rezultatelor din ele.
function sortTreeFolders(group, orderOf) {
  group.children.sort((a, b) => orderOf(a.node.id) - orderOf(b.node.id))
  group.children.forEach((child) => sortTreeFolders(child, orderOf))
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

const EMPTY_SET = new Set()

// `selectable` activează checkbox-urile (SPEC_MutareCrossFolder §3.2 — mod
// selecție Mutare cross-folder). Folderele temporare sunt deja filtrate de
// `getChildren`, deci nu apar aici.
// Fold/unfold per-folder: checkbox-ul (selecție) și rândul (deschide/închide
// folderul) au target-uri de tap separate, ca să nu se interfereze.
// `visibleIds`, dacă e setat (căutare activă), restrânge nodurile afișate la
// rezultate + lanțul lor de foldere-părinte (foldarea e ignorată în acest caz).
function FullTree({ parentId, depth, getChildren, selectable, selectedIds, onToggle, collapsedIds, onToggleFold, visibleIds, currentFolderId }) {
  let children = getChildren(parentId)
  if (visibleIds) children = children.filter((n) => visibleIds.has(n.id))
  return children.map((node) => {
    const isFolder = node.type === 'folder'
    const isCollapsed = isFolder && !visibleIds && collapsedIds.has(node.id)
    // Echivalentul folderului curent (ultimul, evidențiat în breadcrumb) trebuie
    // colorat la fel și aici, ca să se vadă unde te afli direct în arbore.
    const isCurrent = isFolder && node.id === currentFolderId
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2.5 text-sm border-b border-zinc-900"
          style={{ paddingLeft: 16 + depth * 16, paddingRight: 16 }}
        >
          {selectable && (
            <span
              onClick={() => onToggle(node.id)}
              className={[
                'shrink-0 flex items-center justify-center w-5 h-5 rounded-full border',
                selectedIds.has(node.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-600 text-transparent',
              ].join(' ')}
            >
              <Check size={14} />
            </span>
          )}
          <div
            className="flex-1 flex items-center gap-2 min-w-0"
            onClick={isFolder ? () => onToggleFold(node.id) : (selectable ? () => onToggle(node.id) : undefined)}
          >
            {isFolder
              ? (isCollapsed ? <ChevronRight size={14} className="text-zinc-500 shrink-0" /> : <ChevronDown size={14} className="text-zinc-500 shrink-0" />)
              : <span className="w-3.5 shrink-0" />
            }
            {isFolder
              ? <Folder size={16} className="text-amber-400 shrink-0" />
              : <Tag size={16} className="text-blue-400 shrink-0" />
            }
            <span className={isCurrent ? 'flex-1 text-amber-400 font-semibold truncate' : 'flex-1 text-zinc-100 truncate'}>
              {node.name}
            </span>
            {node.type === 'category' && (
              <span className="text-xs text-zinc-500 shrink-0">{node.products ?? 0} produse</span>
            )}
          </div>
        </div>
        {isFolder && !isCollapsed && (
          <FullTree
            parentId={node.id}
            depth={depth + 1}
            getChildren={getChildren}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggle={onToggle}
            collapsedIds={collapsedIds}
            onToggleFold={onToggleFold}
            visibleIds={visibleIds}
            currentFolderId={currentFolderId}
          />
        )}
      </div>
    )
  })
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

  const selectionMode = useCatalogStore((s) => s.selectionMode)
  const selectedNodeIds = useCatalogStore((s) => s.selectedNodeIds)
  const enterSelectionMode = useCatalogStore((s) => s.enterSelectionMode)
  const toggleNodeSelection = useCatalogStore((s) => s.toggleNodeSelection)
  const clearSelection = useCatalogStore((s) => s.clearSelection)
  const moveNodes = useCatalogStore((s) => s.moveNodes)
  const createTempFolder = useCatalogStore((s) => s.createTempFolder)
  const dissolveTempFolder = useCatalogStore((s) => s.dissolveTempFolder)
  const promoteTempFolder = useCatalogStore((s) => s.promoteTempFolder)
  const cleanupTempFolders = useCatalogStore((s) => s.cleanupTempFolders)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const catalogMenuOpen = useAppStore((s) => s.catalogMenuOpen)
  const closeCatalogMenu = useAppStore((s) => s.closeCatalogMenu)

  const [toast, setToast] = useState(null)
  // Mutare cross-folder (SPEC_MutareCrossFolder §3.3): temp folder + cele
  // două sheet-uri ale fluxului (destinație → subfolder opțional).
  const [tempFolderId, setTempFolderId] = useState(null)
  const [pendingMoveCount, setPendingMoveCount] = useState(0)
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false)
  const [subgroupSheetOpen, setSubgroupSheetOpen] = useState(false)
  // Toate elementele selectate erau la rădăcină → destinația „Rădăcină" devine
  // „New folder" și sare peste întrebarea „New folder?" (intenția e deja clară).
  const [allRootSelection, setAllRootSelection] = useState(false)
  const [skipSubgroupQuestion, setSkipSubgroupQuestion] = useState(false)
  // Fold/unfold per-folder în modul Unfold (independent de selecție/căutare).
  const [collapsedFolderIds, setCollapsedFolderIds] = useState(() => new Set())
  const toastTimer = useRef(null)
  const isPopRef = useRef(false)
  const selectionModeRef = useRef(selectionMode)
  selectionModeRef.current = selectionMode
  const destinationIdRef = useRef(null)
  const goHome = useRouterNavigate()

  const currentChildren = getChildren(currentFolderId)
  const isSearching = searchQuery.trim().length > 0

  // ── Placeholder ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setSearchPlaceholder('Caută categorie sau folder...')
  }, [setSearchPlaceholder])

  // ── Cleanup foldere temporare orfane (SPEC_MutareCrossFolder §2.4, §3.6) ──────
  useEffect(() => {
    cleanupTempFolders()
  }, [cleanupTempFolders])

  // ── Back gesture (Android/browser) → exit selection sau navigate up ──────────
  useEffect(() => {
    const onPopState = () => {
      if (selectionModeRef.current) {
        clearSelection()
        return
      }
      isPopRef.current = true
      navigateUp()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [navigateUp, clearSelection])

  useEffect(() => {
    if (isPopRef.current) {
      isPopRef.current = false
      return
    }
    if (currentFolderId !== null) {
      window.history.pushState({ catalogFolder: currentFolderId }, '')
    }
  }, [currentFolderId])

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
      goHome(`/catalog/category/${node.id}`)
    }
  }, [navigate, goHome])

  // ── Search (= unicul mecanism de adăugare categorie) ─────────────────────────
  // Caută atât în categorii, cât și în foldere (ex: „i” → folderul „Îmbrăcăminte”)
  // Modul inline al usePicker: BottomBar deține input-ul, hook-ul filtrează lista.
  const searchableNodes = useMemo(
    () => nodes.filter((n) => n.type === 'category' || n.type === 'folder'),
    [nodes]
  )
  // usePicker (mod inline, SPEC_Picker_v2) e motorul canonic de căutare;
  // A2 e implementat în interiorul hook-ului (exactExists normalizat).
  const { filteredItems: searchMatches, showCreate: pickerShowCreate } = usePicker({
    mode: 'inline',
    items: isSearching ? searchableNodes : [],
    labelFn: nodeLabel,
    query: searchQuery,
    multiSelect: false,
    allowCreate: true,
  })
  const searchTree = useMemo(() => {
    if (!isSearching) return null
    const tree = buildSearchTree(searchMatches, getAncestorFolders)
    const orderOf = (id) => nodes.findIndex((n) => n.id === id)
    sortTreeFolders(tree, orderOf)
    return tree
  }, [isSearching, searchMatches, getAncestorFolders, nodes])

  const showCreate = !selectionMode && pickerShowCreate

  // Când arborele se actualizează (creare, mutare, grupare), în Unfold rămâne
  // deschis doar drumul către folderul actualizat (el + părinții lui) —
  // restul folderelor se pliază, ca să se vadă imediat unde s-a produs
  // schimbarea, fără zgomot vizual.
  const collapseAllExcept = useCallback((updatedFolderId) => {
    if (!updatedFolderId) return
    const keepOpen = new Set([updatedFolderId, ...getAncestorFolders(updatedFolderId).map((f) => f.id)])
    const allFolderIds = nodes.filter((n) => n.type === 'folder' && !n.isTemp).map((n) => n.id)
    setCollapsedFolderIds(new Set(allFolderIds.filter((id) => !keepOpen.has(id))))
  }, [nodes, getAncestorFolders])

  const handleCreateFromSearch = useCallback(() => {
    const name = searchQuery.trim()
    if (!name) return
    // Gardă hard: re-verifică unicitatea globală chiar înainte de creare.
    if (nodes.some((n) => normalize(n.name) === normalize(name))) {
      showToast(`Există deja „${name}"`)
      return
    }
    const ok = addCategory(name, currentFolderId)
    if (!ok) showToast(`Există deja „${name}"`)
    else {
      if (SHOW_ACTION_TOASTS) showToast(`„${name}" adăugată`)
      collapseAllExcept(currentFolderId)
      clearSearch()
    }
  }, [searchQuery, nodes, addCategory, currentFolderId, clearSearch, showToast, collapseAllExcept])

  // ── Selection mode ───────────────────────────────────────────────────────────
  const selectionItems = useMemo(() => {
    if (!selectionMode) return []
    return isSearching
      ? filterAndSort(currentChildren, searchQuery, (n) => n.name)
      : currentChildren
  }, [selectionMode, isSearching, currentChildren, searchQuery])

  // ── Organize — pas „Organize < N >" (SPEC_MutareCrossFolder §3.3) ─────────────
  const handleContinue = useCallback(() => {
    if (selectionMode !== 'move') return
    const ids = [...selectedNodeIds]
    const allRoot = ids.every((id) => nodes.find((n) => n.id === id)?.parentId === null)
    const tempId = createTempFolder()
    moveNodes(ids, tempId)
    setTempFolderId(tempId)
    setPendingMoveCount(ids.length)
    setAllRootSelection(allRoot)
    setDestinationPickerOpen(true)
  }, [selectionMode, selectedNodeIds, nodes, createTempFolder, moveNodes])

  const finalizeMove = useCallback((updatedFolderId, subfolderName) => {
    setDestinationPickerOpen(false)
    setSubgroupSheetOpen(false)
    setTempFolderId(null)
    clearSelection()
    collapseAllExcept(updatedFolderId)
    if (SHOW_ACTION_TOASTS) {
      const base = `${pendingMoveCount} ${pendingMoveCount === 1 ? 'element mutat' : 'elemente mutate'}`
      showToast(subfolderName ? `${base} în subfolderul „${subfolderName}"` : base)
    }
  }, [pendingMoveCount, clearSelection, showToast, collapseAllExcept])

  const handleDestinationPicked = useCallback((destinationId, _label, skipQuestion) => {
    destinationIdRef.current = destinationId
    moveNodes([tempFolderId], destinationId)
    setDestinationPickerOpen(false)
    setSkipSubgroupQuestion(!!skipQuestion)
    setSubgroupSheetOpen(true)
  }, [tempFolderId, moveNodes])

  const handleSubgroupNo = useCallback(() => {
    dissolveTempFolder(tempFolderId)
    finalizeMove(destinationIdRef.current, null)
  }, [tempFolderId, dissolveTempFolder, finalizeMove])

  const handleSubgroupYes = useCallback((name) => {
    const ok = promoteTempFolder(tempFolderId, name)
    if (!ok) {
      showToast(`Există deja „${name}"`)
      return
    }
    finalizeMove(tempFolderId, name.trim())
  }, [tempFolderId, promoteTempFolder, finalizeMove, showToast])

  // ── Context menu — Organize ───────────────────────────────────────────────────
  const handleOrganize = useCallback(() => {
    closeCatalogMenu()
    clearSearch()
    enterSelectionMode('move')
  }, [closeCatalogMenu, clearSearch, enterSelectionMode])

  // Organize e cross-folder (Unfold) — verificăm tot arborele, nu doar nivelul curent.
  const organizeDisabled = nodes.filter((n) => !n.isTemp).length < 1

  const handleToggleTree = useCallback(() => {
    toggleTreeExpanded()
    closeCatalogMenu()
  }, [toggleTreeExpanded, closeCatalogMenu])

  // Tap pe un folder în Unfold îl pliază/depliază ȚI marchează ca „locul curent" —
  // cărarea din header trebuie să reflecte exact folderul pe care ai tăut, oriunde
  // s-ar afla el în arbore (vezi feedback: al 6-lea folder din cale nu se evidenția).
  const toggleFold = useCallback((id) => {
    navigate(id)
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [navigate])

  // Căutarea în Unfold trebuie să filtreze exact ca în modul normal (același
  // motor — usePicker/searchMatches): păstrăm doar rezultatele + lanțul lor
  // de foldere-părinte, ca structura să rămână lizibilă.
  const searchVisibleIds = useMemo(() => {
    if (!isSearching || !treeExpanded) return null
    const set = new Set()
    for (const item of searchMatches) {
      set.add(item.id)
      for (const folder of getAncestorFolders(item.id)) set.add(folder.id)
    }
    return set
  }, [isSearching, treeExpanded, searchMatches, getAncestorFolders])

  // ── Header propriu (back + cale clicabilă) — Catalog n-are TopBar generic ────
  // „Catalog" e mereu primul, cu chenar de buton (nu e folder). Pe un singur rând
  // calea NU se scrolează orizontal: arată mereu primul și ultimul element, iar
  // mijlocul se rupe cu „…". „…" e apăsabil → expandează toată calea pe mai multe
  // rânduri (wrap), ca să poți sări direct la orice folder intermediar.
  const fullCrumbs = useMemo(
    () => [{ id: null, name: 'Catalog' }, ...getBreadcrumb()],
    [getBreadcrumb, currentFolderId]
  )
  const isCrumbTruncated = fullCrumbs.length > 3
  const collapsedCrumbs = isCrumbTruncated
    ? [fullCrumbs[0], ELLIPSIS_CRUMB, fullCrumbs[fullCrumbs.length - 1]]
    : fullCrumbs

  const [crumbsExpanded, setCrumbsExpanded] = useState(false)
  // Navigarea într-un alt folder reașează calea în forma compactă.
  useEffect(() => { setCrumbsExpanded(false) }, [currentFolderId])

  const crumbClasses = (crumb, isLast) => {
    const isRootCrumb = crumb.id === null
    return [
      'text-sm',
      isRootCrumb
        ? isLast
          ? 'shrink-0 px-2.5 py-1 rounded-lg border border-blue-400/60 text-blue-400 font-semibold'
          : 'shrink-0 px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
        : isLast
          ? 'text-amber-400 font-semibold'
          : 'text-zinc-400 hover:text-zinc-100',
    ].join(' ')
  }

  const goToCrumb = (id) => {
    setCrumbsExpanded(false)
    navigate(id)
  }

  // Săgeata duce direct la home, indiferent de adâncime — nu se mai întoarce
  // pas cu pas pe cărare (pentru asta există linkurile din breadcrumb).
  const handleBack = useCallback(() => {
    if (selectionMode) clearSelection()
    else goHome('/')
  }, [selectionMode, clearSelection, goHome])

  return (
    <div className="flex flex-col h-full">
      {/* Header propriu — back + cale clicabilă, înlocuiește TopBar-ul generic
          (redundant pe Catalog). „Catalog" are chenar de buton (nu e folder);
          fiecare element e link direct spre rută. Rămâne vizibil inclusiv în
          Unfold. Săgeata e mereu vizibilă: la root duce spre home, altfel un
          nivel sus. Calea: un rând fără scroll (mijlocul „…"), iar „…" expandează
          tot drumul pe mai multe rânduri. */}
      <div className="flex-none flex items-start gap-1 px-2 py-2 border-b border-zinc-800">
        <button
          onClick={handleBack}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={20} />
        </button>

        {crumbsExpanded && isCrumbTruncated ? (
          // Calea completă, pe câte rânduri e nevoie — fiecare element e link.
          <div className="flex flex-wrap content-start items-center gap-x-1.5 gap-y-1.5 min-h-8 min-w-0 flex-1">
            {fullCrumbs.map((crumb, i, arr) => {
              const isLast = i === arr.length - 1
              return (
                <span key={crumb.id ?? `full-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-zinc-600 text-sm">|</span>}
                  <button onClick={() => goToCrumb(crumb.id)} className={crumbClasses(crumb, isLast)}>
                    {crumb.name}
                  </button>
                </span>
              )
            })}
          </div>
        ) : (
          // Un singur rând, fără scroll orizontal; ultimul element se trunchiază.
          <div className="flex items-center gap-1.5 min-h-8 min-w-0 flex-1 overflow-hidden">
            {collapsedCrumbs.map((crumb, i, arr) => {
              const isLast = i === arr.length - 1
              const isEllipsis = crumb === ELLIPSIS_CRUMB
              return (
                <span
                  key={crumb.id ?? (isEllipsis ? 'ellipsis' : `c-${i}`)}
                  className={['flex items-center gap-1.5', isLast ? 'min-w-0 flex-1' : 'shrink-0'].join(' ')}
                >
                  {i > 0 && <span className="text-zinc-600 text-sm shrink-0">|</span>}
                  {isEllipsis ? (
                    <button
                      onClick={() => setCrumbsExpanded(true)}
                      className="shrink-0 px-1.5 rounded text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                      aria-label="Arată toată calea"
                    >
                      …
                    </button>
                  ) : (
                    <button
                      onClick={() => goToCrumb(crumb.id)}
                      className={[crumbClasses(crumb, isLast), isLast ? 'min-w-0 truncate' : 'whitespace-nowrap'].join(' ')}
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Main content */}
      {treeExpanded ? (
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ paddingBottom: selectionMode ? '3.5rem' : undefined }}
        >
          <FullTree
            parentId={null}
            depth={0}
            getChildren={getChildren}
            selectable={selectionMode === 'move'}
            selectedIds={selectedNodeIds}
            onToggle={toggleNodeSelection}
            collapsedIds={collapsedFolderIds}
            onToggleFold={toggleFold}
            visibleIds={searchVisibleIds}
            currentFolderId={currentFolderId}
          />
          {isSearching && searchVisibleIds?.size === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Niciun rezultat
            </div>
          )}
        </div>
      ) : selectionMode ? (
        <div
          className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800"
          style={{ paddingBottom: '3.5rem' }}
        >
          {selectionItems.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              selectable
              selected={selectedNodeIds.has(node.id)}
              onTap={(n) => toggleNodeSelection(n.id)}
            />
          ))}
          {selectionItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Niciun element
            </div>
          )}
        </div>
      ) : isSearching ? (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          <SearchGroup group={searchTree} depth={0} onTap={handleTap} />
          {showCreate && (
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
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          {currentChildren.map((node) => (
            <NodeCard key={node.id} node={node} onTap={handleTap} />
          ))}
        </div>
      )}

      {/* FAB „+" — vizibil doar când căutarea nu are match exact */}
      {showCreate && (
        <button
          onClick={handleCreateFromSearch}
          className="absolute right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl active:bg-blue-700"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Action bar — mod selecție (deasupra BottomBar-ului) */}
      <ActionBar onContinue={handleContinue} />

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-2xl shadow-xl">
          <span className="flex-1 text-sm text-zinc-100">{toast}</span>
        </div>
      )}

      {/* Context menu — Organize + Unfold/Fold */}
      <BottomSheet open={catalogMenuOpen} onClose={closeCatalogMenu}>
        <div className="px-4 pb-6">
          <button
            onClick={organizeDisabled ? undefined : handleOrganize}
            disabled={organizeDisabled}
            className={[
              'w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm',
              organizeDisabled
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700',
            ].join(' ')}
          >
            <span className={organizeDisabled ? 'text-zinc-600' : 'text-zinc-400'}><FolderInput size={18} /></span>
            <span className="flex-1 text-left">Organize</span>
          </button>
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

      {/* Sheets pasul final */}
      <DestinationPicker
        open={destinationPickerOpen}
        onClose={() => setDestinationPickerOpen(false)}
        tempFolderId={tempFolderId}
        onPicked={handleDestinationPicked}
        allRootSelection={allRootSelection}
      />
      <SubgroupSheet
        open={subgroupSheetOpen}
        onClose={() => setSubgroupSheetOpen(false)}
        onConfirmNo={handleSubgroupNo}
        onConfirmYes={handleSubgroupYes}
        startExpanded={skipSubgroupQuestion}
      />
    </div>
  )
}
