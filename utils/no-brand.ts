import type { Brand } from '../types/zefgen';

const NO_BRAND_SLUG = 'no-brand';
const NO_BRAND_NAME = 'no brand';

export const isNoBrand = (
    brand: Pick<Brand, 'is_no_brand' | 'slug' | 'name'> | null | undefined
) => {
    if (!brand) return false;
    if (Boolean(brand.is_no_brand)) return true;

    const slug = String(brand.slug || '').trim().toLowerCase();
    if (slug === NO_BRAND_SLUG) return true;

    const name = String(brand.name || '').trim().toLowerCase();
    return name === NO_BRAND_NAME;
};

