const normalizeName = (value) => String(value || '').trim().toLowerCase();

export const isOriginalScreenshotSetName = (name, localizedOriginal = 'Original') => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return false;

    const normalizedLocalizedOriginal = normalizeName(localizedOriginal);
    return normalizedName === 'original' || normalizedName === normalizedLocalizedOriginal;
};

const compareScreenshotSets = (a, b, localizedOriginal = 'Original') => {
    const aOriginalNameRank = isOriginalScreenshotSetName(a?.name, localizedOriginal) ? 0 : 1;
    const bOriginalNameRank = isOriginalScreenshotSetName(b?.name, localizedOriginal) ? 0 : 1;
    if (aOriginalNameRank !== bOriginalNameRank) return aOriginalNameRank - bOriginalNameRank;

    const aOrder = Number.isFinite(Number(a?.order_index)) ? Number(a.order_index) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b?.order_index)) ? Number(b.order_index) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aCreatedAt = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreatedAt = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreatedAt !== bCreatedAt) return aCreatedAt - bCreatedAt;

    return String(a?.id || '').localeCompare(String(b?.id || ''));
};

export const getCanonicalOriginalScreenshotSet = (sets, localizedOriginal = 'Original') => {
    const candidates = Array.isArray(sets)
        ? sets.filter(
              (set) =>
                  Number(set?.order_index) === 0 || isOriginalScreenshotSetName(set?.name, localizedOriginal)
          )
        : [];
    if (!candidates.length) return null;
    return candidates.slice().sort((a, b) => compareScreenshotSets(a, b, localizedOriginal))[0] ?? null;
};
