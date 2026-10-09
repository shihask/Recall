import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useSaveOnOpen } from './clipboard'
import { SaveSheetContext, type SavePrefill } from './save-sheet-context'
import { SaveSheet } from './SaveSheet'

/** One Save sheet for the whole app, openable from anywhere (nav, Home, share target, keyboard). */
export function SaveSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<SavePrefill | null>(null)
  const [session, setSession] = useState(0)

  const openSave = useCallback((next?: SavePrefill) => {
    setPrefill(next ?? null)
    setSession((n) => n + 1)
    setOpen(true)
  }, [])

  useSaveOnOpen(openSave, open)

  const value = useMemo(() => ({ openSave }), [openSave])
  return (
    <SaveSheetContext.Provider value={value}>
      {children}
      <SaveSheet open={open} onOpenChange={setOpen} prefill={prefill} session={session} />
    </SaveSheetContext.Provider>
  )
}
