import { AtSign, Camera, CirclePlay, FileText, Globe, Image, MessagesSquare, Users, type LucideIcon } from 'lucide-react'
import type { Source, SourceType } from '@shared/url.ts'
import { cn } from '@/lib/cn'

// Calm, generic glyphs rather than brand logos — Recall is a memory layer,
// not a re-skin of each platform.
const SOURCE_ICONS: Record<Source, LucideIcon> = {
  instagram: Camera,
  youtube: CirclePlay,
  reddit: MessagesSquare,
  x: AtSign,
  facebook: Users,
  website: Globe,
  other: Globe,
}

export function SourceIcon({ source, type, className }: { source: Source; type?: SourceType; className?: string }) {
  let Icon = SOURCE_ICONS[source]
  if ((source === 'website' || source === 'other') && type === 'pdf') Icon = FileText
  if ((source === 'website' || source === 'other') && type === 'image') Icon = Image
  return <Icon className={cn('h-4 w-4', className)} aria-hidden />
}
