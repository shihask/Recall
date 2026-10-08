import { useEffect, useRef, useState } from 'react'

/** True while the referenced element is within `rootMargin` of the viewport. */
export function useInView<T extends Element>(rootMargin = '600px') {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return [ref, inView] as const
}
