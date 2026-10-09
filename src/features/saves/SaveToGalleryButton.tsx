import { CircleCheck, Download, ImageDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { errorMessage } from '@/services/supabase/errors'
import type { SavedItem } from '@/types/domain'
import { longDate } from '@/utils/dates'
import { canShareFile, downloadedAt, downloadFile, fetchMediaFile, isAppleMobile, isGalleryEnabled, markDownloaded, shareFile } from './gallery'

/**
 * Download an Instagram save's video/photo. On iPhone the share sheet ("Save
 * Video") has to open from a tap, and the download takes longer than a tap
 * stays valid — so it's two taps there: prepare, then save. Once this device
 * has it, the button shows a check and asks before downloading again.
 */
export function SaveToGalleryButton({ item }: { item: Pick<SavedItem, 'id' | 'source'> }) {
  const [state, setState] = useState<'idle' | 'preparing' | 'ready'>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [savedAt, setSavedAt] = useState(() => downloadedAt(item.id))
  const [confirming, setConfirming] = useState(false)

  if (item.source !== 'instagram' || !isGalleryEnabled()) return null

  function done() {
    markDownloaded(item.id)
    setSavedAt(new Date().toISOString())
  }

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
        done()
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
      done() // Resolves only when the share sheet completed (e.g. "Save Video").
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

  const label = savedAt ? 'Saved to gallery — download again' : 'Save to gallery'
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={savedAt ? 'h-12 w-12 text-success' : 'h-12 w-12'}
        disabled={state === 'preparing'}
        onClick={() => (savedAt ? setConfirming(true) : void prepare())}
        aria-label={label}
        title={label}
      >
        {state === 'preparing' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : savedAt ? (
          <CircleCheck className="h-5 w-5" />
        ) : (
          <Download className="h-5 w-5" />
        )}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Already in your gallery"
        description={`You saved this to your gallery on ${savedAt ? longDate(savedAt) : 'this device'}. Download it again?`}
        confirmLabel="Download again"
        onConfirm={() => {
          setConfirming(false)
          void prepare()
        }}
      />
    </>
  )
}
