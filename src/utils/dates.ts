import { differenceInCalendarDays, format, formatDistanceStrict } from 'date-fns'

/** "Saved today", "Saved yesterday", "Saved 12 days ago", "Saved 3 months ago". */
export function savedAgo(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const days = differenceInCalendarDays(now, date)
  if (days <= 0) return 'Saved today'
  if (days === 1) return 'Saved yesterday'
  return `Saved ${formatDistanceStrict(date, now, { addSuffix: true, roundingMethod: 'floor' })}`
}

/** "12 September 2026" */
export function longDate(iso: string): string {
  return format(new Date(iso), 'd MMMM yyyy')
}
