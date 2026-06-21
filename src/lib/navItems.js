import { User, BookOpen, Warehouse, Store, LayoutDashboard, Settings } from 'lucide-react'

export const NAV_ITEMS = [
  { path: '/account',    label: 'Account',    Icon: User },
  { path: '/catalog',    label: 'Catalog',    Icon: BookOpen },
  { path: '/stockhub',   label: 'StockHub',   Icon: Warehouse },
  { path: '/storefront', label: 'Storefront', Icon: Store },
  { path: '/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { path: '/settings',   label: 'Settings',   Icon: Settings },
]
