// Idempotency of the background-processing state machine (spec §43).
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { asService, asUser, createTestDb, createUser } from './harness'

let db: PGlite
let user: string
let item: string

type Job = { id: string | null; status: string; attempts: number }

const start = (type = 'enrich', force = false) =>
  asService(db, (tx) => tx.query<Job>('select * from public.start_processing($1, $2, $3)', [item, type, force])).then((r) => r.rows[0])

const finish = (job: string, ok: boolean, error?: string) =>
  asService(db, (tx) => tx.query('select public.finish_processing($1, $2, $3)', [job, ok, error ?? null]))

const jobs = () => db.query<{ status: string; attempts: number; job_type: string }>('select status, attempts, job_type from public.processing_jobs where saved_item_id = $1 order by created_at', [item])

const tagsOf = () =>
  db.query<{ name: string; origin: string }>(
    'select t.name, it.origin from public.item_tags it join public.tags t on t.id = it.tag_id where it.item_id = $1 order by t.name',
    [item],
  )

beforeEach(async () => {
  db = await createTestDb()
  user = await createUser(db, 'p@example.com')
  item = await asUser(db, user, async (tx) => {
    const r = await tx.query<{ id: string }>(`insert into public.saved_items (url) values ('https://example.com/a') returning id`)
    const id = r.rows[0]!.id
    await tx.query(`insert into public.processing_jobs (user_id, saved_item_id, job_type) values ($1, $2, 'enrich')`, [user, id])
    return id
  })
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('start_processing', () => {
  it('claims the queued job once; a second concurrent call is a no-op', async () => {
    const first = await start()
    expect(first?.status).toBe('processing')
    expect(first?.attempts).toBe(1)
    const second = await start()
    expect(second?.id ?? null).toBeNull()
    const status = await db.query<{ processing_status: string }>('select processing_status from public.saved_items where id = $1', [item])
    expect(status.rows[0]?.processing_status).toBe('processing')
  })

  it('does nothing once completed unless forced', async () => {
    const job = await start()
    await finish(job!.id!, true)
    expect((await start())?.id ?? null).toBeNull()
    const forced = await start('enrich', true)
    expect(forced?.status).toBe('processing')
    expect((await jobs()).rows.map((j) => j.status)).toEqual(['completed', 'processing'])
  })

  it('retries failed jobs up to 3 attempts', async () => {
    for (let i = 1; i <= 3; i++) {
      const job = await start()
      expect(job?.attempts).toBe(i)
      await finish(job!.id!, false, 'AI unavailable')
    }
    expect((await start())?.id ?? null).toBeNull()
  })

  it('reclaims a job stuck in processing after a crash', async () => {
    const job = await start()
    await db.query(`update public.processing_jobs set started_at = now() - interval '10 minutes' where id = $1`, [job!.id])
    const again = await start()
    expect(again?.id).toBe(job!.id)
    expect(again?.attempts).toBe(2)
  })

  it('embed jobs are independent of enrich jobs', async () => {
    await start()
    const embed = await start('embed', true)
    expect(embed?.status).toBe('processing')
  })

  it('is not callable by users', async () => {
    await expect(asUser(db, user, (tx) => tx.query('select * from public.start_processing($1, $2, $3)', [item, 'enrich', true]))).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('apply_ai_tags', () => {
  const apply = (names: string[]) => asService(db, (tx) => tx.query('select public.apply_ai_tags($1, $2)', [item, names]))

  it('is idempotent and keeps user tags', async () => {
    await asUser(db, user, async (tx) => {
      const t = await tx.query<{ id: string }>(`select id from public.ensure_tags(array['XPulse', 'DIY'])`)
      for (const row of t.rows) await tx.query('insert into public.item_tags (item_id, tag_id) values ($1, $2)', [item, row.id])
    })
    await apply(['Motorcycle', '3D Printing', 'diy'])
    await apply(['Motorcycle', '3D Printing', 'diy'])
    expect((await tagsOf()).rows).toEqual([
      { name: '3D Printing', origin: 'ai' },
      { name: 'DIY', origin: 'user' },
      { name: 'Motorcycle', origin: 'ai' },
      { name: 'XPulse', origin: 'user' },
    ])
  })

  it('replaces previous AI tags on reprocess', async () => {
    await apply(['Motorcycle', 'Phone Mount'])
    await apply(['Motorcycle', 'GPS Holder'])
    expect((await tagsOf()).rows.map((r) => r.name)).toEqual(['GPS Holder', 'Motorcycle'])
  })

  it('caps at 7 tags and normalizes', async () => {
    await apply(['  a  b ', 'A B', 'c', 'd', 'e', 'f', 'g', 'h', 'i', ''])
    const rows = (await tagsOf()).rows
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.name)).toContain('a b')
  })

  it('refreshes the searchable tag_names', async () => {
    await apply(['Helmet Care'])
    const r = await db.query<{ tag_names: string }>('select tag_names from public.saved_items where id = $1', [item])
    expect(r.rows[0]?.tag_names).toBe('Helmet Care')
  })
})
