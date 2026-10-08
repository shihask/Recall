-- Semantic + hybrid search (gte-small, 384 dims, cosine).
--
-- Hybrid ranking = Reciprocal Rank Fusion of the keyword ranking
-- (search_items) and the vector ranking, so an item that matches both rises
-- to the top, while meaning-only matches ("bike accessories" → "motorcycle
-- phone mount") still appear. Nearest-neighbour search always returns
-- *something*, so meaning-only hits must clear a similarity floor.

create index saved_items_embedding_hnsw_idx
  on public.saved_items using hnsw (embedding extensions.vector_cosine_ops);

-- Shared filter predicate so keyword and vector branches can't drift apart.
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
      where ci.saved_item_id = i.id and ci.collection_id = (filters->>'collection_id')::uuid))
    and (nullif(filters->>'tag_id', '') is null or exists (
      select 1 from public.item_tags it
      where it.item_id = i.id and it.tag_id = (filters->>'tag_id')::uuid))
$$;

create or replace function public.hybrid_search_items(
  q                text,
  query_embedding  extensions.vector(384),
  filters          jsonb default '{}'::jsonb,
  lim              integer default 30,
  min_similarity   real default 0.80
)
returns table (id uuid, rank real, similarity real, keyword_match boolean)
language plpgsql
volatile -- sets a transaction-local planner option below
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  k constant integer := 60; -- standard RRF damping
begin
  if uid is null then
    return;
  end if;
  lim := least(greatest(coalesce(lim, 30), 1), 50);

  -- The HNSW index is shared by all users. Without iterative scans, the index
  -- returns the globally nearest rows and the user_id filter can discard all
  -- of them. pgvector >= 0.8 keeps scanning until enough rows pass the filter.
  begin
    perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  exception when others then
    null; -- older pgvector: falls back to plain post-filtering
  end;

  return query
  with kw as (
    select s.id, row_number() over (order by s.rank desc) as r
    from public.search_items(q, filters, 50, 0) s
  ),
  sem as (
    select i.id,
           row_number() over (order by i.embedding <=> query_embedding) as r,
           (1 - (i.embedding <=> query_embedding))::real as sim
    from public.saved_items i
    where i.user_id = uid
      and i.embedding is not null
      and public.item_matches_filters(i, filters)
    order by i.embedding <=> query_embedding
    limit 50
  ),
  fused as (
    select coalesce(kw.id, sem.id) as id,
           (coalesce(1.0 / (k + kw.r), 0) + coalesce(1.0 / (k + sem.r), 0))::real as score,
           sem.sim,
           kw.id is not null as kw_hit
    from kw
    full outer join sem on sem.id = kw.id
  )
  select f.id, f.score, f.sim, f.kw_hit
  from fused f
  where f.kw_hit or f.sim >= min_similarity
  order by f.score desc, f.sim desc nulls last
  limit lim;
end;
$$;

revoke execute on function public.item_matches_filters(public.saved_items, jsonb) from public, anon;
revoke execute on function public.hybrid_search_items(text, extensions.vector, jsonb, integer, real) from public, anon;
grant execute on function public.item_matches_filters(public.saved_items, jsonb) to authenticated;
grant execute on function public.hybrid_search_items(text, extensions.vector, jsonb, integer, real) to authenticated;
