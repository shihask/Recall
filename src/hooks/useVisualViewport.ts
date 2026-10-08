import { useEffect, useState } from 'react'

export interface ViewportInset {
  /** Pixels between the bottom of the layout viewport and the bottom of the visible area (the on-screen keyboard). */
  bottom: number
  /** Height of the visible area. */
  height: number
}

/**
 * Tracks the part of the layout viewport covered by the on-screen keyboard.
 *
 * iOS Safari keeps `position: fixed` elements pinned to the layout viewport, which does not shrink when
 * the keyboard opens — so a bottom sheet ends up behind it. Whether iOS scrolls the page to compensate
 * depends on timing (e.g. focusing during an open animation), which is why it only happens sometimes.
 * Offsetting by the visual viewport handles both cases.
 */
export function useVisualViewport(enabled: boolean): ViewportInset | null {
  const [inset, setInset] = useState<ViewportInset | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) return
    const update = () => {
      const bottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      setInset((cur) => (cur && cur.bottom === bottom && cur.height === vv.height ? cur : { bottom, height: vv.height }))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setInset(null)
    }
  }, [enabled])

  return inset
}
