-- Row Level Security: every row is private to its owner. The frontend's own
-- filters are a convenience, never the security boundary.
--
-- `(select auth.uid())` instead of `auth.uid()` lets Postgres evaluate it once
-- per statement rather than per row (Supabase RLS performance guidance).

alter table public.profiles         enable row level security;
alter table public.saved_items      enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;
alter table public.tags             enable row level security;
alter table public.item_tags        enable row level security;
alter table public.processing_jobs  enable row level security;

-- Anonymous visitors get nothing at all.
revoke all on public.profiles, public.saved_items, public.collections, public.collection_items,
              public.tags, public.item_tags, public.processing_jobs from anon;

-- ── profiles ────────────────────────────────────────────────────────────────
create policy "profiles: read own" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── saved_items ─────────────────────────────────────────────────────────────
create policy "saved_items: read own" on public.saved_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "saved_items: insert own" on public.saved_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "saved_items: update own" on public.saved_items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "saved_items: delete own" on public.saved_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- Column-level write allowlist. Clients may edit the user-facing fields; the
-- URL, source detection, enrichment output, processing state, embeddings and
-- denormalized search fields are written only by Edge Functions (service
-- role). A column REVOKE is a no-op while a table-wide grant exists, hence
-- revoke-all-then-grant-columns.
revoke update on public.saved_items from authenticated;
grant update (title, description, personal_note, ai_category, is_favorite, is_archived, user_edited)
  on public.saved_items to authenticated;

-- ── collections ─────────────────────────────────────────────────────────────
create policy "collections: read own" on public.collections
  for select to authenticated using (user_id = (select auth.uid()));
create policy "collections: insert own" on public.collections
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "collections: update own" on public.collections
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "collections: delete own" on public.collections
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── collection_items (owned through both parents) ───────────────────────────
create policy "collection_items: read own" on public.collection_items
  for select to authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid()))
  );
create policy "collection_items: insert own" on public.collection_items
  for insert to authenticated with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.saved_items i where i.id = saved_item_id and i.user_id = (select auth.uid()))
  );
create policy "collection_items: delete own" on public.collection_items
  for delete to authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.uid()))
  );

-- ── tags ────────────────────────────────────────────────────────────────────
create policy "tags: read own" on public.tags
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tags: insert own" on public.tags
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tags: update own" on public.tags
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tags: delete own" on public.tags
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── item_tags (owned through both parents) ──────────────────────────────────
create policy "item_tags: read own" on public.item_tags
  for select to authenticated using (
    exists (select 1 from public.saved_items i where i.id = item_id and i.user_id = (select auth.uid()))
  );
create policy "item_tags: insert own" on public.item_tags
  for insert to authenticated with check (
    origin = 'user'
    and exists (select 1 from public.saved_items i where i.id = item_id and i.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );
create policy "item_tags: delete own" on public.item_tags
  for delete to authenticated using (
    exists (select 1 from public.saved_items i where i.id = item_id and i.user_id = (select auth.uid()))
  );

-- ── processing_jobs ─────────────────────────────────────────────────────────
-- Users can see and enqueue their own jobs. Claiming, retrying and completing
-- jobs is done only by Edge Functions with the service role (bypasses RLS),
-- so there is deliberately no update/delete policy for clients.
create policy "processing_jobs: read own" on public.processing_jobs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "processing_jobs: insert own" on public.processing_jobs
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and attempts = 0
    and exists (select 1 from public.saved_items i where i.id = saved_item_id and i.user_id = (select auth.uid()))
  );
