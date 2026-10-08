-- Sub-collections: one level of nesting (Travel → Munnar, Ooty, Wayanad).
--
-- * A parent shows its own saves plus every sub-collection's saves.
-- * Deleting a parent moves its sub-collections to the top level
--   (on delete set null). Names stay unique per user
--   (collections_user_name_key), so that move can never collide.

alter table public.collections
  add column parent_id uuid references public.collections(id) on delete set null;

create index collections_parent_idx on public.collections (parent_id) where parent_id is not null;

-- ── nesting rules ───────────────────────────────────────────────────────────
-- SECURITY DEFINER so the checks see the real parent row, not an RLS-filtered
-- view of it; the user_id comparison is the ownership check.
create or replace function public.ensure_valid_collection_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.collections;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'collection cannot be its own parent' using errcode = '23514';
  end if;

  select * into parent from public.collections c where c.id = new.parent_id;
  if not found or parent.user_id <> new.user_id then
    raise exception 'parent collection belongs to another user' using errcode = '42501';
  end if;

  if parent.parent_id is not null then
    raise exception 'sub-collections cannot have sub-collections' using errcode = '23514';
  end if;

  if exists (select 1 from public.collections c where c.parent_id = new.id) then
    raise exception 'collection with sub-collections cannot become a sub-collection' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger collections_valid_parent before insert or update of parent_id on public.collections
  for each row execute function public.ensure_valid_collection_parent();

-- ── filters include sub-collections ─────────────────────────────────────────
-- Same bodies as before; the only change is that a collection filter matches
-- the collection itself or any of its sub-collections.
create or replace function public.item_matches_filters(i public.saved_items, filters jsonb)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
        (coalesce((filters->>'include_archived')::boolean, false) or not i.is_archived)
    and (nullif(filters->>'source', '') is null or i.source = filters->>'source')
    and (nullif(filters->>'category', '') is null or i.ai_category = filters->>'category')
    and (not coalesce((filters->>'favorite')::boolean, false) or i.is_favorite)
    and (nullif(filters->>'from', '') is null or i.saved_at >= (filters->>'from')::timestamptz)
    and (nullif(filters->>'to', '') is null or i.saved_at < (filters->>'to')::timestamptz)
    and (nullif(filters->>'collection_id', '') is null or exists (
      select 1 from public.collection_items ci
      where ci.saved_item_id = i.id and ci.collection_id in (
        select c.id from public.collections c
        where c.id = (filters->>'collection_id')::uuid or c.parent_id = (filters->>'collection_id')::uuid)))
    and (nullif(filters->>'tag_id', '') is null or exists (
      select 1 from public.item_tags it
      where it.item_id = i.id and it.tag_id = (filters->>'tag_id')::uuid))
$$;

create or replace function public.search_items(
  q        text,
  filters  jsonb default '{}'::jsonb,
  lim      integer default 20,
  off      integer default 0
)
returns table (id uuid, rank real)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid              uuid := auth.uid();
  clean            text := left(btrim(coalesce(q, '')), 300);
  norm             text;
  like_pattern     text;
  tsq              tsquery;
  tsq_text         text;
  f_source         text := nullif(filters->>'source', '');
  f_category       text := nullif(filters->>'category', '');
  f_collection     uuid := nullif(filters->>'collection_id', '')::uuid;
  f_tag            uuid := nullif(filters->>'tag_id', '')::uuid;
  f_favorite       boolean := coalesce((filters->>'favorite')::boolean, false);
  f_archived       boolean := coalesce((filters->>'include_archived')::boolean, false);
  f_from           timestamptz := nullif(filters->>'from', '')::timestamptz;
  f_to             timestamptz := nullif(filters->>'to', '')::timestamptz;
  f_boost_source   text := nullif(filters->>'boost_source', '');
  f_boost_type     text := nullif(filters->>'boost_type', '');
  f_sort           text := coalesce(nullif(filters->>'sort', ''), 'relevance');
begin
  if uid is null then
    return;
  end if;

  lim := least(greatest(coalesce(lim, 20), 1), 50);
  off := greatest(coalesce(off, 0), 0);
  norm := lower(public.immutable_unaccent(clean));
  like_pattern := '%' || replace(replace(replace(norm, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  if clean <> '' then
    tsq_text := websearch_to_tsquery('english', public.immutable_unaccent(clean))::text;
    if tsq_text <> '' then
      begin
        -- AND → OR, and every lexeme becomes a prefix match ('print' → 'print':*).
        tsq_text := replace(tsq_text, ' & ', ' | ');
        tsq_text := regexp_replace(tsq_text, '''([^'']+)''', '''\1'':*', 'g');
        tsq := tsq_text::tsquery;
      exception when others then
        -- Odd input (quotes inside lexemes…) must never break search.
        tsq := websearch_to_tsquery('english', public.immutable_unaccent(clean));
      end;
    end if;
  end if;

  return query
  with base as (
    select i.id, i.saved_at, i.source, i.source_type, i.search_vector, i.search_document
    from public.saved_items i
    where i.user_id = uid
      and (f_archived or not i.is_archived)
      and (f_source is null or i.source = f_source)
      and (f_category is null or i.ai_category = f_category)
      and (not f_favorite or i.is_favorite)
      and (f_from is null or i.saved_at >= f_from)
      and (f_to is null or i.saved_at < f_to)
      and (f_collection is null or exists (
        select 1 from public.collection_items ci
        where ci.saved_item_id = i.id and ci.collection_id in (
          select c.id from public.collections c where c.id = f_collection or c.parent_id = f_collection)))
      and (f_tag is null or exists (
        select 1 from public.item_tags it where it.item_id = i.id and it.tag_id = f_tag))
  ),
  matched as (
    select
      b.id,
      b.saved_at,
      case when clean = '' then 0::real else (
          coalesce(ts_rank_cd(b.search_vector, tsq, 32), 0) * 2.0
        + word_similarity(norm, b.search_document) * 0.6
        + case when f_boost_type is not null and b.source_type = f_boost_type then 0.15 else 0 end
        + case when f_boost_source is not null and b.source = f_boost_source then 0.15 else 0 end
      )::real end as score
    from base b
    where clean = ''
       or (tsq is not null and b.search_vector @@ tsq)
       or norm <% b.search_document
       or b.search_document like like_pattern
  )
  select m.id, m.score
  from matched m
  order by
    case when f_sort = 'newest' or clean = '' then null else m.score end desc nulls last,
    m.saved_at desc,
    m.id
  limit lim offset off;
end;
$$;

-- ── totals ──────────────────────────────────────────────────────────────────
-- Distinct saves in each collection plus its sub-collections. Counted after
-- joining through collection_items — never by summing child counts — so a
-- save in both Travel and Munnar counts once for Travel.
create or replace function public.collection_totals()
returns table (id uuid, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, count(distinct ci.saved_item_id)
  from public.collections c
  left join public.collections member
    on member.user_id = c.user_id and (member.id = c.id or member.parent_id = c.id)
  left join public.collection_items ci on ci.collection_id = member.id
  where c.user_id = (select auth.uid())
  group by c.id;
$$;

revoke execute on function public.collection_totals() from public, anon;
grant execute on function public.collection_totals() to authenticated;
