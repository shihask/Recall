// Hybrid search: RRF fusion, similarity floor, RLS. Uses synthetic unit
// vectors (real gte-small embeddings come from the Edge runtime).
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asService, asUser, createTestDb, createUser } from './harness'

let db: PGlite
let alice: string
let bob: string
const ids: Record<string, string> = {}

/** A 384-dim unit vector pointing mostly along `axis`, with a little of `mix`. */
function vec(axis: number, mix?: { axis: number; weight: number }): string {
  const v = new Array<number>(384).fill(0)
  v[axis] = 1
  if (mix) v[mix.axis] = mix.weight
  const norm = Math.hypot(...v)
  return `[${v.map((x) => (x / norm).toFixed(6)).join(',')}]`
}

async function seed(user: string, key: string, title: string, embedding: string | null, extra = '') {
  const id = await asUser(db, user, async (tx) => {
    const r = await tx.query<{ id: string }>(`insert into public.saved_items (url, title${extra ? ', personal_note' : ''}) values ($1, $2${extra ? ', $3' : ''}) returning id`, [
      `https://example.com/${key}`,
      title,
      ...(extra ? [extra] : []),
    ])
    return r.rows[0]!.id
  })
  if (embedding) await asService(db, (tx) => tx.query('update public.saved_items set embedding = $1::extensions.vector, embedded_at = now() where id = $2', [embedding, id]))
  ids[key] = id
}

const key = (id: string) => Object.entries(ids).find(([, v]) => v === id)?.[0]

async function hybrid(user: string, q: string, query: string, filters: Record<string, unknown> = {}) {
  const res = await asUser(db, user, (tx) =>
    tx.query<{ id: string; rank: number; similarity: number | null; keyword_match: boolean }>(
      'select * from public.hybrid_search_items($1, $2::extensions.vector, $3::jsonb, 30, 0.8)',
      [q, query, JSON.stringify(filters)],
    ),
  )
  return res.rows.map((r) => ({ ...r, key: key(r.id) }))
}

beforeAll(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'a@example.com')
  bob = await createUser(db, 'b@example.com')
  // axis 0 = "motorcycle gear" meaning; axis 1 = cooking; axis 2 = travel
  await seed(alice, 'mount', '3D Printed Motorcycle Phone Mount', vec(0))
  await seed(alice, 'helmet', 'Helmet visor microfiber wipe', vec(0, { axis: 3, weight: 0.4 }))
  await seed(alice, 'recipe', 'Cheesy chicken bake', vec(1))
  await seed(alice, 'trip', 'Kerala backwaters itinerary', vec(2))
  await seed(alice, 'unembedded', 'Bike chain cleaning guide', null)
  await seed(bob, 'bobs', 'Bob’s motorcycle saddle bag', vec(0))
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('hybrid_search_items', () => {
  it('finds items by meaning even with no shared words ("bike accessories")', async () => {
    const res = await hybrid(alice, 'bike accessories', vec(0, { axis: 3, weight: 0.2 }))
    const keys = res.map((r) => r.key)
    expect(keys).toContain('mount')
    expect(keys).toContain('helmet')
    expect(keys).not.toContain('recipe') // below the similarity floor
    expect(keys).not.toContain('trip')
    expect(res.find((r) => r.key === 'mount')?.keyword_match).toBe(false)
  })

  it('ranks items matching both keyword and meaning first', async () => {
    const res = await hybrid(alice, 'helmet', vec(0))
    expect(res[0]?.key).toBe('helmet')
    expect(res[0]?.keyword_match).toBe(true)
  })

  it('keeps keyword-only matches for items without embeddings', async () => {
    const res = await hybrid(alice, 'bike chain', vec(0))
    expect(res.map((r) => r.key)).toContain('unembedded')
  })

  it('applies filters to the semantic branch too', async () => {
    await asUser(db, alice, (tx) => tx.query('update public.saved_items set is_archived = true where id = $1', [ids.helmet]))
    const res = await hybrid(alice, 'gear', vec(0))
    expect(res.map((r) => r.key)).not.toContain('helmet')
    const withArchived = await hybrid(alice, 'gear', vec(0), { include_archived: true })
    expect(withArchived.map((r) => r.key)).toContain('helmet')
    await asUser(db, alice, (tx) => tx.query('update public.saved_items set is_archived = false where id = $1', [ids.helmet]))
  })

  it('never returns another user’s items (RLS)', async () => {
    const aliceRes = await hybrid(alice, 'motorcycle saddle bag', vec(0))
    expect(aliceRes.map((r) => r.key)).not.toContain('bobs')
    const bobRes = await hybrid(bob, 'phone mount', vec(0))
    expect(bobRes.map((r) => r.key)).toEqual(['bobs'])
  })
})
