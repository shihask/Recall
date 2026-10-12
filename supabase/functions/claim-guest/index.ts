// POST /functions/v1/claim-guest   { guest_refresh_token }
//
// After a guest signs up or logs in, moves their saves into the account. The
// browser kept the guest session's refresh token; redeeming it here proves the
// caller really had that guest session (a guest id alone would let anyone
// steal another guest's saves). Then the guest user is deleted.
//
// Redeeming rotates the token, so if anything fails afterwards the new token
// is returned for the browser to retry with.
import { adminClient, getCaller } from '../_shared/server/clients.ts'
import { json, preflight, readJson } from '../_shared/server/http.ts'
import { requireEnv } from '../_shared/server/runtime.ts'
import { THUMBNAIL_BUCKET, thumbnailPath } from '../_shared/server/thumbnails.ts'

interface GuestSession {
  id: string
  isAnonymous: boolean
  refreshToken: string
}

/** Exchange the guest's refresh token with Supabase Auth. Null if it's no longer valid. */
async function redeemGuestToken(refreshToken: string): Promise<GuestSession | null> {
  const res = await fetch(`${requireEnv('SUPABASE_URL')}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: requireEnv('SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  const user = data?.user
  if (!user?.id || typeof data.refresh_token !== 'string') return null
  return { id: user.id, isAnonymous: user.is_anonymous === true, refreshToken: data.refresh_token }
}

/** Best effort: move mirrored preview images to the account's folder and repoint the saves. */
async function moveThumbnails(guestId: string, ownerId: string): Promise<void> {
  const admin = adminClient()
  const bucket = admin.storage.from(THUMBNAIL_BUCKET)
  const { data: files, error } = await bucket.list(guestId, { limit: 1000 })
  if (error) throw new Error(error.message)
  for (const file of files ?? []) {
    const itemId = file.name
    const { error: moveError } = await bucket.move(thumbnailPath(guestId, itemId), thumbnailPath(ownerId, itemId))
    if (moveError) {
      console.error('claim-guest: move thumbnail failed', itemId, moveError.message)
      continue
    }
    await admin
      .from('saved_items')
      .update({ thumbnail_url: `${bucket.getPublicUrl(thumbnailPath(ownerId, itemId)).data.publicUrl}?v=${Date.now()}` })
      .eq('id', itemId)
      .eq('user_id', ownerId)
  }
}

/** A guest who already went through onboarding shouldn't see it again in their new account. */
async function carryOnboarding(guestId: string, ownerId: string): Promise<void> {
  const admin = adminClient()
  const { data: guestProfile, error } = await admin.from('profiles').select('onboarded_at').eq('user_id', guestId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!guestProfile?.onboarded_at) return
  const { error: updateError } = await admin
    .from('profiles')
    .update({ onboarded_at: guestProfile.onboarded_at })
    .eq('user_id', ownerId)
    .is('onboarded_at', null)
  if (updateError) throw new Error(updateError.message)
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const user = await getCaller(req)
  if (!user) return json(req, 401, { error: 'unauthorized' })
  if (user.is_anonymous) return json(req, 403, { error: 'guest_caller' })

  const body = await readJson(req)
  const token = body?.guest_refresh_token
  if (typeof token !== 'string' || token.length < 8 || token.length > 1000) return json(req, 400, { error: 'invalid_request' })

  const guest = await redeemGuestToken(token)
  // Expired, signed out or already claimed: nothing to move. The browser forgets it.
  if (!guest) return json(req, 410, { error: 'guest_gone' })
  if (!guest.isAnonymous) return json(req, 403, { error: 'not_guest' })
  if (guest.id === user.id) return json(req, 200, { moved: 0 })

  const admin = adminClient()
  const { data: moved, error } = await admin.rpc('claim_guest_data', { p_guest: guest.id, p_owner: user.id })
  if (error) {
    console.error('claim-guest failed', guest.id, user.id, error.message)
    return json(req, 500, { error: 'claim_failed', guest_refresh_token: guest.refreshToken })
  }

  await moveThumbnails(guest.id, user.id).catch((e) => console.error('claim-guest: thumbnails', guest.id, (e as Error).message))
  await carryOnboarding(guest.id, user.id).catch((e) => console.error('claim-guest: onboarding', guest.id, (e as Error).message))

  // The guest is empty now. Deleting it also ends its sessions everywhere.
  const { error: deleteError } = await admin.auth.admin.deleteUser(guest.id)
  if (deleteError) console.error('claim-guest: delete guest failed', guest.id, deleteError.message)

  return json(req, 200, { moved: moved ?? 0 })
})
