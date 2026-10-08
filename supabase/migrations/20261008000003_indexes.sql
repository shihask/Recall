-- Every list in the app is "this user's items, newest first, maybe filtered",
-- so indexes lead with user_id.
create index saved_items_user_saved_at_idx on public.saved_items (user_id, saved_at desc, id desc);
create index saved_items_user_canonical_idx on public.saved_items (user_id, canonical_url);
create index saved_items_user_source_idx on public.saved_items (user_id, source);
create index saved_items_user_category_idx on public.saved_items (user_id, ai_category);
create index saved_items_user_favorite_idx on public.saved_items (user_id, saved_at desc) where is_favorite and not is_archived;
create index saved_items_user_archived_idx on public.saved_items (user_id, saved_at desc) where is_archived;
create index saved_items_user_active_idx on public.saved_items (user_id, saved_at desc) where not is_archived;

-- Full-text and fuzzy search.
create index saved_items_search_vector_idx on public.saved_items using gin (search_vector);
create index saved_items_search_document_trgm_idx on public.saved_items using gin (search_document extensions.gin_trgm_ops);

-- FK / lookup paths.
create index collections_user_idx on public.collections (user_id, updated_at desc);
create index collection_items_item_idx on public.collection_items (saved_item_id);
create index collection_items_collection_created_idx on public.collection_items (collection_id, created_at desc);
create index item_tags_tag_idx on public.item_tags (tag_id);
create index processing_jobs_item_idx on public.processing_jobs (saved_item_id);
create index processing_jobs_retry_idx on public.processing_jobs (status, created_at) where status in ('pending', 'failed');
create index processing_jobs_user_idx on public.processing_jobs (user_id);
