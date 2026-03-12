import fs from 'node:fs';
import path from 'node:path';

export const BASE_URL = 'http://127.0.0.1:4173';
export const AUTH_FILE = path.join(process.cwd(), 'playwright', '.auth', 'smoke-user.json');
export const SMOKE_ENV_FILE = path.join(process.cwd(), 'playwright', '.tmp', 'smoke-env.json');

export type SmokeEnv = {
    generatedAt: string;
    supabase: {
        url: string;
        anonKey: string;
        serviceRoleKey: string;
    };
    credentials: {
        email: string;
        password: string;
    };
    seed: {
        brand: {
            id: string;
            name: string;
            slug: string;
            target_countries?: string[];
        };
        noBrand: {
            id: string;
            name: string;
            slug: string;
        };
        primaryApp: {
            id: string;
            name: string;
            alias: string;
            brand_id: string;
            appstore_url?: string | null;
        };
        accountsTargetApp: {
            id: string;
            name: string;
            alias: string;
            brand_id: string;
        };
        noBrandCompletedApp: {
            id: string;
            name: string;
            alias: string;
            brand_id: string;
        };
        primaryIdea: {
            id: string;
            title: string;
            description: string;
            category_id: string;
        };
        category: {
            id: string;
            slug: string;
            name: string;
        };
        routes: {
            workspace: string;
            accountsTargetWorkspace: string;
            noBrandCollapsedWorkspace: string;
            accounts: string;
            ideas: string;
        };
    };
};

let cachedSmokeEnv: SmokeEnv | null = null;

export const loadSmokeEnv = (): SmokeEnv => {
    if (cachedSmokeEnv) return cachedSmokeEnv;
    if (!fs.existsSync(SMOKE_ENV_FILE)) {
        throw new Error(`Missing ${path.relative(process.cwd(), SMOKE_ENV_FILE)}. Run \`npm run smoke:backend\` first.`);
    }
    cachedSmokeEnv = JSON.parse(fs.readFileSync(SMOKE_ENV_FILE, 'utf8')) as SmokeEnv;
    return cachedSmokeEnv;
};
