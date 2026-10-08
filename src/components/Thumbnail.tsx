import type { Source, SourceType } from '@shared/url.ts'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { safeHttpUrl } from '@/utils/safeUrl'
import { SourceIcon } from './SourceIcon'

interface ThumbnailProps {
  src: string | null | undefined
  source: Source
  type: SourceType
  className?: string
  iconClassName?: string
}

/**
 * External preview image with a calm fallback. Platform CDN links (Instagram
 * especially) are signed and expire, so a broken image is normal — fall back
 * to the source glyph instead of a broken-image icon.
 */
export function Thumbnail({ src, source, type, className, iconClassName }: ThumbnailProps) {
  const safe = safeHttpUrl(src)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = safe && failedSrc !== safe

  return (
    <div className={cn('flex items-center justify-center overflow-hidden bg-surface-2 text-subtle', className)}>
      {showImage ? (
        <img
          src={safe}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(safe)}
          className="h-full w-full object-cover"
        />
      ) : (
        <SourceIcon source={source} type={type} className={cn('h-6 w-6', iconClassName)} />
      )}
    </div>
  )
}
