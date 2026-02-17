#!/usr/bin/env node
import { execSync } from 'node:child_process';

const canRunGit = () => {
    try {
        execSync('git --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
};

const isInsideGitRepo = () => {
    try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
};

if (!canRunGit()) {
    console.log('Skipping git hooks install: git is not available.');
    process.exit(0);
}

if (!isInsideGitRepo()) {
    console.log('Skipping git hooks install: current directory is not a git repository.');
    process.exit(0);
}

try {
    execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
    console.log('Git hooks path set to .githooks');
} catch (error) {
    console.log(`Skipping git hooks install: failed to configure hooks path (${String(error)}).`);
    process.exit(0);
}
