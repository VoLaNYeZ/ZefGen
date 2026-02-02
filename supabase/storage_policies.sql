-- Run these policies in Supabase Storage > Policies (uses storage admin).
-- These policies allow each user to read/write their own objects per bucket.

create policy "brand_refs_storage_select_own" on storage.objects
    for select using (bucket_id = 'brand-references' and auth.uid() = owner);
create policy "brand_refs_storage_insert_own" on storage.objects
    for insert with check (bucket_id = 'brand-references' and auth.uid() = owner);
create policy "brand_refs_storage_update_own" on storage.objects
    for update using (bucket_id = 'brand-references' and auth.uid() = owner);
create policy "brand_refs_storage_delete_own" on storage.objects
    for delete using (bucket_id = 'brand-references' and auth.uid() = owner);

create policy "app_screenshots_storage_select_own" on storage.objects
    for select using (bucket_id = 'app-screenshots' and auth.uid() = owner);
create policy "app_screenshots_storage_insert_own" on storage.objects
    for insert with check (bucket_id = 'app-screenshots' and auth.uid() = owner);
create policy "app_screenshots_storage_update_own" on storage.objects
    for update using (bucket_id = 'app-screenshots' and auth.uid() = owner);
create policy "app_screenshots_storage_delete_own" on storage.objects
    for delete using (bucket_id = 'app-screenshots' and auth.uid() = owner);

create policy "generated_assets_storage_select_own" on storage.objects
    for select using (bucket_id = 'generated-assets' and auth.uid() = owner);
create policy "generated_assets_storage_insert_own" on storage.objects
    for insert with check (bucket_id = 'generated-assets' and auth.uid() = owner);
create policy "generated_assets_storage_update_own" on storage.objects
    for update using (bucket_id = 'generated-assets' and auth.uid() = owner);
create policy "generated_assets_storage_delete_own" on storage.objects
    for delete using (bucket_id = 'generated-assets' and auth.uid() = owner);
