import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/github-main-head.ts';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

const createRes = () => ({
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
        this.headers[name] = value;
    },
    end(payload) {
        this.body = String(payload || '');
    },
});

const parseBody = (res) => JSON.parse(res.body || '{}');

test.afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
});

test('github-main-head rejects unauthorized requests', async () => {
    const res = createRes();
    await handler({ method: 'POST', headers: {}, body: { appId: 'app-1' } }, res);

    assert.equal(res.statusCode, 401);
    assert.equal(parseBody(res).message, 'Missing Authorization: Bearer token');
});

test('github-main-head rejects apps without a stored repo', async () => {
    process.env.VITE_SUPABASE_URL = 'https://supabase.example';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    process.env.GITHUB_TOKEN = 'gh-token';

    global.fetch = async (url) => {
        if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
        }
        if (String(url).includes('/rest/v1/apps')) {
            return new Response(
                JSON.stringify([{ id: 'app-1', user_id: 'user-1', github_repo_full_name: null, github_repo_url: null }]),
                { status: 200 }
            );
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`);
    };

    const res = createRes();
    await handler(
        {
            method: 'POST',
            headers: { authorization: 'Bearer test-token' },
            body: { appId: 'app-1' },
        },
        res
    );

    assert.equal(res.statusCode, 404);
    assert.equal(parseBody(res).message, 'No GitHub repo stored for this app.');
});

test('github-main-head returns the current main SHA for an owned app', async () => {
    process.env.VITE_SUPABASE_URL = 'https://supabase.example';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    process.env.GITHUB_TOKEN = 'gh-token';

    global.fetch = async (url) => {
        if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
        }
        if (String(url).includes('/rest/v1/apps')) {
            return new Response(
                JSON.stringify([
                    {
                        id: 'app-1',
                        user_id: 'user-1',
                        github_repo_full_name: 'example/repo',
                        github_repo_url: 'https://github.com/example/repo',
                    },
                ]),
                { status: 200 }
            );
        }
        if (String(url).includes('https://api.github.com/repos/example/repo/branches/main')) {
            return new Response(JSON.stringify({ commit: { sha: 'f380d2f8b030aafd09c633de998a5cbfc87738d3' } }), {
                status: 200,
            });
        }
        throw new Error(`Unexpected fetch URL: ${String(url)}`);
    };

    const res = createRes();
    await handler(
        {
            method: 'POST',
            headers: { authorization: 'Bearer test-token' },
            body: { appId: 'app-1' },
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(parseBody(res), {
        ok: true,
        branch: 'main',
        repoFullName: 'example/repo',
        sha: 'f380d2f8b030aafd09c633de998a5cbfc87738d3',
    });
});
