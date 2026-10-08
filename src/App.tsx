import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { FullPageSpinner } from '@/components/ui/misc'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { OnboardingGate } from '@/features/auth/OnboardingGate'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/RouteGuards'
import { SaveSheetProvider } from '@/features/saves/SaveSheetProvider'
import { PwaUpdater } from '@/features/settings/PwaUpdater'
import { ThemeProvider } from '@/features/settings/ThemeProvider'
import { useTheme } from '@/features/settings/theme'
import { AppLayout } from '@/layouts/AppLayout'
import { queryClient } from '@/lib/queryClient'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'))
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const HomePage = lazy(() => import('@/pages/HomePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const ItemDetailPage = lazy(() => import('@/pages/ItemDetailPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const ShareTargetPage = lazy(() => import('@/pages/ShareTargetPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const SavesPage = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.SavesPage })))
const FavoritesPage = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.FavoritesPage })))
const ArchivePage = lazy(() => import('@/pages/LibraryPages').then((m) => ({ default: m.ArchivePage })))
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'))
const CollectionDetailPage = lazy(() => import('@/pages/CollectionDetailPage'))
const TagsPage = lazy(() => import('@/pages/TagsPages').then((m) => ({ default: m.TagsPage })))
const TagDetailPage = lazy(() => import('@/pages/TagsPages').then((m) => ({ default: m.TagDetailPage })))

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} position="top-center" richColors={false} closeButton toastOptions={{ className: 'font-sans' }} />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<FullPageSpinner />}>
              <Routes>
                <Route element={<PublicOnlyRoute />}>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                </Route>
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route
                    element={
                      <OnboardingGate>
                        <SaveSheetProvider>
                          <AppLayout />
                        </SaveSheetProvider>
                      </OnboardingGate>
                    }
                  >
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/save" element={<ShareTargetPage />} />
                    <Route path="/saves" element={<SavesPage />} />
                    <Route path="/favorites" element={<FavoritesPage />} />
                    <Route path="/archive" element={<ArchivePage />} />
                    <Route path="/item/:id" element={<ItemDetailPage />} />
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/collections/:id" element={<CollectionDetailPage />} />
                    <Route path="/tags" element={<TagsPage />} />
                    <Route path="/tags/:id" element={<TagDetailPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Route>

                <Route path="/app" element={<Navigate to="/home" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <ThemedToaster />
            <PwaUpdater />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
