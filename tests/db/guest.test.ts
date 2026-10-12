// Guest mode: the 5-save limit and moving a guest's data into a real account.
// Runs the real migrations; see harness.ts.
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asService, asUser, createGuest, createTestDb, createUser } from './harness'

let db: PGlite

async function insertItem(tx: Transaction, url: string): Promise<string> {
  const res = await tx.query<{ id: string }>('insert into public.saved_items (url, canonical_url) values ($1, $1) returning id', [url])
  return res.rows[0]!.id
}

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) s`, params)).rows[0]!.n)

beforeAll(async () => {
  db = await createTestDb()
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('guest save limit', () => {
  it('lets a guest save 5 items, then refuses the 6th', async () => {
    const guest = await createGuest(db)
    await asUser(db, guest, async (tx) => {
      for (let i = 1; i <= 5; i++) await insertItem(tx, `https://example.com/${i}`)
    })
    await expect(asUser(db, guest, (tx) => insertItem(tx, 'https://example.com/6'))).rejects.toThrow(/guest_limit/)
    expect(await count('select 1 from public.saved_items where user_id = $1', [guest])).toBe(5)
  })

  it('never limits a full account', async () => {
    const user = await createUser(db, 'full@example.com')
    await asUser(db, user, async (tx) => {
      for (let i = 1; i <= 7; i++) await insertItem(tx, `https://example.com/full/${i}`)
    })
    expect(await count('select 1 from public.saved_items where user_id = $1', [user])).toBe(7)
  })
})

describe('claim_guest_data', () => {
  it('is not callable by signed-in users', async () => {
    const guest = await createGuest(db)
    const user = await createUser(db, 'sneaky@example.com')
    await expect(
      asUser(db, user, (tx) => tx.query('select public.claim_guest_data($1, $2)', [guest, user])),
    ).rejects.toThrow(/permission denied/)
  })

  it('refuses to move a full account’s data', async () => {
    const victim = await createUser(db, 'victim@example.com')
    const user = await createUser(db, 'thief@example.com')
    await expect(asService(db, (tx) => tx.query('select public.claim_guest_data($1, $2)', [victim, user]))).rejects.toThrow(
      /not a guest account/,
    )
  })

  it('moves saves, jobs, tags and collections, merging same-named ones', async () => {
    const guest = await createGuest(db)
    const owner = await createUser(db, 'owner@example.com')

    // The account already has a "Travel" collection and a "beach" tag.
    const { ownerTravel, ownerBeach } = await asUser(db, owner, async (tx) => {
      const ownerTravel = (await tx.query<{ id: string }>(`insert into public.collections (name) values ('Travel') returning id`)).rows[0]!.id
      const ownerBeach = (await tx.query<{ id: string }>(`select id from public.ensure_tags(array['beach'])`)).rows[0]!.id
      return { ownerTravel, ownerBeach }
    })

    // The guest saved 2 items, tagged "Beach" and "Food", in "travel" (with a "Goa" sub-collection) and "Recipes".
    const { item1, item2 } = await asUser(db, guest, async (tx) => {
      const item1 = await insertItem(tx, 'https://example.com/goa')
      const item2 = await insertItem(tx, 'https://example.com/curry')
      const [beach, food] = (await tx.query<{ id: string }>(`select id from public.ensure_tags(array['Beach', 'Food'])`)).rows.map((r) => r.id)
      await tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2), ($3, $4)', [item1, beach, item2, food])
      const travel = (await tx.query<{ id: string }>(`insert into public.collections (name) values ('travel') returning id`)).rows[0]!.id
      const goa = (await tx.query<{ id: string }>(`insert into public.collections (name, parent_id) values ('Goa', $1) returning id`, [travel])).rows[0]!.id
      const recipes = (await tx.query<{ id: string }>(`insert into public.collections (name) values ('Recipes') returning id`)).rows[0]!.id
      await tx.query('insert into public.collection_items (collection_id, saved_item_id) values ($1, $2), ($3, $2), ($4, $5)', [travel, item1, goa, recipes, item2])
      await tx.query(`insert into public.processing_jobs (user_id, saved_item_id, job_type) values ($1, $2, 'enrich')`, [guest, item1])
      return { item1, item2 }
    })

    const moved = await asService(db, (tx) => tx.query<{ n: number }>('select public.claim_guest_data($1, $2) as n', [guest, owner]))
    expect(moved.rows[0]!.n).toBe(2)

    // Nothing is left on the guest.
    for (const table of ['saved_items', 'processing_jobs', 'tags', 'collections']) {
      expect(await count(`select 1 from public.${table} where user_id = $1`, [guest])).toBe(0)
    }

    // The owner sees both saves, with tag names kept current for search.
    const items = await asUser(db, owner, (tx) =>
      tx.query<{ id: string; tag_names: string }>('select id, tag_names from public.saved_items order by url desc'),
    )
    expect(items.rows).toEqual([
      { id: item1, tag_names: 'beach' },
      { id: item2, tag_names: 'Food' },
    ])

    // "Beach" merged into the owner's existing "beach"; "Food" moved over.
    const tags = await asUser(db, owner, (tx) => tx.query<{ id: string; name: string }>('select id, name from public.tags order by lower(name)'))
    expect(tags.rows.map((t) => t.name)).toEqual(['beach', 'Food'])
    expect(tags.rows[0]!.id).toBe(ownerBeach)

    // "travel" merged into "Travel"; "Goa" now hangs under it; "Recipes" moved.
    const cols = await asUser(db, owner, (tx) =>
      tx.query<{ id: string; name: string; parent_id: string | null }>('select id, name, parent_id from public.collections order by name'),
    )
    expect(cols.rows.map((c) => [c.name, c.parent_id])).toEqual([
      ['Goa', ownerTravel],
      ['Recipes', null],
      ['Travel', null],
    ])
    expect(await count('select 1 from public.collection_items where collection_id = $1 and saved_item_id = $2', [ownerTravel, item1])).toBe(1)

    // Ownership is immutable again outside the claim, even for the service role.
    await expect(asService(db, (tx) => tx.query('update public.saved_items set user_id = $1 where id = $2', [guest, item1]))).rejects.toThrow(/immutable/)
  })
})
