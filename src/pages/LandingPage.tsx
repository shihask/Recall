import { ArrowRight, Lock, Search, Sparkles, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

const examples = [
  'I saved a Reel about a motorcycle phone holder.',
  'I remember a recipe I saw last month.',
  'Where was that photography tip?',
  'Show me the travel places I saved.',
]

const steps = [
  { icon: Zap, title: 'Save in a second', body: 'Paste a link from Instagram, YouTube, Reddit, X or anywhere. Add a note if you like — or don’t.' },
  { icon: Sparkles, title: 'Recall understands it', body: 'It reads what’s publicly available and writes a short summary, category and tags for you.' },
  { icon: Search, title: 'Find it by describing it', body: 'Months later, describe what you remember. No exact title, creator or date needed.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-safe sm:px-6">
        <div className="flex h-16 w-full items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/login" className="rounded-lg px-3 py-2 text-muted hover:text-fg">
              Log in
            </Link>
            <Link to="/signup" className="rounded-lg bg-fg px-3.5 py-2 font-medium text-bg hover:opacity-90">
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-28">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Remember what you found.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted">
            Save interesting things from across the internet and find them again when you actually need them.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
            >
              Start Remembering
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a href="#how" className="inline-flex h-12 items-center rounded-xl px-5 font-medium text-muted hover:text-fg">
              See how it works
            </a>
          </div>
        </section>

        <section aria-label="Examples" className="mx-auto max-w-2xl px-4 pb-20 sm:px-6">
          <div className="rounded-3xl border border-line bg-surface p-3 shadow-soft sm:p-4">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left text-subtle">
              <Search className="h-5 w-5 shrink-0" aria-hidden />
              <span>What are you trying to remember?</span>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {examples.map((text) => (
                <li key={text} className="px-4 py-3.5 text-left text-[15px] text-fg">
                  <span className="text-subtle">“</span>
                  {text}
                  <span className="text-subtle">”</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="scroll-mt-8 border-t border-line bg-surface/50">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-20 sm:grid-cols-3 sm:px-6">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <div key={title}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <p className="text-xs font-medium tracking-wide text-subtle uppercase">Step {i + 1}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-fg">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Your saves are private to you.</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">
            No public profiles, no feed, no followers. We never sell your saved content, and we don’t train AI models on it.
            Export everything, or delete your account, any time.
          </p>
          <Link to="/signup" className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-fg px-5 font-medium text-bg hover:opacity-90">
            Start Remembering
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-subtle sm:flex-row sm:px-6">
          <span>Recall — Save it now. Find it when you need it.</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}
