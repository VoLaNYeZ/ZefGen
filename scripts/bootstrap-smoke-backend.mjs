#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const rootDir = process.cwd();
const smokeTmpDir = path.join(rootDir, 'playwright', '.tmp');
const smokeEnvPath = path.join(smokeTmpDir, 'smoke-env.json');

const smokeConfig = {
    credentials: {
        email: 'smoke-user@zefgen.test',
        password: 'SmokeLocalPass123!',
    },
    brand: {
        name: 'Smoke Brand',
        slug: 'smoke-brand',
    },
    noBrand: {
        name: 'No Brand',
        slug: 'no-brand',
    },
    primaryApp: {
        name: 'Smoke Notes',
        alias: 'smoke-notes',
        appstoreUrl: 'https://apps.apple.com/us/app/id1234567890',
    },
    accountsTargetApp: {
        name: 'Paste Target',
        alias: 'paste-target',
    },
    noBrandCompletedApp: {
        name: 'No Brand Draft',
        alias: 'no-brand-draft',
    },
    primaryIdea: {
        title: 'Smoke Notes: Expense Lens',
        description:
            'A calm iPhone expense journal that turns screenshots, receipts, and handwritten totals into one shared spending view. The app helps a tiny team tag purchases, track reimbursement status, and ship clean weekly summaries without spreadsheets.',
    },
    primaryAccount: {
        email: 'owner@smoke-notes.test',
        password: 'owner-pass-001',
        emailPassword: 'owner-mail-pass-001',
        number: '+15550001001',
        geo: 'US',
        companyName: 'Smoke Ledger LLC',
        proxy: 'http://127.0.0.1:9001',
        notes: 'Seeded primary account for smoke tests.',
    },
};

const supabaseStartExcludes = [
    'studio',
    'mailpit',
    'imgproxy',
    'edge-runtime',
    'logflare',
    'vector',
    'postgres-meta',
    'storage-api',
];

const run = (command, args, options = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: rootDir,
            env: { ...process.env, ...(options.env || {}) },
            stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        });

        let stdout = '';
        let stderr = '';
        if (options.capture) {
            child.stdout?.on('data', (chunk) => {
                stdout += String(chunk);
            });
            child.stderr?.on('data', (chunk) => {
                stderr += String(chunk);
            });
        }

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }

            const detail = options.capture ? `\n${stdout}${stderr}` : '';
            reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}.${detail}`));
        });
    });

const parseEnvOutput = (raw) => {
    const env = {};
    for (const line of String(raw || '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
        if (!match) continue;
        let value = match[2].trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        env[match[1]] = value;
    }
    return env;
};

const readSupabaseEnv = async () => {
    const { stdout } = await run('supabase', ['status', '-o', 'env'], { capture: true });
    const env = parseEnvOutput(stdout);
    const apiUrl = env.API_URL || env.SUPABASE_URL;
    const anonKey = env.ANON_KEY || env.SUPABASE_ANON_KEY;
    const serviceRoleKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    const dbUrl = env.DB_URL;

    if (!apiUrl || !anonKey || !serviceRoleKey || !dbUrl) {
        throw new Error('Could not read local Supabase API_URL, ANON_KEY, SERVICE_ROLE_KEY, and DB_URL from `supabase status -o env`.');
    }

    return { apiUrl, anonKey, serviceRoleKey, dbUrl };
};

const ensureStarted = async () => {
    try {
        await readSupabaseEnv();
    } catch {
        console.log('Starting local Supabase...');
        await run('supabase', ['start', '--yes', '--exclude', supabaseStartExcludes.join(',')]);
    }
};

const requireData = (label, value) => {
    if (!value) {
        throw new Error(`Missing required smoke seed value: ${label}.`);
    }
    return value;
};

const expectNoError = (error, label) => {
    if (error) {
        throw new Error(`${label}: ${error.message || String(error)}`);
    }
};

const hasTable = async (admin, tableName) => {
    const { error } = await admin.from(tableName).select('id').limit(1);
    if (!error) return true;
    if (String(error.message || '').includes(`Could not find the table 'public.${tableName}'`)) return false;
    throw new Error(`Could not verify table ${tableName}: ${error.message || String(error)}`);
};

const ensureSchemaReady = async (admin) => {
    if (await hasTable(admin, 'app_idea_categories')) return;
    throw new Error(
        'Local schema is missing public.app_idea_categories after `supabase db reset`. Verify the Supabase migrations apply cleanly and that their filenames match the CLI pattern.'
    );
};

const ensureFreshSmokeUser = async (admin) => {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    expectNoError(error, 'Could not list auth users');

    const existing = data?.users?.find((user) => String(user.email || '').toLowerCase() === smokeConfig.credentials.email.toLowerCase());
    if (existing?.id) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
        expectNoError(deleteError, 'Could not delete existing smoke auth user');
    }

    const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: smokeConfig.credentials.email,
        password: smokeConfig.credentials.password,
        email_confirm: true,
        user_metadata: { source: 'smoke-test' },
    });
    expectNoError(createError, 'Could not create smoke auth user');

    const userId = requireData('smoke user id', createData?.user?.id);
    return userId;
};

const seedWorkspace = async (admin, userId) => {
    const { data: category, error: categoryError } = await admin
        .from('app_idea_categories')
        .select('id, slug, name')
        .eq('slug', 'business')
        .single();
    expectNoError(categoryError, 'Could not load business idea category');

    const { data: brand, error: brandError } = await admin
        .from('brands')
        .insert({
            user_id: userId,
            name: smokeConfig.brand.name,
            slug: smokeConfig.brand.slug,
            order_index: 0,
            target_countries: ['US', 'CA'],
            keywords: 'finance, expense',
            release_strategy_notes: 'Smoke seed brand for Playwright coverage.',
        })
        .select('id, name, slug, target_countries')
        .single();
    expectNoError(brandError, 'Could not insert smoke brand');

    const { data: noBrand, error: noBrandError } = await admin
        .from('brands')
        .insert({
            user_id: userId,
            name: smokeConfig.noBrand.name,
            slug: smokeConfig.noBrand.slug,
            is_no_brand: true,
            order_index: 1,
        })
        .select('id, name, slug')
        .single();
    expectNoError(noBrandError, 'Could not insert No Brand row');

    const { data: primaryApp, error: primaryAppError } = await admin
        .from('apps')
        .insert({
            user_id: userId,
            brand_id: requireData('brand id', brand?.id),
            name: smokeConfig.primaryApp.name,
            alias: smokeConfig.primaryApp.alias,
            appstore_url: smokeConfig.primaryApp.appstoreUrl,
            order_index: 0,
        })
        .select('id, name, alias, brand_id, appstore_url')
        .single();
    expectNoError(primaryAppError, 'Could not insert primary smoke app');

    const { data: accountsTargetApp, error: accountsTargetAppError } = await admin
        .from('apps')
        .insert({
            user_id: userId,
            brand_id: requireData('brand id', brand?.id),
            name: smokeConfig.accountsTargetApp.name,
            alias: smokeConfig.accountsTargetApp.alias,
            order_index: 1,
        })
        .select('id, name, alias, brand_id')
        .single();
    expectNoError(accountsTargetAppError, 'Could not insert accounts target app');

    const { data: noBrandCompletedApp, error: noBrandCompletedAppError } = await admin
        .from('apps')
        .insert({
            user_id: userId,
            brand_id: requireData('no brand id', noBrand?.id),
            name: smokeConfig.noBrandCompletedApp.name,
            alias: smokeConfig.noBrandCompletedApp.alias,
            icon_prompt: 'Black-and-white note icon with a single folded corner.',
            order_index: 0,
        })
        .select('id, name, alias, brand_id')
        .single();
    expectNoError(noBrandCompletedAppError, 'Could not insert completed No Brand app');

    const { data: primaryIdea, error: primaryIdeaError } = await admin
        .from('app_ideas')
        .insert({
            user_id: userId,
            category_id: requireData('business category id', category?.id),
            title: smokeConfig.primaryIdea.title,
            description: smokeConfig.primaryIdea.description,
        })
        .select('id, title, description, category_id')
        .single();
    expectNoError(primaryIdeaError, 'Could not insert primary smoke idea');

    const { error: primaryAccountError } = await admin.from('appstore_accounts').insert({
        user_id: userId,
        app_id: requireData('primary app id', primaryApp?.id),
        usability: true,
        was_used_before: false,
        email: smokeConfig.primaryAccount.email,
        password: smokeConfig.primaryAccount.password,
        email_password: smokeConfig.primaryAccount.emailPassword,
        number: smokeConfig.primaryAccount.number,
        geo: smokeConfig.primaryAccount.geo,
        company_name: smokeConfig.primaryAccount.companyName,
        proxy: smokeConfig.primaryAccount.proxy,
        notes: smokeConfig.primaryAccount.notes,
    });
    expectNoError(primaryAccountError, 'Could not insert primary smoke account');

    const connectorRows = [
        {
            app_id: requireData('primary app id', primaryApp?.id),
            user_id: userId,
            project_kind: 'ios',
            project_brief: smokeConfig.primaryIdea.description,
            idea_id: requireData('primary idea id', primaryIdea?.id),
            base_branch: 'main',
            variables: {
                appstore_name: smokeConfig.primaryIdea.title,
                home_screen_name: 'Smoke Notes',
                bundle_id: 'com.zefgen.smokenotes',
                domain: 'https://smoke-notes.test',
                appstore_description:
                    'Track expenses, reimbursements, and receipts in one shared iPhone workspace built for tiny operations teams.',
            },
        },
        {
            app_id: requireData('accounts target app id', accountsTargetApp?.id),
            user_id: userId,
            project_kind: 'ios',
            project_brief: '',
            idea_id: null,
            base_branch: 'main',
            variables: {
                appstore_name: smokeConfig.accountsTargetApp.name,
                home_screen_name: 'Paste Target',
                bundle_id: 'com.zefgen.pastetarget',
            },
        },
        {
            app_id: requireData('no brand app id', noBrandCompletedApp?.id),
            user_id: userId,
            project_kind: 'ios',
            project_brief: 'A fast scratchpad for turning unowned concepts into testable app shells.',
            idea_id: null,
            base_branch: 'main',
            variables: {
                appstore_name: smokeConfig.noBrandCompletedApp.name,
                home_screen_name: 'No Brand Draft',
                bundle_id: 'com.zefgen.nobranddraft',
            },
        },
    ];
    const { error: connectorError } = await admin.from('connector_app_configs').insert(connectorRows);
    expectNoError(connectorError, 'Could not insert connector app configs');

    const screenshotSets = [
        {
            user_id: userId,
            brand_id: requireData('brand id', brand?.id),
            app_id: requireData('primary app id', primaryApp?.id),
            name: 'Original',
            size_label: '6.5',
            slot_count: 3,
            order_index: 0,
        },
        {
            user_id: userId,
            brand_id: requireData('brand id', brand?.id),
            app_id: requireData('accounts target app id', accountsTargetApp?.id),
            name: 'Original',
            size_label: '6.5',
            slot_count: 3,
            order_index: 0,
        },
        {
            user_id: userId,
            brand_id: requireData('no brand id', noBrand?.id),
            app_id: requireData('no brand app id', noBrandCompletedApp?.id),
            name: 'Original',
            size_label: '6.5',
            slot_count: 3,
            order_index: 0,
        },
    ];
    const { error: screenshotSetError } = await admin.from('app_screenshot_sets').insert(screenshotSets);
    expectNoError(screenshotSetError, 'Could not insert smoke screenshot sets');

    const { error: noBrandExportStatusError } = await admin.from('app_export_status').insert({
        app_id: requireData('no brand app id', noBrandCompletedApp?.id),
        user_id: userId,
        brand_id: requireData('no brand id', noBrand?.id),
        is_completed: true,
        completed_at: new Date().toISOString(),
    });
    expectNoError(noBrandExportStatusError, 'Could not insert completed export status for No Brand app');

    return {
        brand,
        noBrand,
        primaryApp,
        accountsTargetApp,
        noBrandCompletedApp,
        primaryIdea,
        category,
    };
};

const main = async () => {
    await fs.mkdir(smokeTmpDir, { recursive: true });

    await ensureStarted();
    console.log('Resetting local Supabase database...');
    await run('supabase', ['db', 'reset', '--local', '--yes', '--no-seed']);

    const { apiUrl, anonKey, serviceRoleKey } = await readSupabaseEnv();
    const admin = createClient(apiUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    await ensureSchemaReady(admin);

    const userId = await ensureFreshSmokeUser(admin);
    const seeded = await seedWorkspace(admin, userId);

    const payload = {
        generatedAt: new Date().toISOString(),
        supabase: {
            url: apiUrl,
            anonKey,
            serviceRoleKey,
        },
        credentials: smokeConfig.credentials,
        seed: {
            brand: seeded.brand,
            noBrand: seeded.noBrand,
            primaryApp: seeded.primaryApp,
            accountsTargetApp: seeded.accountsTargetApp,
            noBrandCompletedApp: seeded.noBrandCompletedApp,
            primaryIdea: seeded.primaryIdea,
            category: seeded.category,
            routes: {
                workspace: `/${seeded.brand.slug}/${seeded.primaryApp.alias}`,
                accountsTargetWorkspace: `/${seeded.brand.slug}/${seeded.accountsTargetApp.alias}`,
                noBrandCollapsedWorkspace: `/${seeded.noBrand.slug}/${seeded.noBrandCompletedApp.alias}`,
                accounts: '/accounts',
                ideas: '/ideas',
            },
        },
    };

    await fs.writeFile(smokeEnvPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Smoke backend ready: ${payload.seed.routes.workspace}`);
    console.log(`Wrote ${path.relative(rootDir, smokeEnvPath)}`);
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
