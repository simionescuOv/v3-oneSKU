import { create } from 'zustand'
import { mockSpaces } from '../mock/spaces'

// Sursa de date: mock acum, Supabase mai târziu.

export const useStockStore = create((set) => ({
  spaces: mockSpaces,
  isLoading: false,
}))
