-- Extensions live in the `extensions` schema (Supabase convention), so every
-- reference below is schema-qualified or uses search_path = public, extensions.
create schema if not exists extensions;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists vector with schema extensions;

-- unaccent() is STABLE (it depends on a dictionary lookup), which generated
-- columns and index expressions reject. Pinning the dictionary makes the
-- result deterministic, so this wrapper is safe to declare IMMUTABLE.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;
