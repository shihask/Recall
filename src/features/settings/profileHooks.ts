import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { qk } from '@/lib/queryKeys'
import { getProfile, updateProfile, type ProfilePatch } from '@/services/supabase/profiles'

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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.profile() }),
  })
}
