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
union all select 'app_idea_categories', to_regclass('public.app_idea_categories') is not null
union all select 'app_ideas', to_regclass('public.app_ideas') is not null
union all select 'brand_references', to_regclass('public.brand_references') is not null
union all select 'app_screenshot_prompts', to_regclass('public.app_screenshot_prompts') is not null
union all select 'app_screenshots', to_regclass('public.app_screenshots') is not null
union all select 'app_generated_assets', to_regclass('public.app_generated_assets') is not null
union all select 'connector_app_configs', to_regclass('public.connector_app_configs') is not null
union all select 'connector_legal_links', to_regclass('public.connector_legal_links') is not null;

-- 3) Required columns (sample critical columns)
select 'brands.slug' as column, exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'brands' and column_name = 'slug'
) as exists
union all select 'brands.is_inactive', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'brands' and column_name = 'is_inactive'
)
union all select 'apps.is_banned', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'apps' and column_name = 'is_banned'
)
union all select 'apps.appstore_url', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'apps' and column_name = 'appstore_url'
)
union all select 'appstore_accounts.id', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appstore_accounts' and column_name = 'id'
)
union all select 'appstore_accounts.was_used_before', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appstore_accounts' and column_name = 'was_used_before'
)
union all select 'appstore_accounts.notes', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appstore_accounts' and column_name = 'notes'
)
union all select 'app_idea_categories.name', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_idea_categories' and column_name = 'name'
)
union all select 'app_ideas.category_id', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_ideas' and column_name = 'category_id'
)
union all select 'app_ideas.title', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_ideas' and column_name = 'title'
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
)
union all select 'connector_legal_links.fingerprint', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'connector_legal_links' and column_name = 'fingerprint'
)
union all select 'connector_app_configs.idea_id', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'connector_app_configs' and column_name = 'idea_id'
);

-- 4) Index existence
select 'brands_user_slug_key' as index, to_regclass('public.brands_user_slug_key') is not null as exists
union all select 'brands_user_id_idx', to_regclass('public.brands_user_id_idx') is not null
union all select 'apps_brand_alias_key', to_regclass('public.apps_brand_alias_key') is not null
union all select 'apps_user_alias_lower_key', to_regclass('public.apps_user_alias_lower_key') is not null
union all select 'apps_user_id_idx', to_regclass('public.apps_user_id_idx') is not null
union all select 'apps_brand_id_idx', to_regclass('public.apps_brand_id_idx') is not null
union all select 'appstore_accounts_user_id_idx', to_regclass('public.appstore_accounts_user_id_idx') is not null
union all select 'appstore_accounts_user_geo_idx', to_regclass('public.appstore_accounts_user_geo_idx') is not null
union all select 'appstore_accounts_app_id_unique', to_regclass('public.appstore_accounts_app_id_unique') is not null
union all select 'app_ideas_user_id_idx', to_regclass('public.app_ideas_user_id_idx') is not null
union all select 'app_ideas_user_category_idx', to_regclass('public.app_ideas_user_category_idx') is not null
union all select 'app_ideas_user_created_idx', to_regclass('public.app_ideas_user_created_idx') is not null
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
union all select 'app_generated_assets_slot_idx', to_regclass('public.app_generated_assets_slot_idx') is not null
union all select 'connector_app_configs_idea_id_idx', to_regclass('public.connector_app_configs_idea_id_idx') is not null
union all select 'connector_legal_links_user_app_created_idx', to_regclass('public.connector_legal_links_user_app_created_idx') is not null
union all select 'connector_legal_links_app_fingerprint_created_idx', to_regclass('public.connector_legal_links_app_fingerprint_created_idx') is not null;

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
select 'app_idea_categories', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'app_idea_categories'
union all
select 'app_ideas', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'app_ideas'
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
where n.nspname = 'public' and c.relname = 'app_generated_assets'
union all
select 'connector_app_configs', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'connector_app_configs'
union all
select 'connector_legal_links', c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'connector_legal_links';

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
union all select 'app_idea_categories_select_authenticated', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_idea_categories' and policyname = 'app_idea_categories_select_authenticated'
)
union all select 'app_ideas_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_ideas' and policyname = 'app_ideas_select_own'
)
union all select 'app_ideas_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_ideas' and policyname = 'app_ideas_insert_own'
)
union all select 'app_ideas_update_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_ideas' and policyname = 'app_ideas_update_own'
)
union all select 'app_ideas_delete_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_ideas' and policyname = 'app_ideas_delete_own'
)
union all select 'appstore_accounts_used_before_blocks', exists(
    select 1 from pg_constraint
    where conname = 'appstore_accounts_used_before_blocks'
        and conrelid = 'public.appstore_accounts'::regclass
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
)
union all select 'connector_legal_links_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'connector_legal_links' and policyname = 'connector_legal_links_select_own'
)
union all select 'connector_legal_links_insert_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'connector_legal_links' and policyname = 'connector_legal_links_insert_own'
);

-- 7) RPC function existence + grants
select
    'connector_claim_next_job_exists' as item,
    to_regprocedure('public.connector_claim_next_job(text)') is not null as exists
union all
select
    'connector_commit_legal_links_success_exists',
    to_regprocedure('public.connector_commit_legal_links_success(uuid,uuid,text,text,text,text,text,text,text,text,text,text,jsonb,text,boolean,timestamptz)') is not null
union all
select
    'connector_claim_next_job_service_role_execute',
    has_function_privilege('service_role', 'public.connector_claim_next_job(text)', 'EXECUTE')
union all
select
    'connector_commit_legal_links_success_service_role_execute',
    has_function_privilege(
        'service_role',
        'public.connector_commit_legal_links_success(uuid,uuid,text,text,text,text,text,text,text,text,text,text,jsonb,text,boolean,timestamptz)',
        'EXECUTE'
    );

-- 8) Storage buckets existence (requires access to storage schema)
select id, name, public
from storage.buckets
where id in ('brand-references', 'app-screenshots', 'generated-assets');

-- 9) Connector handshake additions
select 'connector_app_configs.base_branch' as item, exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'connector_app_configs' and column_name = 'base_branch'
) as exists
union all
select 'connector_jobs.result_commit_sha', exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'connector_jobs' and column_name = 'result_commit_sha'
)
union all
select 'connector_job_artifacts table', to_regclass('public.connector_job_artifacts') is not null
union all
select 'connector_job_artifacts_job_created_idx', to_regclass('public.connector_job_artifacts_job_created_idx') is not null
union all
select 'connector_job_artifacts_app_created_idx', to_regclass('public.connector_job_artifacts_app_created_idx') is not null
union all
select 'connector_job_artifacts_kind_created_idx', to_regclass('public.connector_job_artifacts_kind_created_idx') is not null
union all
select 'connector_job_artifacts rls', exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'connector_job_artifacts' and c.relrowsecurity
)
union all
select 'connector_job_artifacts_select_own', exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'connector_job_artifacts' and policyname = 'connector_job_artifacts_select_own'
);
