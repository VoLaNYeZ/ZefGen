import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveStartupWorkspaceSelection } from '../utils/workspace-selection.ts';

const brands = [
    {
        id: 'brand-active',
        name: 'Active Brand',
        slug: 'active-brand',
        order_index: 0,
        is_inactive: false,
    },
    {
        id: 'brand-inactive',
        name: 'Inactive Brand',
        slug: 'inactive-brand',
        order_index: 1,
        is_inactive: true,
    },
    {
        id: 'brand-no-brand',
        name: 'No Brand',
        slug: 'no-brand',
        order_index: 2,
        is_no_brand: true,
        is_inactive: false,
    },
] as const;

const apps = [
    {
        id: 'app-primary',
        brand_id: 'brand-active',
        name: 'Primary',
        alias: 'primary',
        order_index: 0,
        is_banned: false,
    },
    {
        id: 'app-secondary',
        brand_id: 'brand-active',
        name: 'Secondary',
        alias: 'secondary',
        order_index: 1,
        is_banned: false,
    },
    {
        id: 'app-banned',
        brand_id: 'brand-active',
        name: 'Banned',
        alias: 'banned',
        order_index: 2,
        is_banned: true,
    },
    {
        id: 'app-inactive-brand',
        brand_id: 'brand-inactive',
        name: 'Inactive Brand App',
        alias: 'inactive-brand-app',
        order_index: 0,
        is_banned: false,
    },
    {
        id: 'app-no-brand',
        brand_id: 'brand-no-brand',
        name: 'No Brand App',
        alias: 'no-brand-app',
        order_index: 0,
        is_banned: false,
    },
] as const;

test('startup restores the remembered active workspace on bare routes', () => {
    const selection = resolveStartupWorkspaceSelection({
        brands: [...brands],
        apps: [...apps],
        orderedApps: [...apps],
        lastAppByBrand: {},
        lastWorkspaceSelection: {
            brandId: 'brand-active',
            appId: 'app-secondary',
        },
    });

    assert.deepEqual(selection, {
        brandId: 'brand-active',
        appId: 'app-secondary',
    });
});

test('startup skips inactive remembered brands and falls back to the first active brand/app', () => {
    const selection = resolveStartupWorkspaceSelection({
        brands: [...brands],
        apps: [...apps],
        orderedApps: [...apps],
        lastAppByBrand: {},
        lastWorkspaceSelection: {
            brandId: 'brand-inactive',
            appId: 'app-inactive-brand',
        },
    });

    assert.deepEqual(selection, {
        brandId: 'brand-active',
        appId: 'app-primary',
    });
});

test('startup skips banned remembered apps and falls back to the first active app in the chosen brand', () => {
    const selection = resolveStartupWorkspaceSelection({
        brands: [...brands],
        apps: [...apps],
        orderedApps: [...apps],
        lastAppByBrand: {
            'brand-active': 'app-banned',
        },
        lastWorkspaceSelection: {
            brandId: 'brand-active',
            appId: 'app-banned',
        },
    });

    assert.deepEqual(selection, {
        brandId: 'brand-active',
        appId: 'app-primary',
    });
});

test('startup returns a brand without an app when the chosen brand has no active apps', () => {
    const onlyBrand = [
        {
            id: 'brand-only',
            name: 'Only Brand',
            slug: 'only-brand',
            order_index: 0,
            is_inactive: false,
        },
    ];
    const onlyApps = [
        {
            id: 'app-banned-only',
            brand_id: 'brand-only',
            name: 'Banned Only',
            alias: 'banned-only',
            order_index: 0,
            is_banned: true,
        },
    ];

    const selection = resolveStartupWorkspaceSelection({
        brands: onlyBrand,
        apps: onlyApps,
        orderedApps: onlyApps,
        lastAppByBrand: {},
        lastWorkspaceSelection: null,
    });

    assert.deepEqual(selection, {
        brandId: 'brand-only',
        appId: null,
    });
});
