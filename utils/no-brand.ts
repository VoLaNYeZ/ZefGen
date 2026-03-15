import type { Brand } from '../types/zefgen';

const NO_BRAND_SLUG = 'no-brand';
const NO_BRAND_NAME = 'no brand';
const NO_BRAND_SLUG_PATTERN = /^no-brand(?:-\d+)?$/;
const NO_BRAND_NAME_PATTERN = /^no brand(?: \d+)?$/;

export const isNoBrand = (
    brand: Pick<Brand, 'is_no_brand' | 'slug' | 'name'> | null | undefined
) => {
    if (!brand) return false;
    if (Boolean(brand.is_no_brand)) return true;

    const slug = String(brand.slug || '').trim().toLowerCase();
    if (slug === NO_BRAND_SLUG || NO_BRAND_SLUG_PATTERN.test(slug)) return true;

    const name = String(brand.name || '').trim().toLowerCase();
    return name === NO_BRAND_NAME || NO_BRAND_NAME_PATTERN.test(name);
};

const toOrderIndex = (brand: Pick<Brand, 'order_index'>) => {
    const value = Number(brand.order_index);
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

const toCreatedAt = (brand: Pick<Brand, 'created_at'>) => {
    const value = Date.parse(String(brand.created_at || ''));
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

const noBrandPriority = (brand: Pick<Brand, 'is_no_brand' | 'slug' | 'name'>) => {
    if (Boolean(brand.is_no_brand)) return 0;
    if (String(brand.slug || '').trim().toLowerCase() === NO_BRAND_SLUG) return 1;
    if (NO_BRAND_SLUG_PATTERN.test(String(brand.slug || '').trim().toLowerCase())) return 2;
    if (String(brand.name || '').trim().toLowerCase() === NO_BRAND_NAME) return 3;
    if (NO_BRAND_NAME_PATTERN.test(String(brand.name || '').trim().toLowerCase())) return 4;
    return 5;
};

export const pickCanonicalNoBrand = <T extends Pick<Brand, 'id' | 'is_no_brand' | 'slug' | 'name' | 'order_index' | 'created_at'>>(
    brands: T[] | null | undefined
) => {
    const brandList = Array.isArray(brands) ? brands : [];
    const candidates = brandList.filter((brand) => isNoBrand(brand));
    if (!candidates.length) return null;

    return [...candidates].sort((left, right) => {
        const priorityDiff = noBrandPriority(left) - noBrandPriority(right);
        if (priorityDiff !== 0) return priorityDiff;

        const orderDiff = toOrderIndex(left) - toOrderIndex(right);
        if (orderDiff !== 0) return orderDiff;

        const createdDiff = toCreatedAt(left) - toCreatedAt(right);
        if (createdDiff !== 0) return createdDiff;

        return String(left.id || '').localeCompare(String(right.id || ''));
    })[0];
};

export const buildCanonicalBrandIdMap = <T extends Pick<Brand, 'id' | 'is_no_brand' | 'slug' | 'name' | 'order_index' | 'created_at'>>(
    brands: T[] | null | undefined
) => {
    const brandList = Array.isArray(brands) ? brands : [];
    const canonicalNoBrand = pickCanonicalNoBrand(brandList);
    const map = new Map<string, string>();

    for (const brand of brandList) {
        map.set(brand.id, canonicalNoBrand && isNoBrand(brand) ? canonicalNoBrand.id : brand.id);
    }

    return map;
};

export const getVisibleBrandOptions = <T extends Pick<Brand, 'id' | 'is_no_brand' | 'slug' | 'name' | 'order_index' | 'created_at'>>(
    brands: T[] | null | undefined
) => {
    const brandList = Array.isArray(brands) ? brands : [];
    const canonicalNoBrand = pickCanonicalNoBrand(brandList);
    const regularBrands = brandList.filter((brand) => !isNoBrand(brand));
    return canonicalNoBrand ? [...regularBrands, canonicalNoBrand] : regularBrands;
};
