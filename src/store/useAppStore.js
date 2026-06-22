import { create } from 'zustand'

export const useAppStore = create((set) => ({
  sideMenuOpen: false,
  openSideMenu: () => set({ sideMenuOpen: true }),
  closeSideMenu: () => set({ sideMenuOpen: false }),
  toggleSideMenu: () => set((s) => ({ sideMenuOpen: !s.sideMenuOpen })),

  // BottomBar search — shared between bar and active sheets
  searchQuery: '',
  searchPlaceholder: 'Caută...',
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchPlaceholder: (p) => set({ searchPlaceholder: p }),
  clearSearch: () => set({ searchQuery: '' }),

  // Catalog context menu trigger (BottomBar → CatalogPage)
  catalogMenuOpen: false,
  openCatalogMenu: () => set({ catalogMenuOpen: true }),
  closeCatalogMenu: () => set({ catalogMenuOpen: false }),

  // Forțează ascunderea BottomBar-ului (sheet fără căutare — ex: GroupNameSheet)
  bottomBarHidden: false,
  setBottomBarHidden: (v) => set({ bottomBarHidden: v }),
}))
