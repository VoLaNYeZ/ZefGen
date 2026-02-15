-- ZefGen schema verification checklist
-- Run in Supabase SQL Editor and share the results back.

-- 1) Extension checks
select 'pgcrypto' as extension, exists(
    select 1 from pg_extension where extname = 'pgcrypto'
) as is_installed;

-- 2) Table existence
select 'brands' as table, to_regclass('public.brands') is not null as exists
union all select 'apps', to_regclass('public.apps') is not null
union all select 'appstore_accounts', to_regclass('public.appstore_accounts') is not null
union all select 'brand_references', to_regclass('public.brand_references') is not null
union all select 'app_screenshot_prompts', to_regclass('public.app_screenshot_prompts') is not null
union all select 'app_screenshots', to_regclass('public.app_screenshots') is not null
union all select 'app_generated_assets', to_regclass('public.app_generated_assets') is not null;

-- 3) Required columns (sample critical columns)
select 'brands.slug' as column, exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'brands' and column_name = 'slug'
) as exists
union all select 'apps.is_banned', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'apps' and column_name = 'is_banned'
)
union all select 'brand_references.kind', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'brand_references' and column_name = 'kind'
)
union all select 'app_screenshot_prompts.brand_reference_id', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_screenshot_prompts' and column_name = 'brand_reference_id'
)
union all select 'app_generated_assets.edit_state', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_generated_assets' and column_name = 'edit_state'
);

-- 4) Index existence
select 'brands_user_slug_key' as index, to_regclass('public.brands_user_slug_key') is not null as exists
union all select 'brands_user_id_idx', to_regclass('public.brands_user_id_idx') is not null
union all select 'apps_brand_alias_key', to_regclass('public.apps_brand_alias_key') is not null
union all select 'apps_user_id_idx', to_regclass('public.apps_user_id_idx') is not null
union all select 'apps_brand_id_idx', to_regclass('public.apps_brand_id_idx') is not null
union all select 'brand_references_user_id_idx', to_regclass('public.brand_references_user_id_idx') is not null
union all select 'brand_references_brand_id_idx', to_regclass('public.brand_references_brand_id_idx') is not null
union all select 'brand_references_one_icon_per_brand', to_regclass('public.brand_references_one_icon_per_brand') is not null
union all select 'app_screenshot_prompts_app_ref_key', to_regclass('public.app_screenshot_prompts_app_ref_key') is not null
union all select 'app_screenshot_prompts_user_id_idx', to_regclass('public.app_screenshot_prompts_user_id_idx') is not null
union all select 'app_screenshot_prompts_brand_id_idx', to_regclass('public.app_screenshot_prompts_brand_id_idx') is not null
union all select 'app_screenshot_prompts_app_id_idx', to_regclass('public.app_screenshot_prompts_app_id_idx') is not null
union all select 'app_screenshots_user_id_idx', to_regclass('public.app_screenshots_user_id_idx') is not null
union all select 'app_screenshots_brand_id_idx', to_regclass('public.app_screenshots_brand_id_idx') is not null
union all select 'app_screenshots_app_id_idx', to_regclass('public.app_screenshots_app_id_idx') is not null
union all select 'app_generated_assets_user_id_idx', to_regclass('public.app_generated_assets_user_id_idx') is not null
union all select 'app_generated_assets_brand_id_idx', to_regclass('public.app_generated_assets_brand_id_idx') is not null
union all select 'app_generated_assets_app_id_idx', to_regclass('public.app_generated_assets_app_id_idx') is not null
union all select 'app_generated_assets_slot_idx', to_regclass('public.app_generated_assets_slot_idx') is not null;

-- 5) RLS enabled
select 'brands' as table, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'brands'
union all
select 'apps', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'apps'
union all
select 'appstore_accounts', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'appstore_accounts'
union all
select 'brand_references', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'brand_references'
union all
select 'app_screenshot_prompts', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'app_screenshot_prompts'
union all
select 'app_screenshots', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'app_screenshots'
union all
select 'app_generated_assets', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'app_generated_assets';

-- 6) RLS policies existence
select 'brands_select_own' as policy, exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brands' and policyname = 'brands_select_own'
) as exists
union all select 'brands_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brands' and policyname = 'brands_insert_own'
)
union all select 'brands_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brands' and policyname = 'brands_update_own'
)
union all select 'brands_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brands' and policyname = 'brands_delete_own'
)
union all select 'apps_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'apps' and policyname = 'apps_select_own'
)
union all select 'apps_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'apps' and policyname = 'apps_insert_own'
)
union all select 'apps_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'apps' and policyname = 'apps_update_own'
)
union all select 'apps_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'apps' and policyname = 'apps_delete_own'
)
union all select 'appstore_accounts_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appstore_accounts' and policyname = 'appstore_accounts_select_own'
)
union all select 'appstore_accounts_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appstore_accounts' and policyname = 'appstore_accounts_insert_own'
)
union all select 'appstore_accounts_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appstore_accounts' and policyname = 'appstore_accounts_update_own'
)
union all select 'appstore_accounts_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appstore_accounts' and policyname = 'appstore_accounts_delete_own'
)
union all select 'brand_refs_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brand_references' and policyname = 'brand_refs_select_own'
)
union all select 'brand_refs_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brand_references' and policyname = 'brand_refs_insert_own'
)
union all select 'brand_refs_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brand_references' and policyname = 'brand_refs_update_own'
)
union all select 'brand_refs_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brand_references' and policyname = 'brand_refs_delete_own'
)
union all select 'app_screenshot_prompts_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshot_prompts' and policyname = 'app_screenshot_prompts_select_own'
)
union all select 'app_screenshot_prompts_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshot_prompts' and policyname = 'app_screenshot_prompts_insert_own'
)
union all select 'app_screenshot_prompts_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshot_prompts' and policyname = 'app_screenshot_prompts_update_own'
)
union all select 'app_screenshot_prompts_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshot_prompts' and policyname = 'app_screenshot_prompts_delete_own'
)
union all select 'app_screenshots_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshots' and policyname = 'app_screenshots_select_own'
)
union all select 'app_screenshots_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshots' and policyname = 'app_screenshots_insert_own'
)
union all select 'app_screenshots_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshots' and policyname = 'app_screenshots_update_own'
)
union all select 'app_screenshots_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_screenshots' and policyname = 'app_screenshots_delete_own'
)
union all select 'app_generated_assets_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_generated_assets' and policyname = 'app_generated_assets_select_own'
)
union all select 'app_generated_assets_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_generated_assets' and policyname = 'app_generated_assets_insert_own'
)
union all select 'app_generated_assets_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_generated_assets' and policyname = 'app_generated_assets_update_own'
)
union all select 'app_generated_assets_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_generated_assets' and policyname = 'app_generated_assets_delete_own'
);

-- 7) Storage buckets existence (requires access to storage schema)
select id, name, public
from storage.buckets
where id in ('brand-references', 'app-screenshots', 'generated-assets');
