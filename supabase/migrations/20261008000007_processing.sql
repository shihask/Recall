-- Background processing state machine. Called only by Edge Functions with the
-- service role; never exposed to clients.
--
-- Idempotency guarantees:
--   * start_processing atomically claims one job; concurrent or repeated calls
--     for the same item+type get NULL instead of a second worker.
--   * a job stuck in 'processing' (worker crashed) is reclaimed after 5 min.
--   * apply_ai_tags converges to the same tag set no matter how often it runs,
--     and never touches tags the user added.

create or replace function public.start_processing(p_item uuid, p_type text, p_force boolean default false)
returns public.processing_jobs
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_job public.processing_jobs;
  v_job_id uuid;
begin
  if p_type not in ('enrich', 'embed') then
    raise exception 'invalid job type %', p_type using errcode = '22023';
  end if;

  select user_id into v_owner from public.saved_items where id = p_item;
  if v_owner is null then
    return null;
  end if;

  -- Reclaim a job whose worker died mid-run.
  update public.processing_jobs
  set status = 'failed', error_message = 'Timed out', completed_at = now()
  where saved_item_id = p_item and job_type = p_type and status = 'processing'
    and started_at < now() - interval '5 minutes';

  -- Already running? Then this call is a no-op.
  if exists (select 1 from public.processing_jobs where saved_item_id = p_item and job_type = p_type and status = 'processing') then
    return null;
  end if;

  -- Prefer the queued job; else the most recent retryable failure; else (when
  -- forced) a brand-new job.
  select id into v_job_id from public.processing_jobs
  where saved_item_id = p_item and job_type = p_type and status = 'pending'
  order by created_at desc limit 1;

  if v_job_id is null and not p_force then
    select id into v_job_id from public.processing_jobs
    where saved_item_id = p_item and job_type = p_type and status = 'failed' and attempts < 3
    order by created_at desc limit 1;
  end if;

  if v_job_id is null and p_force then
    begin
      insert into public.processing_jobs (user_id, saved_item_id, job_type)
      values (v_owner, p_item, p_type)
      returning id into v_job_id;
    exception when unique_violation then
      -- A concurrent call queued it first; let that one run.
      return null;
    end;
  end if;

  if v_job_id is null then
    return null;
  end if;

  -- Atomic claim: only one caller can move pending/failed → processing.
  update public.processing_jobs
  set status = 'processing', attempts = attempts + 1, started_at = now(), completed_at = null, error_message = null
  where id = v_job_id and status in ('pending', 'failed')
  returning * into v_job;

  if v_job.id is null then
    return null;
  end if;

  if p_type = 'enrich' then
    update public.saved_items set processing_status = 'processing', processing_error = null where id = p_item;
  end if;

  return v_job;
end;
$$;

create or replace function public.finish_processing(p_job uuid, p_ok boolean, p_error text default null)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.processing_jobs
  set status = case when p_ok then 'completed' else 'failed' end,
      error_message = case when p_ok then null else left(p_error, 1000) end,
      completed_at = now()
  where id = p_job and status = 'processing';
$$;

-- Replace this item's AI-suggested tags with `p_names` (normalized, max 7).
-- User-origin tags are never removed; if the user already has a tag with the
-- same name on the item, it stays a user tag.
create or replace function public.apply_ai_tags(p_item uuid, p_names text[])
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_clean text[];
begin
  select user_id into v_owner from public.saved_items where id = p_item;
  if v_owner is null then
    return;
  end if;

  select coalesce(array_agg(n), '{}')
  into v_clean
  from (
    select distinct on (lower(n)) n
    from (
      select btrim(left(btrim(regexp_replace(x, '\s+', ' ', 'g')), 40)) as n
      from unnest(coalesce(p_names, '{}')) with ordinality as u(x, ord)
    ) raw
    where n <> ''
    order by lower(n)
    limit 7
  ) s;

  delete from public.item_tags it
  using public.tags t
  where it.item_id = p_item
    and it.origin = 'ai'
    and t.id = it.tag_id
    and not (lower(t.name) = any (select lower(n) from unnest(v_clean) as n));

  insert into public.tags (user_id, name)
  select v_owner, n from unnest(v_clean) as n
  on conflict (user_id, lower(name)) do nothing;

  insert into public.item_tags (item_id, tag_id, origin)
  select p_item, t.id, 'ai'
  from public.tags t
  where t.user_id = v_owner
    and lower(t.name) in (select lower(n) from unnest(v_clean) as n)
  on conflict (item_id, tag_id) do nothing;
end;
$$;

revoke execute on function public.start_processing(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.finish_processing(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.apply_ai_tags(uuid, text[]) from public, anon, authenticated;
grant execute on function public.start_processing(uuid, text, boolean) to service_role;
grant execute on function public.finish_processing(uuid, boolean, text) to service_role;
grant execute on function public.apply_ai_tags(uuid, text[]) to service_role;
