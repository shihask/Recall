import { Archive, FolderOpen, Heart, Home, Library, Plus, Search, Settings, Tag, User } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'
import { useSaveSheet } from '@/features/saves/save-sheet-context'
import { cn } from '@/lib/cn'

const primaryNav = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/saves', label: 'All Saves', icon: Library },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/collections', label: 'Collections', icon: FolderOpen },
  { to: '/tags', label: 'Tags', icon: Tag },
  { to: '/archive', label: 'Archive', icon: Archive },
] as const

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function AppLayout() {
  const { openSave } = useSaveSheet()
  const navigate = useNavigate()

  // Keyboard: "/" focuses search, "s" opens Save — only when not typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      if (e.key === '/') {
        e.preventDefault()
        navigate('/search')
      } else if (e.key === 's') {
        e.preventDefault()
        openSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, openSave])

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 lg:flex">
        <NavLink to="/home" className="mb-6 flex items-center gap-2.5 px-3 text-[17px] font-semibold tracking-tight">
          <LogoMark />
          Recall
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            cn(
              'mb-2 flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-subtle transition-colors hover:border-line-strong',
              isActive && 'border-accent text-fg',
            )
          }
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-line px-1.5 text-[11px] text-subtle">/</kbd>
        </NavLink>

        <button
          type="button"
          onClick={() => openSave()}
          className="mb-5 flex h-10 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Save
        </button>

        <nav aria-label="Library" className="flex flex-col gap-0.5">
          {primaryNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg',
                  isActive && 'bg-surface-2 font-medium text-fg',
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-line pt-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg',
                isActive && 'bg-surface-2 font-medium text-fg',
              )
            }
          >
            <Settings className="h-[18px] w-[18px]" aria-hidden />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main id="main" className="min-w-0 flex-1 pb-28 lg:pb-12">
        <div className="mx-auto w-full max-w-6xl px-4 pt-safe sm:px-6 lg:px-10">
          <div className="pt-5 sm:pt-8">
            <Outlet />
          </div>
        </div>
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-safe backdrop-blur-lg lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          <BottomLink to="/home" label="Home" icon={Home} />
          <BottomLink to="/search" label="Search" icon={Search} />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => openSave()}
              aria-label="Save something"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lift transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" aria-hidden />
            </button>
          </div>
          <BottomLink to="/collections" label="Collections" icon={FolderOpen} />
          <BottomLink to="/settings" label="Profile" icon={User} />
        </div>
      </nav>
    </div>
  )
}

function BottomLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Home }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn('flex flex-col items-center gap-1 py-1 text-[11px] font-medium text-subtle', isActive && 'text-fg')
      }
    >
      <Icon className="h-[22px] w-[22px]" aria-hidden />
      {label}
    </NavLink>
  )
}
