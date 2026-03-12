#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

const checks = [
    {
        name: 'data-layer exports latest succeeded run lookup',
        file: 'data/connector-legal-links.ts',
        includes: 'export const fetchLatestSucceededLegalLinksRun',
    },
    {
        name: 'data-layer exports local fingerprint helper',
        file: 'data/connector-legal-links.ts',
        includes: 'export const computeLegalLinksFingerprint',
    },
    {
        name: 'hook exposes legal-links precheck',
        file: 'hooks/use-connector-config-form.ts',
        includes: 'const precheckLegalLinksRegeneration = React.useCallback',
    },
    {
        name: 'hook tracks pending confirm job for legal-links queue',
        file: 'hooks/use-connector-config-form.ts',
        includes: 'const pendingLegalLinksConfirmRef = React.useRef',
    },
    {
        name: 'hook exposes pending legal-links cancellation',
        file: 'hooks/use-connector-config-form.ts',
        includes: 'const cancelPendingLegalLinksGeneration = React.useCallback',
    },
    {
        name: 'panel runs precheck before generation',
        file: 'components/app/ConnectorVariablesSecretsPanel.tsx',
        includes: 'const precheck = await connectorForm.precheckLegalLinksRegeneration',
    },
    {
        name: 'panel confirms before regenerate call',
        file: 'components/app/ConnectorVariablesSecretsPanel.tsx',
        includes: 'const shouldRegenerate = precheck.requiresConfirm',
    },
    {
        name: 'panel cancels pending queue job on fallback confirm cancel',
        file: 'components/app/ConnectorVariablesSecretsPanel.tsx',
        includes: 'connectorForm.cancelPendingLegalLinksGeneration',
    },
    {
        name: 'hook passes access-token hint for legal-links invoke',
        file: 'hooks/use-connector-config-form.ts',
        includes: 'accessTokenHint: String(session.access_token || \'\')',
    },
    {
        name: 'data-layer consumes access-token hint in token resolver',
        file: 'data/connector-legal-links.ts',
        includes: 'let token = await getCurrentAccessToken(payload.accessTokenHint);',
    },
    {
        name: 'edge function records created file ids for cleanup',
        file: 'supabase/functions/generate-legal-links/index.ts',
        includes: 'const createdFileIds: string[] = [];',
    },
    {
        name: 'edge function best-effort trashes created files on failure',
        file: 'supabase/functions/generate-legal-links/index.ts',
        includes: 'await trashGoogleFile({',
    },
    {
        name: 'step 3 completion supports account company_name fallback',
        file: 'hooks/use-workspace-step-readiness.ts',
        includes: 'selectedAppstoreAccount?.company_name',
    },
];

const failures = [];

for (const check of checks) {
    let content = '';
    try {
        content = read(check.file);
    } catch (error) {
        failures.push(`${check.name}: failed to read ${check.file} (${String(error)})`);
        continue;
    }
    if (!content.includes(check.includes)) {
        failures.push(`${check.name}: missing "${check.includes}" in ${check.file}`);
    }
}

if (failures.length > 0) {
    console.error('\nLegal-links smoke checks failed:\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    console.error('');
    process.exit(1);
}

console.log('Legal-links smoke checks passed.');
