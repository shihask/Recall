import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-4 pt-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <Logo className="mb-10 self-center" />
        <h1 className="text-center text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  )
}
