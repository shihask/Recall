import { useCallback, useState } from 'react'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import type { CardLayout } from './ItemCard'

export const LAYOUTS = ['grid', 'list'] as const
const KEY = 'recall.layout'

function readStored(): CardLayout | null {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'grid' || v === 'list' ? v : null
  } catch {
    return null
  }
}

/**
 * The user's explicit choice wins; otherwise list on phones (fast one-handed
 * scrolling) and grid on wider screens.
 */
export function useCardLayout(): [CardLayout, (v: CardLayout) => void] {
  const isDesktop = useIsDesktop()
  const [chosen, setChosen] = useState<CardLayout | null>(readStored)
  const set = useCallback((v: CardLayout) => {
    setChosen(v)
    try {
      window.localStorage.setItem(KEY, v)
    } catch {
      // ignore
    }
  }, [])
  return [chosen ?? (isDesktop ? 'grid' : 'list'), set]
}
