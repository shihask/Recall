-- ── updated_at ──────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger saved_items_updated_at before update on public.saved_items
  for each row execute function public.set_updated_at();
create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

-- ── Profile on signup ───────────────────────────────────────────────────────
-- SECURITY DEFINER because it runs as part of auth's insert into auth.users;
-- search_path is pinned and every name qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := nullif(btrim(coalesce(meta->>'display_name', meta->>'full_name', meta->>'name', '')), '');
  avatar text := meta->>'avatar_url';
begin
  if avatar is not null and (avatar !~* '^https://' or char_length(avatar) > 2048) then
    avatar := null;
  end if;
  insert into public.profiles (user_id, display_name, avatar_url)
  values (new.id, left(name, 80), avatar)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Immutable ownership ─────────────────────────────────────────────────────
-- user_id can never be reassigned, even by a buggy client that passes RLS
-- (WITH CHECK alone would allow moving a row between columns you own).
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger saved_items_owner_immutable before update of user_id on public.saved_items
  for each row execute function public.prevent_owner_change();
create trigger collections_owner_immutable before update of user_id on public.collections
  for each row execute function public.prevent_owner_change();
create trigger tags_owner_immutable before update of user_id on public.tags
  for each row execute function public.prevent_owner_change();
create trigger profiles_owner_immutable before update of user_id on public.profiles
  for each row execute function public.prevent_owner_change();
create trigger jobs_owner_immutable before update of user_id on public.processing_jobs
  for each row execute function public.prevent_owner_change();

-- ── Cross-user link guard ───────────────────────────────────────────────────
-- Join rows may only connect things owned by the same user. RLS already
-- enforces this for clients; this also protects service-role writers (Edge
-- Functions) from a logic bug linking one user's tag to another's item.
create or replace function public.ensure_same_owner_item_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.saved_items i
    join public.tags t on t.user_id = i.user_id
    where i.id = new.item_id and t.id = new.tag_id
  ) then
    raise exception 'item and tag must belong to the same user' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger item_tags_same_owner before insert or update on public.item_tags
  for each row execute function public.ensure_same_owner_item_tag();

create or replace function public.ensure_same_owner_collection_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.saved_items i
    join public.collections c on c.user_id = i.user_id
    where i.id = new.saved_item_id and c.id = new.collection_id
  ) then
    raise exception 'item and collection must belong to the same user' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger collection_items_same_owner before insert or update on public.collection_items
  for each row execute function public.ensure_same_owner_collection_item();

create or replace function public.ensure_same_owner_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.saved_items i where i.id = new.saved_item_id and i.user_id = new.user_id) then
    raise exception 'job must belong to the item owner' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger processing_jobs_same_owner before insert or update on public.processing_jobs
  for each row execute function public.ensure_same_owner_job();

-- ── Denormalized tag names for search ───────────────────────────────────────
create or replace function public.refresh_item_tag_names(p_item_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.saved_items i
  set tag_names = coalesce((
    select string_agg(t.name, ' ' order by lower(t.name))
    from public.item_tags it
    join public.tags t on t.id = it.tag_id
    where it.item_id = p_item_id
  ), '')
  where i.id = p_item_id;
$$;

-- Not callable through the API; only from the triggers below.
revoke execute on function public.refresh_item_tag_names(uuid) from public, anon, authenticated;

create or replace function public.item_tags_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_item_tag_names(new.item_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    if tg_op = 'DELETE' or old.item_id is distinct from new.item_id then
      perform public.refresh_item_tag_names(old.item_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger item_tags_refresh after insert or update or delete on public.item_tags
  for each row execute function public.item_tags_changed();

create or replace function public.tags_renamed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select item_id from public.item_tags where tag_id = new.id loop
    perform public.refresh_item_tag_names(r.item_id);
  end loop;
  return null;
end;
$$;

create trigger tags_rename_refresh after update of name on public.tags
  for each row when (old.name is distinct from new.name)
  execute function public.tags_renamed();

-- ── Embedding staleness ─────────────────────────────────────────────────────
-- When any text the embedding was built from changes, mark it stale so the
-- embed step (and retry worker) knows to rebuild it.
create or replace function public.mark_embedding_stale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An update that sets embedded_at itself is the embed step writing a fresh
  -- vector; leave it alone. (Comparing embedded_at also avoids needing the
  -- vector `=` operator from the extensions schema here.)
  if new.embedded_at is not distinct from old.embedded_at and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.ai_summary is distinct from old.ai_summary
    or new.personal_note is distinct from old.personal_note
    or new.tag_names is distinct from old.tag_names
    or new.ai_category is distinct from old.ai_category
  ) then
    new.embedded_at := null;
  end if;
  return new;
end;
$$;

create trigger saved_items_embedding_stale before update on public.saved_items
  for each row execute function public.mark_embedding_stale();
