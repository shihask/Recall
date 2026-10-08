-- Keyword search (V1). SECURITY INVOKER: runs as the calling user, so RLS
-- still applies; the explicit user_id predicate is for index use, not security.
--
-- Returns only (id, rank) — the client fetches the rows it displays with a
-- normal select (one round trip, typed, RLS-checked again) and keeps the order.
--
-- Matching is deliberately forgiving because people half-remember things:
--   * full-text terms are OR-ed and prefix-matched (ranking rewards items
--     matching more of them, and title > tags/note > summary > content);
--   * trigram word-similarity catches typos ("helmt visor");
--   * a plain substring match catches odd tokens (model numbers, handles).
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
        select 1 from public.collection_items ci where ci.saved_item_id = i.id and ci.collection_id = f_collection))
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

-- Create any missing tags for the caller and return all of them (by name,
-- case-insensitive). Used by the Save sheet and tag editor.
create or replace function public.ensure_tags(names text[])
returns setof public.tags
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text[];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select coalesce(array_agg(n), '{}')
  into cleaned
  from (
    select distinct on (lower(n)) n
    from (
      select btrim(left(btrim(regexp_replace(x, '\s+', ' ', 'g')), 40)) as n
      from unnest(coalesce(names, '{}')) as x
    ) raw
    where n <> ''
    order by lower(n), n
    limit 25
  ) s;

  insert into public.tags (user_id, name)
  select uid, n from unnest(cleaned) as n
  on conflict (user_id, lower(name)) do nothing;

  return query
  select t.*
  from public.tags t
  where t.user_id = uid
    and lower(t.name) in (select lower(n) from unnest(cleaned) as n);
end;
$$;

create or replace function public.library_stats()
returns table (saves bigint, collections bigint, favorites bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.saved_items where user_id = (select auth.uid()) and not is_archived),
    (select count(*) from public.collections where user_id = (select auth.uid())),
    (select count(*) from public.saved_items where user_id = (select auth.uid()) and is_favorite and not is_archived);
$$;

revoke execute on function public.search_items(text, jsonb, integer, integer) from public, anon;
revoke execute on function public.ensure_tags(text[]) from public, anon;
revoke execute on function public.library_stats() from public, anon;
grant execute on function public.search_items(text, jsonb, integer, integer) to authenticated;
grant execute on function public.ensure_tags(text[]) to authenticated;
grant execute on function public.library_stats() to authenticated;
