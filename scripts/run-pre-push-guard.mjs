#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const ZERO_SHA = '0000000000000000000000000000000000000000';
const SKIP_FLAG = process.env.SKIP_SMOKE_PREPUSH === '1';

const RELEVANT_PREFIXES = [
    'components/',
    'hooks/',
    'data/',
    'utils/',
    'lib/',
    'constants/',
    'types/',
    'tests/smoke/',
    'supabase/',
    'cloudflare/',
];

const RELEVANT_FILES = new Set([
    'i18n.ts',
    'package.json',
    'package-lock.json',
    'playwright.config.ts',
]);

const readStdin = () => {
    try {
        return fs.readFileSync(0, 'utf8');
    } catch {
        return '';
    }
};

const runGit = (args) =>
    execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

const tryRunGit = (args) => {
    try {
        return runGit(args);
    } catch {
        return '';
    }
};

const resolveDefaultRemoteBaseRef = () => {
    const originHead = tryRunGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    if (originHead) return originHead;

    const anyRemoteHead = tryRunGit(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/*/HEAD'])
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean);
    return anyRemoteHead || '';
};

const parseRefUpdates = (raw) =>
    String(raw || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
            return {
                localRef: String(localRef || ''),
                localSha: String(localSha || ''),
                remoteRef: String(remoteRef || ''),
                remoteSha: String(remoteSha || ''),
            };
        });

const readChangedFilesForRange = (baseRef, headRef) => {
    if (!baseRef || !headRef) return [];
    const output = tryRunGit(['diff', '--name-only', baseRef, headRef]);
    if (!output) return [];
    return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
};

const readChangedFilesFromMergeBase = (baseRef, headRef) => {
    if (!baseRef || !headRef) return [];
    const mergeBase = tryRunGit(['merge-base', baseRef, headRef]);
    if (!mergeBase) return [];
    return readChangedFilesForRange(mergeBase, headRef);
};

const isSmokeRelevantPath = (filePath) => {
    if (!filePath) return false;
    if (RELEVANT_FILES.has(filePath)) return true;
    return RELEVANT_PREFIXES.some((prefix) => filePath.startsWith(prefix));
};

const resolveChangedFiles = (refUpdates) => {
    if (refUpdates.length === 0) {
        const upstream = tryRunGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
        if (upstream) {
            return {
                mode: 'diff',
                reason: `Comparing HEAD against ${upstream}.`,
                changedFiles: readChangedFilesForRange(upstream, 'HEAD'),
            };
        }

        const defaultBase = resolveDefaultRemoteBaseRef();
        if (defaultBase) {
            return {
                mode: 'diff',
                reason: `No upstream ref detected; comparing HEAD against merge-base with ${defaultBase}.`,
                changedFiles: readChangedFilesFromMergeBase(defaultBase, 'HEAD'),
            };
        }

        return {
            mode: 'full',
            reason: 'No upstream or default remote base ref detected for this branch.',
            changedFiles: [],
        };
    }

    const changedFiles = new Set();

    for (const update of refUpdates) {
        if (!update.localSha || update.localSha === ZERO_SHA) continue;
        if (!update.remoteSha || update.remoteSha === ZERO_SHA) {
            const defaultBase = resolveDefaultRemoteBaseRef();
            if (!defaultBase) {
                return {
                    mode: 'full',
                    reason: `New remote ref ${update.remoteRef || '(unknown)'} detected with no default remote base ref available.`,
                    changedFiles: [],
                };
            }

            for (const filePath of readChangedFilesFromMergeBase(defaultBase, update.localSha)) {
                changedFiles.add(filePath);
            }
            continue;
        }

        for (const filePath of readChangedFilesForRange(update.remoteSha, update.localSha)) {
            changedFiles.add(filePath);
        }
    }

    return {
        mode: 'diff',
        reason: 'Comparing pushed refs against their remote SHAs.',
        changedFiles: Array.from(changedFiles),
    };
};

const runCommand = (command, args) => {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        shell: false,
    });
    return Number(result.status ?? 1);
};

if (SKIP_FLAG) {
    console.log('Skipping pre-push smoke guard because SKIP_SMOKE_PREPUSH=1.');
    process.exit(0);
}

const refUpdates = parseRefUpdates(readStdin());
const resolved = resolveChangedFiles(refUpdates);
const relevantFiles = resolved.changedFiles.filter(isSmokeRelevantPath);

if (resolved.mode === 'diff' && relevantFiles.length === 0) {
    console.log('Skipping pre-push smoke guard: no smoke-relevant files changed.');
    process.exit(0);
}

console.log('Running pre-push smoke guard...');
console.log(resolved.reason);
if (relevantFiles.length > 0) {
    console.log(`Smoke-relevant changes:\n- ${relevantFiles.join('\n- ')}`);
}
console.log('Use SKIP_SMOKE_PREPUSH=1 git push to bypass once.');

const exitCode = runCommand('npm', ['run', 'smoke']);
process.exit(exitCode);
