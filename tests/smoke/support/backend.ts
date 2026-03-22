import { createClient } from '@supabase/supabase-js';
import { loadSmokeEnv } from './smoke-env';

const smokeEnv = loadSmokeEnv();

export const smokeAdmin = createClient(smokeEnv.supabase.url, smokeEnv.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

export const requireSmokeData = <T,>(label: string, value: T | null | undefined): T => {
    if (!value) {
        throw new Error(`Missing required smoke value: ${label}`);
    }
    return value;
};

export const assertSmokeNoError = (error: { message?: string } | null, label: string) => {
    if (error) {
        throw new Error(`${label}: ${error.message || String(error)}`);
    }
};

const expectedSeed = {
    brandCount: 2,
    appCount: 3,
    appstoreAccountCount: 1,
};

let cachedSmokeUserId: string | null = null;
let smokeBackendSanityPromise: Promise<void> | null = null;

const formatSeedMismatch = (mismatches: string[]) =>
    `Smoke backend is dirty; rerun \`npm run smoke:backend\`.\n${mismatches.map((entry) => `- ${entry}`).join('\n')}`;

const countOrZero = (value: number | null) => Number(value || 0);

export const loadSmokeUserId = async () => {
    if (cachedSmokeUserId) return cachedSmokeUserId;

    const { data, error } = await smokeAdmin.from('brands').select('user_id').eq('id', smokeEnv.seed.brand.id).maybeSingle();
    assertSmokeNoError(error, 'Could not load smoke user id from seeded brand');

    if (!data?.user_id) {
        throw new Error(formatSeedMismatch([`seeded brand ${smokeEnv.seed.brand.slug} is missing`]));
    }

    cachedSmokeUserId = data.user_id;
    return cachedSmokeUserId;
};

export const ensureSmokeBackendSanity = async () => {
    if (smokeBackendSanityPromise) return smokeBackendSanityPromise;

    smokeBackendSanityPromise = (async () => {
        const { seed } = smokeEnv;
        const smokeUserId = await loadSmokeUserId();

        const [
            brandResult,
            noBrandResult,
            primaryAppResult,
            accountsTargetAppResult,
            noBrandAppResult,
            brandCountResult,
            appCountResult,
            accountsTargetCountResult,
            userAccountCountResult,
        ] = await Promise.all([
            smokeAdmin.from('brands').select('id, slug, is_no_brand').eq('id', seed.brand.id).maybeSingle(),
            smokeAdmin.from('brands').select('id, slug, is_no_brand').eq('id', seed.noBrand.id).maybeSingle(),
            smokeAdmin.from('apps').select('id, brand_id, alias').eq('id', seed.primaryApp.id).maybeSingle(),
            smokeAdmin.from('apps').select('id, brand_id, alias').eq('id', seed.accountsTargetApp.id).maybeSingle(),
            smokeAdmin.from('apps').select('id, brand_id, alias').eq('id', seed.noBrandCompletedApp.id).maybeSingle(),
            smokeAdmin.from('brands').select('id', { count: 'exact', head: true }).eq('user_id', smokeUserId),
            smokeAdmin.from('apps').select('id', { count: 'exact', head: true }).eq('user_id', smokeUserId),
            smokeAdmin
                .from('appstore_accounts')
                .select('id', { count: 'exact', head: true })
                .eq('app_id', seed.accountsTargetApp.id),
            smokeAdmin.from('appstore_accounts').select('id', { count: 'exact', head: true }).eq('user_id', smokeUserId),
        ]);

        assertSmokeNoError(brandResult.error, 'Could not verify seeded Smoke Brand');
        assertSmokeNoError(noBrandResult.error, 'Could not verify seeded No Brand');
        assertSmokeNoError(primaryAppResult.error, 'Could not verify seeded primary app');
        assertSmokeNoError(accountsTargetAppResult.error, 'Could not verify seeded accounts target app');
        assertSmokeNoError(noBrandAppResult.error, 'Could not verify seeded No Brand app');
        assertSmokeNoError(brandCountResult.error, 'Could not count smoke brands');
        assertSmokeNoError(appCountResult.error, 'Could not count smoke apps');
        assertSmokeNoError(accountsTargetCountResult.error, 'Could not count accounts for the accounts target app');
        assertSmokeNoError(userAccountCountResult.error, 'Could not count smoke appstore accounts');

        const mismatches: string[] = [];

        if (!brandResult.data || brandResult.data.slug !== seed.brand.slug || Boolean(brandResult.data.is_no_brand)) {
            mismatches.push(`seeded brand ${seed.brand.slug} is missing or no longer a regular brand`);
        }

        if (!noBrandResult.data || noBrandResult.data.slug !== seed.noBrand.slug || !Boolean(noBrandResult.data.is_no_brand)) {
            mismatches.push(`seeded no-brand row ${seed.noBrand.slug} is missing or no longer marked as No Brand`);
        }

        if (
            !primaryAppResult.data ||
            primaryAppResult.data.brand_id !== seed.brand.id ||
            primaryAppResult.data.alias !== seed.primaryApp.alias
        ) {
            mismatches.push(`seeded app ${seed.primaryApp.alias} no longer belongs to ${seed.brand.slug}`);
        }

        if (
            !accountsTargetAppResult.data ||
            accountsTargetAppResult.data.brand_id !== seed.brand.id ||
            accountsTargetAppResult.data.alias !== seed.accountsTargetApp.alias
        ) {
            mismatches.push(`seeded app ${seed.accountsTargetApp.alias} no longer belongs to ${seed.brand.slug}`);
        }

        if (
            !noBrandAppResult.data ||
            noBrandAppResult.data.brand_id !== seed.noBrand.id ||
            noBrandAppResult.data.alias !== seed.noBrandCompletedApp.alias
        ) {
            mismatches.push(`seeded app ${seed.noBrandCompletedApp.alias} no longer belongs to ${seed.noBrand.slug}`);
        }

        const brandCount = countOrZero(brandCountResult.count);
        if (brandCount !== expectedSeed.brandCount) {
            mismatches.push(`expected ${expectedSeed.brandCount} brands for the smoke user, found ${brandCount}`);
        }

        const appCount = countOrZero(appCountResult.count);
        if (appCount !== expectedSeed.appCount) {
            mismatches.push(`expected ${expectedSeed.appCount} apps for the smoke user, found ${appCount}`);
        }

        const accountsTargetCount = countOrZero(accountsTargetCountResult.count);
        if (accountsTargetCount !== 0) {
            mismatches.push(
                `expected 0 App Store accounts on ${seed.accountsTargetApp.alias}, found ${accountsTargetCount}`
            );
        }

        const appstoreAccountCount = countOrZero(userAccountCountResult.count);
        if (appstoreAccountCount !== expectedSeed.appstoreAccountCount) {
            mismatches.push(
                `expected ${expectedSeed.appstoreAccountCount} App Store account total for the smoke user, found ${appstoreAccountCount}`
            );
        }

        if (mismatches.length) {
            throw new Error(formatSeedMismatch(mismatches));
        }
    })().catch((error) => {
        smokeBackendSanityPromise = null;
        throw error;
    });

    return smokeBackendSanityPromise;
};

export const deleteBrandCascade = async (brandId: string) => {
    const { error } = await smokeAdmin.from('brands').delete().eq('id', brandId);
    assertSmokeNoError(error, `Could not delete smoke cleanup brand ${brandId}`);
};

export const clearAppStoreAccountsForApp = async (appId: string) => {
    const { error } = await smokeAdmin.from('appstore_accounts').delete().eq('app_id', appId);
    assertSmokeNoError(error, `Could not clear smoke appstore accounts for app ${appId}`);
};

export const restoreSeededNoBrandApp = async () => {
    const appId = smokeEnv.seed.noBrandCompletedApp.id;
    const brandId = smokeEnv.seed.noBrand.id;
    const alias = smokeEnv.seed.noBrandCompletedApp.alias;

    const tableUpdates = await Promise.all([
        smokeAdmin.from('apps').update({ brand_id: brandId, alias, order_index: 0 }).eq('id', appId),
        smokeAdmin.from('app_screenshots').update({ brand_id: brandId }).eq('app_id', appId),
        smokeAdmin.from('app_screenshot_sets').update({ brand_id: brandId }).eq('app_id', appId),
        smokeAdmin.from('app_generated_assets').update({ brand_id: brandId }).eq('app_id', appId),
        smokeAdmin.from('app_asset_picks').update({ brand_id: brandId }).eq('app_id', appId),
        smokeAdmin.from('app_export_status').update({ brand_id: brandId }).eq('app_id', appId),
        smokeAdmin.from('app_screenshot_prompts').update({ brand_id: brandId }).eq('app_id', appId),
    ]);

    const labels = [
        'Could not restore seeded No Brand app row',
        'Could not restore seeded No Brand screenshots',
        'Could not restore seeded No Brand screenshot sets',
        'Could not restore seeded No Brand generated assets',
        'Could not restore seeded No Brand asset picks',
        'Could not restore seeded No Brand export status',
        'Could not restore seeded No Brand screenshot prompts',
    ];

    tableUpdates.forEach((result, index) => {
        assertSmokeNoError(result.error, labels[index]);
    });
};
