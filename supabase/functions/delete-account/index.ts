// POST /functions/v1/delete-account   { confirm: "DELETE" }
//
// Deletes the caller's auth user. Every Recall table references auth.users
// with ON DELETE CASCADE, so profiles, saves, notes, tags, collections and
// jobs are removed with it. Needs the service role (auth admin API), which is
// why this is server-side; it only ever deletes the verified caller.
import { adminClient, getCaller } from '../_shared/server/clients.ts'
import { json, preflight, readJson } from '../_shared/server/http.ts'
import { deleteUserThumbnails } from '../_shared/server/thumbnails.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const user = await getCaller(req)
  if (!user) return json(req, 401, { error: 'unauthorized' })

  const body = await readJson(req)
  if (body?.confirm !== 'DELETE') return json(req, 400, { error: 'confirmation_required' })

  const admin = adminClient()
  // Storage isn't covered by the cascade. Best effort: never block deletion on it.
  await deleteUserThumbnails(admin, user.id).catch((e) => console.error('delete thumbnails failed', user.id, (e as Error).message))

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('delete-account failed', user.id, error.message)
    return json(req, 500, { error: 'delete_failed' })
  }
  return json(req, 200, { deleted: true })
})
