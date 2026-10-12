-- Guest mode. Supabase anonymous sign-ins give a visitor a real, private
-- account with no email (auth.users.is_anonymous). Everything else — RLS,
-- processing, search — works unchanged. Guests may keep up to 5 saves; signing
-- up or logging in moves their data into the real account (claim_guest_data,
-- called only by the claim-guest Edge Function).

-- ── Guest save limit ────────────────────────────────────────────────────────
-- Mirrors GUEST_SAVE_LIMIT in src/features/auth/guest.ts — change both together.
create or replace function public.guest_save_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

-- SECURITY DEFINER to read auth.users and count every save, not just the
-- RLS-visible ones (the same, but this also covers service-role inserts).
create or replace function public.enforce_guest_save_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = new.user_id and u.is_anonymous) then
    return new;
  end if;
  -- Serialize one guest's concurrent saves so two at once can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.saved_items i where i.user_id = new.user_id) >= public.guest_save_limit() then
    raise exception 'guest_limit' using errcode = 'P0001', hint = 'Sign up or log in to keep saving.';
  end if;
  return new;
end;
$$;

create trigger saved_items_guest_limit before insert on public.saved_items
  for each row execute function public.enforce_guest_save_limit();

revoke execute on function public.enforce_guest_save_limit() from public, anon, authenticated;

-- ── Ownership stays immutable, except while claiming guest data ─────────────
-- recall.claiming_guest is set (transaction-local) only inside
-- claim_guest_data below. API clients can't set settings: PostgREST exposes
-- no way to run set_config, and no client-callable function does.
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     and coalesce(current_setting('recall.claiming_guest', true), '') <> 'on' then
    raise exception 'user_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ── Claim a guest's data ────────────────────────────────────────────────────
-- Moves every save, job, tag and collection from a guest to a full account.
-- Tags and collections with a name the account already has are merged into
-- the existing one. Returns the number of saves moved. The guest user itself
-- is deleted afterwards by the Edge Function (auth admin API).
create or replace function public.claim_guest_data(p_guest uuid, p_owner uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer;
begin
  if p_guest = p_owner then
    raise exception 'cannot claim into the same account' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_guest and is_anonymous) then
    raise exception 'not a guest account' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_owner and not is_anonymous) then
    raise exception 'can only claim into a full account' using errcode = '42501';
  end if;

  perform set_config('recall.claiming_guest', 'on', true);

  -- 1. Saves, then their jobs (the job owner check follows the item).
  update public.saved_items set user_id = p_owner where user_id = p_guest;
  get diagnostics moved = row_count;
  update public.processing_jobs set user_id = p_owner where user_id = p_guest;

  -- 2. Tags: link to the account's tag of the same name; move the rest.
  insert into public.item_tags (item_id, tag_id, origin)
  select it.item_id, ot.id, it.origin
  from public.item_tags it
  join public.tags gt on gt.id = it.tag_id and gt.user_id = p_guest
  join public.tags ot on ot.user_id = p_owner and lower(ot.name) = lower(gt.name)
  on conflict (item_id, tag_id) do nothing;

  delete from public.tags gt
  where gt.user_id = p_guest
    and exists (select 1 from public.tags ot where ot.user_id = p_owner and lower(ot.name) = lower(gt.name));

  update public.tags set user_id = p_owner where user_id = p_guest;

  -- 3. Collections: merge same-named ones into the account's; move the rest.
  drop table if exists pg_temp.guest_collection_match;
  create temporary table guest_collection_match on commit drop as
  select gc.id as guest_id, oc.id as owner_id, oc.parent_id as owner_parent
  from public.collections gc
  join public.collections oc on oc.user_id = p_owner and lower(btrim(oc.name)) = lower(btrim(gc.name))
  where gc.user_id = p_guest;

  insert into public.collection_items (collection_id, saved_item_id)
  select m.owner_id, ci.saved_item_id
  from public.collection_items ci
  join pg_temp.guest_collection_match m on m.guest_id = ci.collection_id
  on conflict do nothing;

  -- Only user_id changes here, so the nesting trigger (on parent_id) doesn't run
  -- while parents and children are half-moved.
  update public.collections c
  set user_id = p_owner
  where c.user_id = p_guest
    and not exists (select 1 from pg_temp.guest_collection_match m where m.guest_id = c.id);

  -- Sub-collections whose parent was merged: hang them under the account's
  -- collection of that name when it's top-level, otherwise make them top-level.
  update public.collections c
  set parent_id = case when m.owner_parent is null then m.owner_id end
  from pg_temp.guest_collection_match m
  where c.user_id = p_owner and c.parent_id = m.guest_id;

  delete from public.collections c
  using pg_temp.guest_collection_match m
  where c.id = m.guest_id;

  return moved;
end;
$$;

-- Service role only (the claim-guest Edge Function).
revoke execute on function public.claim_guest_data(uuid, uuid) from public, anon, authenticated;
