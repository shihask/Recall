import { Download, ImageDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { errorMessage } from '@/services/supabase/errors'
import type { SavedItem } from '@/types/domain'
import { canShareFile, downloadFile, fetchMediaFile, isAppleMobile, isGalleryEnabled, shareFile } from './gallery'

/**
 * Download an Instagram save's video/photo. On iPhone the share sheet ("Save
 * Video") has to open from a tap, and the download takes longer than a tap
 * stays valid — so it's two taps there: prepare, then save.
 */
export function SaveToGalleryButton({ item }: { item: Pick<SavedItem, 'id' | 'source'> }) {
  const [state, setState] = useState<'idle' | 'preparing' | 'ready'>('idle')
  const [file, setFile] = useState<File | null>(null)

  if (item.source !== 'instagram' || !isGalleryEnabled()) return null

  async function prepare() {
    setState('preparing')
    try {
      const f = await fetchMediaFile(item.id)
      if (isAppleMobile() && canShareFile(f)) {
        setFile(f)
        setState('ready')
        toast.message('Ready. Tap Save, then “Save Video” or “Save Image”.')
      } else {
        downloadFile(f)
        setState('idle')
        toast.success('Downloading… You’ll find it in your Downloads / Gallery.')
      }
    } catch (error) {
      setState('idle')
      toast.error(errorMessage(error))
    }
  }

  async function save() {
    if (!file) return
    try {
      await shareFile(file)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('Couldn’t open the share sheet. Please try again.')
    } finally {
      setState('idle')
      setFile(null)
    }
  }

  if (state === 'ready') {
    return (
      <Button size="lg" className="h-12 animate-pop-in" onClick={() => void save()}>
        <ImageDown className="h-5 w-5" aria-hidden /> Save
      </Button>
    )
  }
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-12 w-12"
      disabled={state === 'preparing'}
      onClick={() => void prepare()}
      aria-label="Save to gallery"
      title="Save to gallery"
    >
      {state === 'preparing' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
    </Button>
  )
}
