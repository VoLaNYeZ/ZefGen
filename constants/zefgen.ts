export const MAX_FILE_MB = 10;
export const MAX_SCREENSHOT_REFS = 6;
export const MAX_SCREENSHOT_VERSIONS = 8;
export const MAX_ACTIVE_APPS = 7;
export const AUTO_GROW_MULTIPLIER = 5;
export const BRAND_BUCKET = 'brand-references';
export const APP_SCREENSHOT_BUCKET = 'app-screenshots';
export const GENERATED_BUCKET = 'generated-assets';
export const WORKSPACE_COLLAB_ENABLED = true;
export const WORKSPACE_LOCK_ENFORCEMENT_ENABLED = true;
export const WORKSPACE_SOFT_LOCK_VIEW_MODE_ENABLED = true;
export const WORKSPACE_COLLAB_POLL_MS = 10_000;
export const WORKSPACE_COLLAB_TTL_SECONDS = 30;
export const NO_BRAND_ICON_SEED_PATH = '/no-brand-icon-seed.jpg';

export const SCREENSHOT_SIZES = {
    '6.5': { width: 1242, height: 2688 },
    '6.9': { width: 1320, height: 2868 },
} as const;

export const EDIT_FONTS = [
    'Manrope',
    'Rubik',
    'PT Sans',
    'PT Serif',
    'Montserrat',
    'Playfair Display',
    'Source Sans 3',
    'Source Serif 4',
];
