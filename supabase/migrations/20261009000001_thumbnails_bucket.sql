-- Recall's copies of preview images whose platform links expire or only work
-- for the fetching client (Instagram/Facebook CDNs). Written by the Edge
-- worker (service role) at thumbnails/{user_id}/{item_id}; read through the
-- public URL. Owners may delete their own files (the app does so when a save
-- is deleted); nobody but the worker writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnails', 'thumbnails', true, 5000000, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "thumbnails: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "thumbnails: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
