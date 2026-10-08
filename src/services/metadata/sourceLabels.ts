import type { Source, SourceType } from '@shared/url.ts'

export const SOURCE_LABELS: Record<Source, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  reddit: 'Reddit',
  x: 'X',
  facebook: 'Facebook',
  website: 'Website',
  other: 'Other',
}

const TYPE_LABELS: Record<SourceType, string> = {
  reel: 'Reel',
  post: 'Post',
  short: 'Short',
  video: 'Video',
  article: 'Article',
  product: 'Product',
  pdf: 'PDF',
  image: 'Image',
  link: 'Link',
}

export function sourceTypeLabel(type: SourceType): string {
  return TYPE_LABELS[type]
}

/** "Instagram Reel", "YouTube Short", "Website" … */
export function describeSource(source: Source, type: SourceType): string {
  if (source === 'website' || source === 'other') return type === 'link' ? SOURCE_LABELS[source] : TYPE_LABELS[type]
  if (type === 'link') return SOURCE_LABELS[source]
  if (source === 'x' && type === 'post') return 'X post'
  return `${SOURCE_LABELS[source]} ${TYPE_LABELS[type]}`
}

/** What to call the original when there's no title: "Open in Instagram". */
export function openOriginalLabel(source: Source): string {
  return source === 'website' || source === 'other' ? 'Open Original' : `Open in ${SOURCE_LABELS[source]}`
}

/** Fallback title for items whose metadata isn't available (yet). */
export function placeholderTitle(source: Source, type: SourceType, host: string): string {
  if (source === 'website' || source === 'other') return host
  return describeSource(source, type)
}
