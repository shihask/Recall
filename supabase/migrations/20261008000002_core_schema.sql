-- Core Recall schema. Every user-owned row cascades away with its auth user,
-- so account deletion (auth.admin.deleteUser) removes all personal data.

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  display_name  text check (char_length(display_name) <= 80),
  avatar_url    text check (avatar_url is null or (avatar_url ~* '^https://' and char_length(avatar_url) <= 2048)),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── saved_items ─────────────────────────────────────────────────────────────
create table public.saved_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,

  url               text not null check (char_length(url) between 1 and 2048 and url ~* '^https?://'),
  canonical_url     text check (char_length(canonical_url) <= 2048),

  source            text not null default 'website'
                    check (source in ('instagram', 'youtube', 'reddit', 'x', 'facebook', 'website', 'other')),
  source_type       text not null default 'link'
                    check (source_type in ('reel', 'post', 'short', 'video', 'article', 'product', 'pdf', 'image', 'link')),

  title             text check (char_length(title) <= 500),
  description       text check (char_length(description) <= 5000),

  author_name       text check (char_length(author_name) <= 300),
  author_url        text check (author_url is null or (author_url ~* '^https?://' and char_length(author_url) <= 2048)),

  thumbnail_url     text check (thumbnail_url is null or (thumbnail_url ~* '^https?://' and char_length(thumbnail_url) <= 4096)),

  content_text      text check (char_length(content_text) <= 20000),

  ai_summary        text check (char_length(ai_summary) <= 2000),
  -- Mirrors supabase/functions/_shared/categories.ts — change both together.
  ai_category       text check (ai_category is null or ai_category in (
                      'Technology', 'Programming', 'Business', 'Finance', 'Travel', 'Food', 'Recipes',
                      'Health', 'Fitness', 'Photography', 'DIY', 'Home', 'Shopping', 'Vehicles',
                      'Motorcycles', 'Education', 'Entertainment', 'Lifestyle', 'Design', 'Other')),

  personal_note     text check (char_length(personal_note) <= 5000),

  metadata          jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),

  is_favorite       boolean not null default false,
  is_archived       boolean not null default false,

  processing_status text not null default 'pending'
                    check (processing_status in ('pending', 'processing', 'ready', 'partial', 'failed')),
  processing_error  text check (char_length(processing_error) <= 1000),

  -- Fields the user has edited by hand (e.g. 'title'). Enrichment never
  -- overwrites these, so reprocessing can't clobber the user's own words.
  user_edited       text[] not null default '{}',

  -- Denormalized tag names, kept current by triggers on item_tags/tags, so
  -- search can rank on tags without a join.
  tag_names         text not null default '',

  -- Search: one lowercase, unaccented document for trigram/ILIKE matching and
  -- a weighted tsvector for full-text ranking. Both derived, never written.
  search_document   text generated always as (
                      lower(public.immutable_unaccent(
                        coalesce(title, '') || ' ' || coalesce(tag_names, '') || ' ' ||
                        coalesce(personal_note, '') || ' ' || coalesce(ai_category, '') || ' ' ||
                        coalesce(ai_summary, '') || ' ' || coalesce(description, '') || ' ' ||
                        coalesce(author_name, '') || ' ' || left(coalesce(content_text, ''), 4000)
                      ))
                    ) stored,
  search_vector     tsvector generated always as (
                      setweight(to_tsvector('english', public.immutable_unaccent(coalesce(title, ''))), 'A') ||
                      setweight(to_tsvector('english', public.immutable_unaccent(
                        coalesce(tag_names, '') || ' ' || coalesce(personal_note, '') || ' ' || coalesce(ai_category, '')
                      )), 'B') ||
                      setweight(to_tsvector('english', public.immutable_unaccent(
                        coalesce(ai_summary, '') || ' ' || coalesce(description, '') || ' ' || coalesce(author_name, '')
                      )), 'C') ||
                      setweight(to_tsvector('english', public.immutable_unaccent(left(coalesce(content_text, ''), 8000))), 'D')
                    ) stored,

  -- Semantic search (gte-small, 384 dims). NULL until embedded; reset to NULL
  -- (via embedded_at) whenever the text it was built from changes.
  embedding         extensions.vector(384),
  embedded_at       timestamptz,

  saved_at          timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── collections ─────────────────────────────────────────────────────────────
create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  description  text check (char_length(description) <= 500),
  icon         text check (char_length(icon) <= 16),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index collections_user_name_key on public.collections (user_id, lower(btrim(name)));

-- ── collection_items ────────────────────────────────────────────────────────
create table public.collection_items (
  collection_id  uuid not null references public.collections(id) on delete cascade,
  saved_item_id  uuid not null references public.saved_items(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (collection_id, saved_item_id)
);

-- ── tags ────────────────────────────────────────────────────────────────────
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40 and name = btrim(name)),
  created_at  timestamptz not null default now()
);

create unique index tags_user_name_key on public.tags (user_id, lower(name));

-- ── item_tags ───────────────────────────────────────────────────────────────
create table public.item_tags (
  item_id     uuid not null references public.saved_items(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  -- 'user' tags are never removed by enrichment; 'ai' tags are replaced on reprocess.
  origin      text not null default 'user' check (origin in ('user', 'ai')),
  created_at  timestamptz not null default now(),
  primary key (item_id, tag_id)
);

-- ── processing_jobs ─────────────────────────────────────────────────────────
create table public.processing_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  saved_item_id  uuid not null references public.saved_items(id) on delete cascade,
  job_type       text not null check (job_type in ('enrich', 'embed')),
  status         text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts       integer not null default 0 check (attempts >= 0),
  error_message  text check (char_length(error_message) <= 1000),
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- At most one active job per item and type: re-saving or double-clicking
-- "Reprocess" can't queue duplicate work.
create unique index processing_jobs_one_active
  on public.processing_jobs (saved_item_id, job_type)
  where status in ('pending', 'processing');
