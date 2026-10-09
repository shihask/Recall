import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { qk } from '@/lib/queryKeys'
import { getProfile, updateProfile, type ProfilePatch } from '@/services/supabase/profiles'
import type { ProfileRow } from '@/types/database'

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.profile(),
    queryFn: () => getProfile(user?.id ?? ''),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => updateProfile(user?.id ?? '', patch),
    // Optimistic: onboarding navigates away without waiting for the write, and
    // the gate reads this cache — a stale `onboarded_at: null` bounced users
    // back to onboarding until the write landed.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qk.profile() })
      const previous = queryClient.getQueryData<ProfileRow | null>(qk.profile())
      if (previous) queryClient.setQueryData<ProfileRow>(qk.profile(), { ...previous, ...patch })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(qk.profile(), context.previous)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: qk.profile() }),
  })
}
