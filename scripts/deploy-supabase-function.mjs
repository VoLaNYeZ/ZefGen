#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const functionName = String(process.argv[2] || '').trim();
const projectRef = String(process.env.SUPABASE_PROJECT_REF || '').trim();

if (!functionName) {
    console.error('Usage: node scripts/deploy-supabase-function.mjs <function-name>');
    process.exit(1);
}

if (!projectRef) {
    console.error('Missing SUPABASE_PROJECT_REF. Set it in your local shell or deployment environment.');
    process.exit(1);
}

const result = spawnSync(
    'supabase',
    ['functions', 'deploy', functionName, '--project-ref', projectRef, '--use-api', '--no-verify-jwt'],
    {
        stdio: 'inherit',
    }
);

process.exit(Number(result.status ?? 1));
