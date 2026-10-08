// Keyword search behaviour (Acceptance Test 7) and the denormalized tag pipeline.
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseSearchIntent } from '../../supabase/functions/_shared/query.ts'
import { asUser, createTestDb, createUser } from './harness'

let db: PGlite
let user: string
const ids: Record<string, string> = {}

async function save(tx: Transaction, key: string, fields: Record<string, unknown>, tags: string[] = []) {
  const cols = Object.keys(fields)
  const vals = Object.values(fields)
  const res = await tx.query<{ id: string }>(
    `insert into public.saved_items (${cols.join(', ')}) values (${vals.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    vals,
  )
  const id = res.rows[0]!.id
  ids[key] = id
  if (tags.length) {
    const t = await tx.query<{ id: string }>('select id from public.ensure_tags($1)', [tags])
    for (const row of t.rows) await tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2)', [id, row.id])
  }
}

async function search(q: string, filters: Record<string, unknown> = {}): Promise<string[]> {
  const res = await asUser(db, user, (tx) =>
    tx.query<{ id: string }>('select id from public.search_items($1, $2::jsonb, 20, 0)', [q, JSON.stringify(filters)]),
  )
  return res.rows.map((r) => r.id)
}

const key = (id: string | undefined) => Object.entries(ids).find(([, v]) => v === id)?.[0]

beforeAll(async () => {
  db = await createTestDb()
  user = await createUser(db, 'searcher@example.com')
  await asUser(db, user, async (tx) => {
    await save(
      tx,
      'mount',
      {
        url: 'https://www.instagram.com/reel/ABC/',
        source: 'instagram',
        source_type: 'reel',
        title: '3D Printed Motorcycle Phone Mount',
        ai_summary: 'A DIY motorcycle phone mount designed using 3D printing.',
        ai_category: 'Motorcycles',
        personal_note: 'Need to try this for my bike.',
        saved_at: '2026-09-01T10:00:00Z',
      },
      ['Motorcycle', '3D Printing', 'Phone Mount', 'DIY'],
    )
    await save(
      tx,
      'recipe',
      {
        url: 'https://www.youtube.com/watch?v=abcdefghijk',
        source: 'youtube',
        source_type: 'video',
        title: 'Cheesy chicken bake',
        description: 'Easy weeknight chicken recipe with lots of cheese',
        ai_category: 'Recipes',
        saved_at: '2026-09-10T10:00:00Z',
      },
      ['Recipe', 'Chicken'],
    )
    await save(
      tx,
      'photo',
      {
        url: 'https://example.com/golden-hour',
        title: 'Golden hour portrait tips',
        ai_summary: 'Photography tips for shooting portraits at golden hour.',
        ai_category: 'Photography',
        is_favorite: true,
        saved_at: '2026-09-20T10:00:00Z',
      },
      ['Photography'],
    )
    await save(tx, 'archived', {
      url: 'https://example.com/old',
      title: 'Old motorcycle helmet review',
      is_archived: true,
      saved_at: '2026-08-01T10:00:00Z',
    })
    await save(tx, 'bare', { url: 'https://www.instagram.com/reel/XYZ/', source: 'instagram', source_type: 'reel', saved_at: '2026-09-25T10:00:00Z' })
  })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('search_items', () => {
  it('Test 7: "bike 3D printing" finds the motorcycle mount (note + tags)', async () => {
    const res = await search('bike 3D printing')
    expect(key(res[0])).toBe('mount')
  })

  it('half-remembered phrasing still matches on shared words', async () => {
    const res = await search('something about a motorcycle phone holder')
    expect(key(res[0])).toBe('mount')
  })

  it('matches tags, summary, description and category', async () => {
    expect(key((await search('phone mount'))[0])).toBe('mount')
    expect(key((await search('the recipe with chicken and cheese'))[0])).toBe('recipe')
    expect(key((await search('photography tips about golden hour'))[0])).toBe('photo')
  })

  it('prefix and stemming: "print" finds "printed/printing"', async () => {
    expect((await search('print')).map(key)).toContain('mount')
    expect((await search('portrait')).map(key)).toContain('photo')
  })

  it('tolerates typos via trigram similarity', async () => {
    expect((await search('motorcyle')).map(key)).toContain('mount')
  })

  it('excludes archived unless asked', async () => {
    expect((await search('helmet')).map(key)).not.toContain('archived')
    expect((await search('helmet', { include_archived: true })).map(key)).toContain('archived')
  })

  it('filters by source, category, favorite and date', async () => {
    expect((await search('', { source: 'youtube' })).map(key)).toEqual(['recipe'])
    expect((await search('', { category: 'Photography' })).map(key)).toEqual(['photo'])
    expect((await search('', { favorite: true })).map(key)).toEqual(['photo'])
    expect((await search('', { from: '2026-09-05T00:00:00Z', to: '2026-09-15T00:00:00Z' })).map(key)).toEqual(['recipe'])
  })

  it('filters by tag and collection', async () => {
    const { tagId, collectionId } = await asUser(db, user, async (tx) => {
      const tag = await tx.query<{ id: string }>(`select id from public.tags where lower(name) = 'chicken'`)
      const col = await tx.query<{ id: string }>(`insert into public.collections (name) values ('Bike Ideas') returning id`)
      await tx.query('insert into public.collection_items (collection_id, saved_item_id) values ($1, $2)', [col.rows[0]!.id, ids.mount])
      return { tagId: tag.rows[0]!.id, collectionId: col.rows[0]!.id }
    })
    expect((await search('', { tag_id: tagId })).map(key)).toEqual(['recipe'])
    expect((await search('', { collection_id: collectionId })).map(key)).toEqual(['mount'])
  })

  it('empty query lists newest first; items with only a URL are still listed', async () => {
    expect((await search('')).map(key)).toEqual(['bare', 'photo', 'recipe', 'mount'])
  })

  it('boosts the source type mentioned ("the Reel about…")', async () => {
    const res = await search('motorcycle', { boost_type: 'reel' })
    expect(key(res[0])).toBe('mount')
  })

  it.each([
    ['Show me the bike accessories I saved.', 'mount'],
    ['Find the Reel about a 3D printed phone holder.', 'mount'],
    ['What photography tips did I save?', 'photo'],
    ['the recipe with chicken and cheese', 'recipe'],
    ['that video about cheesy chicken', 'recipe'],
  ])('natural query %j → %s (parser + keyword search)', async (q, expected) => {
    const intent = parseSearchIntent(q)
    const res = await search(intent.terms, { boost_type: intent.boostType, boost_source: intent.boostSource })
    expect(key(res[0])).toBe(expected)
  })

  it('never errors on odd input', async () => {
    for (const q of ["o'reilly", '"unterminated', '!!!', '%_\\', 'a & | b', '-motorcycle', '()']) {
      await expect(search(q)).resolves.toBeInstanceOf(Array)
    }
  })

  it('returns nothing for unrelated queries', async () => {
    expect(await search('quantum chromodynamics')).toEqual([])
  })
})

describe('tag pipeline', () => {
  it('ensure_tags dedupes case-insensitively and trims', async () => {
    const res = await asUser(db, user, (tx) => tx.query<{ name: string }>(`select name from public.ensure_tags(array['  diy ', 'DIY', 'New   Tag', ''])`))
    const names = res.rows.map((r) => r.name).sort()
    expect(names).toEqual(['DIY', 'New Tag'])
  })

  it('tag rename refreshes search', async () => {
    await asUser(db, user, (tx) => tx.query(`update public.tags set name = 'Poultry' where lower(name) = 'chicken'`))
    expect((await search('poultry')).map(key)).toContain('recipe')
  })

  it('removing a tag removes it from search', async () => {
    await asUser(db, user, (tx) =>
      tx.query(`delete from public.item_tags where item_id = $1 and tag_id in (select id from public.tags where name = 'Poultry')`, [ids.recipe]),
    )
    const doc = await asUser(db, user, (tx) => tx.query<{ tag_names: string }>('select tag_names from public.saved_items where id = $1', [ids.recipe]))
    expect(doc.rows[0]?.tag_names).toBe('Recipe')
  })

  it('editing searchable text marks the embedding stale', async () => {
    await db.query(`update public.saved_items set embedded_at = now() where id = $1`, [ids.mount])
    await asUser(db, user, (tx) => tx.query(`update public.saved_items set personal_note = 'For my XPulse' where id = $1`, [ids.mount]))
    const res = await db.query<{ embedded_at: string | null }>('select embedded_at from public.saved_items where id = $1', [ids.mount])
    expect(res.rows[0]?.embedded_at).toBeNull()
  })
})
