// Runs the REAL migrations in PGlite (Postgres compiled to WASM) behind a
// minimal Supabase shim, so RLS policies, triggers and RPCs are tested as SQL
// — not mocked. Mirrors what Supabase provides before migrations run:
// anon/authenticated/service_role roles, an auth schema with auth.uid()
// reading the JWT `sub` claim, and Supabase's default privileges.
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { vector } from '@electric-sql/pglite-pgvector'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../supabase/migrations')

const SUPABASE_SHIM = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;

  -- Supabase grants everything on new public objects to the API roles and
  -- relies on RLS + explicit revokes in migrations. Reproduce that so the
  -- migrations' revokes are tested against the same baseline.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export async function createTestDb(options: { skip?: (file: string) => boolean } = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pg_trgm, unaccent, vector } })
  await db.exec(SUPABASE_SHIM)
  for (const file of migrationFiles()) {
    if (options.skip?.(file)) continue
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error })
    }
  }
  return db
}

export async function createUser(db: PGlite, email: string, meta: Record<string, unknown> = {}): Promise<string> {
  const res = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [email, JSON.stringify(meta)],
  )
  const id = res.rows[0]?.id
  if (!id) throw new Error('user insert failed')
  return id
}

type Role = 'authenticated' | 'anon' | 'service_role'

/**
 * Run `fn` inside a transaction as an API role, like a PostgREST request.
 * Rolled back afterwards unless `commit` is set, so tests don't leak state.
 */
export async function as<T>(
  db: PGlite,
  role: Role,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
  { commit = true }: { commit?: boolean } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    await tx.exec(`set local role ${role}`)
    const result = await fn(tx)
    if (!commit) await tx.rollback()
    return result
  })
}

export const asUser = <T>(db: PGlite, userId: string, fn: (tx: Transaction) => Promise<T>) => as(db, 'authenticated', userId, fn)
export const asService = <T>(db: PGlite, fn: (tx: Transaction) => Promise<T>) => as(db, 'service_role', null, fn)
export const asAnon = <T>(db: PGlite, fn: (tx: Transaction) => Promise<T>) => as(db, 'anon', null, fn)
