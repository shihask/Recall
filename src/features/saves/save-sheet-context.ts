import { createContext, useContext } from 'react'

export interface SavePrefill {
  url?: string
  note?: string
  collectionId?: string
}

export interface SaveSheetContextValue {
  openSave: (prefill?: SavePrefill) => void
}

export const SaveSheetContext = createContext<SaveSheetContextValue | null>(null)

export function useSaveSheet(): SaveSheetContextValue {
  const ctx = useContext(SaveSheetContext)
  if (!ctx) throw new Error('useSaveSheet must be used inside SaveSheetProvider')
  return ctx
}
