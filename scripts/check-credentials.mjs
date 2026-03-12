#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const stagedOnly = args.has('--staged');

const run = (cmd) =>
    execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

const listCandidateFiles = () => {
    const cmd = stagedOnly
        ? 'git diff --cached --name-only --diff-filter=ACMRTUXB'
        : 'git ls-files --cached --others --exclude-standard';
    const out = run(cmd);
    return out
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
};

const normalizeRelPath = (filePath) => filePath.replace(/\\/g, '/');

const skipByPrefix = (relPath) => {
    const prefixes = [
        '.git/',
        '.secrets/',
        'node_modules/',
        'node_modules.bak',
        'dist/',
        'dist-ssr/',
        '.vercel/',
        '.cache/',
        '.turbo/',
        'coverage/',
        'playwright-report/',
        'test-results/',
        'playwright/.auth/',
        'playwright/.tmp/',
    ];
    return prefixes.some((prefix) => relPath.startsWith(prefix));
};

const suspiciousJsonName = /(service[-_. ]?account|credential|gcp|google.*(key|cred))/i;
const alwaysBlockedExt = new Set(['.p12', '.pem', '.key']);
const inspectTextExt = new Set(['.json', '.env', '.local', '.txt', '.yaml', '.yml', '.toml']);

const isServiceAccountJsonShape = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    const hasType = String(obj.type || '').toLowerCase() === 'service_account';
    const hasPrivateKey = typeof obj.private_key === 'string' && obj.private_key.includes('BEGIN PRIVATE KEY');
    const hasClientEmail = typeof obj.client_email === 'string' && obj.client_email.includes('@');
    const hasPrivateKeyId = typeof obj.private_key_id === 'string' && obj.private_key_id.length > 0;
    return (hasPrivateKey && hasClientEmail && hasPrivateKeyId) || (hasType && hasPrivateKey && hasClientEmail);
};

const findings = [];

for (const raw of listCandidateFiles()) {
    const relPath = normalizeRelPath(raw);
    if (skipByPrefix(relPath)) continue;

    const absPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(absPath)) continue;
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) continue;

    const ext = path.extname(relPath).toLowerCase();
    const base = path.basename(relPath);
    const reasons = [];

    if (alwaysBlockedExt.has(ext)) {
        reasons.push(`Blocked key/cert extension detected (${ext}).`);
    }

    if (ext === '.json' && suspiciousJsonName.test(base)) {
        reasons.push('Suspicious credential-like JSON filename.');
    }

    const shouldInspectText = inspectTextExt.has(ext) || ext === '.json';
    if (shouldInspectText) {
        const content = fs.readFileSync(absPath, 'utf8');

        if (/-----BEGIN PRIVATE KEY-----/.test(content)) {
            reasons.push('Contains private key material.');
        }

        if (ext === '.json') {
            try {
                const parsed = JSON.parse(content);
                if (isServiceAccountJsonShape(parsed)) {
                    reasons.push('Matches Google service-account JSON structure.');
                }
            } catch {
                // Ignore invalid JSON here; filename/content heuristics above still apply.
            }
        }
    }

    if (reasons.length > 0) {
        findings.push({ relPath, reasons });
    }
}

if (findings.length > 0) {
    console.error('\nCredential guard failed. Potential secrets detected:\n');
    for (const finding of findings) {
        console.error(`- ${finding.relPath}`);
        for (const reason of finding.reasons) {
            console.error(`  - ${reason}`);
        }
    }
    console.error('\nMove secrets outside the repo (or into .secrets/) and retry.\n');
    process.exit(1);
}

console.log(`Credential guard passed (${stagedOnly ? 'staged files' : 'repo files'}).`);
