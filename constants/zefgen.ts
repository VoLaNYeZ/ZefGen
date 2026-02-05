export const MAX_FILE_MB = 10;
export const MAX_SCREENSHOT_REFS = 6;
export const MAX_SCREENSHOT_VERSIONS = 3;
export const MAX_ACTIVE_APPS = 7;
export const AUTO_GROW_MULTIPLIER = 5;
export const BRAND_BUCKET = 'brand-references';
export const APP_SCREENSHOT_BUCKET = 'app-screenshots';
export const GENERATED_BUCKET = 'generated-assets';

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
