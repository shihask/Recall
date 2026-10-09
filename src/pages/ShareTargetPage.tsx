import { extractUrlFromText } from '@shared/url.ts'
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/misc'
import { rememberOffered } from '@/features/saves/clipboard'
import { useSaveSheet } from '@/features/saves/save-sheet-context'

/**
 * Landing route for the PWA share target and the "Save" shortcut:
 *   /save?url=…&text=…&title=…
 * Apps differ in which field carries the link (Instagram puts it in `text`),
 * so all three are searched. Opens the Save sheet prefilled on Home.
 */
export default function ShareTargetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { openSave } = useSaveSheet()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const url = [params.get('url'), params.get('text'), params.get('title')].map(extractUrlFromText).find(Boolean) ?? undefined
    // The same link is often still on the clipboard: don't offer it again.
    if (url) rememberOffered(url)
    navigate('/home', { replace: true })
    openSave(url ? { url } : undefined)
  }, [params, navigate, openSave])

  return <FullPageSpinner />
}
