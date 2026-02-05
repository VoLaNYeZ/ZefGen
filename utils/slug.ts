export const slugify = (value: string) => {
    const cleaned = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    return cleaned || 'untitled';
};

export const makeUniqueSlug = (base: string, existing: string[]) => {
    if (!existing.includes(base)) return base;

    let suffix = 2;
    let candidate = `${base}-${suffix}`;

    while (existing.includes(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
    }

    return candidate;
};
