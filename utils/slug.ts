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

// Alias-specific uniqueness helper.
// If base is "prefix-01" and already taken, we allocate the first free "prefix-NN"
// instead of producing "prefix-01-2".
export const makeUniqueAlias = (base: string, existing: string[]) => {
    const normalizedBase = slugify(base);
    const existingSet = new Set(
        existing.map((value) => slugify(String(value || '').trim())).filter(Boolean)
    );
    if (!existingSet.has(normalizedBase)) return normalizedBase;

    const numbered = /^([a-z0-9][a-z0-9-]*?)-(\d+)$/i.exec(normalizedBase);
    if (numbered) {
        const prefix = String(numbered[1] || 'ef').toLowerCase();
        const width = Math.max(1, String(numbered[2] || '').length);
        let next = 1;
        while (existingSet.has(`${prefix}-${String(next).padStart(width, '0')}`)) {
            next += 1;
        }
        return `${prefix}-${String(next).padStart(width, '0')}`;
    }

    let suffix = 2;
    let candidate = `${normalizedBase}-${suffix}`;
    while (existingSet.has(candidate)) {
        suffix += 1;
        candidate = `${normalizedBase}-${suffix}`;
    }
    return candidate;
};
