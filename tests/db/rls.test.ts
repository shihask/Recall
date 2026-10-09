// Acceptance Test 10: a second user cannot access the first user's data.
// Runs the real migrations; see harness.ts.
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asService, asUser, createTestDb, createUser } from './harness'

let db: PGlite
let alice: string
let bob: string
let aliceItem: string
let aliceCollection: string
let aliceTag: string
let bobCollection: string
let bobTag: string

async function insertItem(tx: Transaction, url: string, extra: Record<string, unknown> = {}): Promise<string> {
  const cols = ['url', 'canonical_url', ...Object.keys(extra)]
  const vals = [url, url, ...Object.values(extra)]
  const params = vals.map((_, i) => `$${i + 1}`).join(', ')
  const res = await tx.query<{ id: string }>(`insert into public.saved_items (${cols.join(', ')}) values (${params}) returning id`, vals)
  return res.rows[0]!.id
}

async function rejects(p: Promise<unknown>, pattern: RegExp = /row-level security|permission denied|same user|must belong|immutable/) {
  await expect(p).rejects.toThrow(pattern)
}

beforeAll(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'alice@example.com', { full_name: 'Alice' })
  bob = await createUser(db, 'bob@example.com')

  await asUser(db, alice, async (tx) => {
    aliceItem = await insertItem(tx, 'https://www.instagram.com/reel/ABC123/', {
      source: 'instagram',
      source_type: 'reel',
      title: '3D Printed Motorcycle Phone Mount',
      personal_note: 'Need to try this for my bike.',
    })
    aliceCollection = (await tx.query<{ id: string }>(`insert into public.collections (name, icon) values ('Bike Ideas', '🏍️') returning id`)).rows[0]!.id
    aliceTag = (await tx.query<{ id: string }>(`select id from public.ensure_tags(array['Motorcycle'])`)).rows[0]!.id
    await tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2)', [aliceItem, aliceTag])
    await tx.query('insert into public.collection_items (collection_id, saved_item_id) values ($1, $2)', [aliceCollection, aliceItem])
    await tx.query(`insert into public.processing_jobs (user_id, saved_item_id, job_type) values ($1, $2, 'enrich')`, [alice, aliceItem])
  })

  await asUser(db, bob, async (tx) => {
    bobCollection = (await tx.query<{ id: string }>(`insert into public.collections (name) values ('Mine') returning id`)).rows[0]!.id
    bobTag = (await tx.query<{ id: string }>(`select id from public.ensure_tags(array['Mine'])`)).rows[0]!.id
  })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('profiles', () => {
  it('are created on signup with metadata name', async () => {
    const rows = await asUser(db, alice, (tx) => tx.query<{ display_name: string }>('select display_name from public.profiles'))
    expect(rows.rows).toEqual([{ display_name: 'Alice' }])
  })
  it('are private', async () => {
    const rows = await asUser(db, bob, (tx) => tx.query('select * from public.profiles where user_id = $1', [alice]))
    expect(rows.rows).toHaveLength(0)
  })
})

describe('Test 10 — second user cannot access first user’s data', () => {
  it.each(['saved_items', 'collections', 'tags', 'processing_jobs'])('bob sees none of alice’s %s', async (table) => {
    const res = await asUser(db, bob, (tx) => tx.query(`select * from public.${table} where user_id = $1`, [alice]))
    expect(res.rows).toHaveLength(0)
  })

  it('bob sees none of alice’s join rows', async () => {
    const tags = await asUser(db, bob, (tx) => tx.query('select * from public.item_tags where item_id = $1', [aliceItem]))
    const cols = await asUser(db, bob, (tx) => tx.query('select * from public.collection_items where saved_item_id = $1', [aliceItem]))
    expect(tags.rows).toHaveLength(0)
    expect(cols.rows).toHaveLength(0)
  })

  it('bob cannot read alice’s item even by id', async () => {
    const res = await asUser(db, bob, (tx) => tx.query('select * from public.saved_items where id = $1', [aliceItem]))
    expect(res.rows).toHaveLength(0)
  })

  it('bob cannot update or delete alice’s item', async () => {
    const upd = await asUser(db, bob, (tx) => tx.query(`update public.saved_items set title = 'pwned' where id = $1`, [aliceItem]))
    const del = await asUser(db, bob, (tx) => tx.query('delete from public.saved_items where id = $1', [aliceItem]))
    expect(upd.affectedRows).toBe(0)
    expect(del.affectedRows).toBe(0)
    const still = await asUser(db, alice, (tx) => tx.query<{ title: string }>('select title from public.saved_items where id = $1', [aliceItem]))
    expect(still.rows[0]?.title).toBe('3D Printed Motorcycle Phone Mount')
  })

  it('bob cannot create an item owned by alice', async () => {
    await rejects(asUser(db, bob, (tx) => tx.query(`insert into public.saved_items (user_id, url) values ($1, 'https://a.com')`, [alice])))
  })

  it('bob cannot put alice’s item in his collection or tag it', async () => {
    await rejects(asUser(db, bob, (tx) => tx.query('insert into public.collection_items (collection_id, saved_item_id) values ($1, $2)', [bobCollection, aliceItem])))
    await rejects(asUser(db, bob, (tx) => tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2)', [aliceItem, bobTag])))
  })

  it('bob cannot put his item in alice’s collection or use her tag', async () => {
    const bobItem = await asUser(db, bob, (tx) => insertItem(tx, 'https://bob.example.com/x'))
    await rejects(asUser(db, bob, (tx) => tx.query('insert into public.collection_items (collection_id, saved_item_id) values ($1, $2)', [aliceCollection, bobItem])))
    await rejects(asUser(db, bob, (tx) => tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2)', [bobItem, aliceTag])))
  })

  it('bob cannot enqueue jobs for alice’s item', async () => {
    await rejects(asUser(db, bob, (tx) => tx.query(`insert into public.processing_jobs (user_id, saved_item_id, job_type) values ($1, $2, 'enrich')`, [bob, aliceItem])))
  })

  it('bob cannot remove alice’s tags or collection membership', async () => {
    const a = await asUser(db, bob, (tx) => tx.query('delete from public.item_tags where item_id = $1', [aliceItem]))
    const b = await asUser(db, bob, (tx) => tx.query('delete from public.collection_items where saved_item_id = $1', [aliceItem]))
    const c = await asUser(db, bob, (tx) => tx.query('delete from public.collections where id = $1', [aliceCollection]))
    expect([a.affectedRows, b.affectedRows, c.affectedRows]).toEqual([0, 0, 0])
  })

  it('bob’s search never returns alice’s items', async () => {
    const res = await asUser(db, bob, (tx) => tx.query(`select * from public.search_items('motorcycle phone mount')`))
    expect(res.rows).toHaveLength(0)
    const stats = await asUser(db, bob, (tx) => tx.query<{ saves: number }>('select * from public.library_stats()'))
    expect(Number(stats.rows[0]?.saves)).toBe(1) // only his own
  })

  it('a service-role writer still cannot cross-link users (trigger guard)', async () => {
    await rejects(asService(db, (tx) => tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2)', [aliceItem, bobTag])))
    await rejects(asService(db, (tx) => tx.query('insert into public.collection_items (collection_id, saved_item_id) values ($1, $2)', [bobCollection, aliceItem])))
  })
})

describe('anonymous access', () => {
  it.each(['saved_items', 'collections', 'tags', 'item_tags', 'collection_items', 'processing_jobs', 'profiles'])(
    'anon cannot read %s',
    async (table) => {
      await rejects(asAnon(db, (tx) => tx.query(`select * from public.${table}`)), /permission denied/)
    },
  )
  it('anon cannot call search', async () => {
    await rejects(asAnon(db, (tx) => tx.query(`select * from public.search_items('x')`)), /permission denied/)
  })
})

describe('owner-side protections', () => {
  it('users cannot rewrite server-owned columns', async () => {
    for (const col of ['url', 'embedding', 'tag_names', 'processing_status', 'ai_summary', 'thumbnail_url']) {
      await rejects(
        asUser(db, alice, (tx) => tx.query(`update public.saved_items set ${col} = null where id = $1`, [aliceItem])),
        /permission denied/,
      )
    }
  })

  it('users can edit their own content fields', async () => {
    const res = await asUser(db, alice, (tx) =>
      tx.query(`update public.saved_items set personal_note = 'Need to try this for my bike.', is_favorite = true where id = $1`, [aliceItem]),
    )
    expect(res.affectedRows).toBe(1)
  })

  it('users cannot transfer ownership', async () => {
    await rejects(asUser(db, alice, (tx) => tx.query('update public.collections set user_id = $1 where id = $2', [bob, aliceCollection])))
  })

  it('users cannot complete or tamper with jobs (service role only)', async () => {
    const res = await asUser(db, alice, (tx) => tx.query(`update public.processing_jobs set status = 'completed' where saved_item_id = $1`, [aliceItem]))
    expect(res.affectedRows).toBe(0)
  })

  it('users can only enqueue fresh pending jobs, one active per type', async () => {
    await rejects(
      asUser(db, alice, (tx) => tx.query(`insert into public.processing_jobs (user_id, saved_item_id, job_type, status) values ($1, $2, 'embed', 'completed')`, [alice, aliceItem])),
    )
    await expect(
      asUser(db, alice, (tx) => tx.query(`insert into public.processing_jobs (user_id, saved_item_id, job_type) values ($1, $2, 'enrich')`, [alice, aliceItem])),
    ).rejects.toThrow(/duplicate key|processing_jobs_one_active/)
  })

  it('users cannot add AI-origin tags themselves', async () => {
    await rejects(asUser(db, alice, (tx) => tx.query(`insert into public.item_tags (item_id, tag_id, origin) values ($1, $2, 'ai')`, [aliceItem, aliceTag])))
  })
})

describe('account deletion', () => {
  it('cascades every row away', async () => {
    const carol = await createUser(db, 'carol@example.com')
    await asUser(db, carol, async (tx) => {
      const id = await insertItem(tx, 'https://c.example.com')
      const tag = (await tx.query<{ id: string }>(`select id from public.ensure_tags(array['x'])`)).rows[0]!.id
      await tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2)', [id, tag])
    })
    await db.query('delete from auth.users where id = $1', [carol])
    for (const table of ['saved_items', 'tags', 'profiles', 'collections', 'processing_jobs']) {
      const res = await db.query(`select 1 from public.${table} where user_id = $1`, [carol])
      expect(res.rows, table).toHaveLength(0)
    }
  })
})
describe('thumbnails storage', () => {
  it('owners can see and delete only their own thumbnail copies; nobody else can write', async () => {
    const path = `${alice}/${aliceItem}`
    await asService(db, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('thumbnails', $1)`, [path]))

    const bobSees = await asUser(db, bob, (tx) => tx.query('select * from storage.objects where name = $1', [path]))
    expect(bobSees.rows).toHaveLength(0)
    const bobDeletes = await asUser(db, bob, (tx) => tx.query('delete from storage.objects where name = $1', [path]))
    expect(bobDeletes.affectedRows).toBe(0)
    await rejects(asUser(db, bob, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('thumbnails', $1)`, [`${bob}/x`])))

    const aliceDeletes = await asUser(db, alice, (tx) => tx.query('delete from storage.objects where name = $1', [path]))
    expect(aliceDeletes.affectedRows).toBe(1)
  })
})
