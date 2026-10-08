import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-7 w-7', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      {/* Concentric "memory" rings with a found point. */}
      <circle cx="16" cy="16" r="8.5" fill="none" strokeWidth="2.2" className="stroke-accent-fg" opacity="0.45" />
      <circle cx="16" cy="16" r="4.2" fill="none" strokeWidth="2.2" className="stroke-accent-fg" opacity="0.8" />
      <circle cx="16" cy="16" r="1.6" className="fill-accent-fg" />
    </svg>
  )
}

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight', className)}>
      <LogoMark />
      <span>Recall</span>
    </Link>
  )
}
