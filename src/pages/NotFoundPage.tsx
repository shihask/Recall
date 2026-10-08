import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-subtle">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page doesn’t exist.</h1>
      <p className="mt-2 text-muted">But your memories are safe.</p>
      <Link to="/" className="mt-6 text-sm font-medium hover:underline">
        Go home
      </Link>
    </div>
  )
}
