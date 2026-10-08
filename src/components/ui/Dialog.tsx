import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Visually hide the header (title is still announced to screen readers). */
  hideHeader?: boolean
  children: ReactNode
  className?: string
  onOpenAutoFocus?: (e: Event) => void
}

/**
 * Responsive dialog: a bottom sheet on phones (thumb-reachable, one-handed),
 * a centered modal from `sm` up.
 */
export function Dialog({ open, onOpenChange, title, description, hideHeader, children, className, onOpenAutoFocus }: DialogProps) {
  const isDesktop = useIsDesktop()
  // Keep the bottom sheet above the iOS keyboard instead of behind it.
  const viewport = useVisualViewport(open && !isDesktop)
  const keyboardOpen = !!viewport && viewport.bottom > 0
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          onOpenAutoFocus={onOpenAutoFocus}
          style={
            viewport
              ? { bottom: viewport.bottom, maxHeight: Math.round(viewport.height * 0.92), paddingBottom: keyboardOpen ? 0 : undefined }
              : undefined
          }
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-lift focus:outline-none',
            'inset-x-0 bottom-0 rounded-t-3xl pb-safe data-[state=open]:animate-sheet-up',
            'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0 sm:data-[state=open]:animate-pop-in',
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className={cn('flex items-start justify-between gap-4 px-5 pt-4 sm:px-6 sm:pt-5', hideHeader && 'sr-only')}>
            <div>
              <RadixDialog.Title className="text-lg font-semibold tracking-tight">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="-mt-1 -mr-2 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="h-5 w-5" />
            </RadixDialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pt-4 pb-5 sm:px-6 sm:pb-6">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
