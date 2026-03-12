#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
const filenamePattern = /^\d{14}_[a-z0-9_]+\.sql$/i;

const entries = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isFile())
    : [];

const invalid = entries
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => !filenamePattern.test(name))
    .sort((left, right) => left.localeCompare(right));

if (invalid.length) {
    console.error('Supabase migration filename check failed.\n');
    for (const name of invalid) {
        console.error(`supabase/migrations/${name}`);
    }
    console.error('\nExpected pattern: YYYYMMDDHHMMSS_name.sql');
    process.exit(1);
}

console.log(`Supabase migration filename check passed for ${entries.length} files.`);
