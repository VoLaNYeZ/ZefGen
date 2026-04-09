import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/create-github-repo.ts';

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

test('create-github-repo invites every configured default collaborator', async () => {
    process.env.VITE_SUPABASE_URL = 'https://supabase.example';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    process.env.GITHUB_TOKEN = 'gh-token';
    process.env.GITHUB_DEFAULT_COLLABORATORS = 'alice, bob ,carol,dave';

    const collaboratorUrls = [];

    global.fetch = async (url, init = {}) => {
        const value = String(url);
        const method = init.method || 'GET';

        if (value.includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
        }

        if (value.includes('/rest/v1/app_asset_picks')) {
            return new Response(JSON.stringify({ generated_asset_id: 'asset-1' }), { status: 200 });
        }

        if (value.includes('/rest/v1/app_generated_assets')) {
            return new Response(JSON.stringify({ image_path: 'icons/icon.jpg' }), { status: 200 });
        }

        if (value.includes('/storage/v1/object/sign/generated-assets/')) {
            return new Response(JSON.stringify({ signedURL: '/object/sign/generated-assets/icons/icon.jpg?token=test-token' }), {
                status: 200,
            });
        }

        if (value === 'https://supabase.example/storage/v1/object/sign/generated-assets/icons/icon.jpg?token=test-token') {
            return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200 });
        }

        if (value === 'https://api.github.com/user') {
            return new Response(JSON.stringify({ login: 'EF-tester' }), { status: 200 });
        }

        if (value === 'https://api.github.com/user/repos' && method === 'POST') {
            return new Response(
                JSON.stringify({
                    full_name: 'EF-tester/-ef-06-ProblemNoteKeeper-Home',
                    html_url: 'https://github.com/EF-tester/-ef-06-ProblemNoteKeeper-Home',
                }),
                { status: 201 }
            );
        }

        if (value.includes('/collaborators/')) {
            collaboratorUrls.push(value);
            return new Response(JSON.stringify({}), { status: 201 });
        }

        if (value.endsWith('/contents/README.md') && method === 'GET') {
            return new Response(JSON.stringify({ sha: 'readme-sha' }), { status: 200 });
        }

        if (value.endsWith('/contents/assets/app_icon.jpg') && method === 'GET') {
            return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
        }

        if (value.includes('/contents/') && method === 'PUT') {
            return new Response(JSON.stringify({ content: { path: 'ok' } }), { status: 201 });
        }

        throw new Error(`Unexpected fetch URL: ${value} (${method})`);
    };

    const res = createRes();
    await handler(
        {
            method: 'POST',
            headers: { authorization: 'Bearer test-token' },
            body: {
                appId: 'app-1',
                appAlias: 'ef-06',
                appName: 'ProblemNoteKeeper Home',
                brandName: 'Example Brand',
                brandSlug: 'example-brand',
            },
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(collaboratorUrls.length, 4);
    assert.deepEqual(
        collaboratorUrls.map((value) => decodeURIComponent(value.split('/').at(-1))),
        ['alice', 'bob', 'carol', 'dave']
    );
    assert.deepEqual(
        parseBody(res).collaborators,
        [
            { username: 'alice', ok: true, status: 201 },
            { username: 'bob', ok: true, status: 201 },
            { username: 'carol', ok: true, status: 201 },
            { username: 'dave', ok: true, status: 201 },
        ]
    );
});
