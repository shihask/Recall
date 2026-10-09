import { useEffect, useState } from 'react'
import type { SavedItem } from '@/types/domain'

export const PROCESSING_STEPS = ['Fetching the preview', 'Reading the caption', 'Summarizing', 'Adding tags and a collection'] as const

const STEP_MS = 2200

/**
 * Which processing step to show. The pipeline doesn't report progress, so time
 * moves it along (never past the last step), and a title arriving proves the
 * preview step is done.
 */
export function useProcessingStep(item: Pick<SavedItem, 'title'> | null | undefined): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), STEP_MS)
    return () => window.clearInterval(id)
  }, [])
  const floor = item?.title ? 1 : 0
  return Math.min(Math.max(tick, floor), PROCESSING_STEPS.length - 1)
}
