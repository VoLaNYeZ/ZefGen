export const MIN_CLIENT_SPEC_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MIN_DESCRIPTION_LENGTH = 1500;
export const SPEC_MAX_CHARS = 8_000;
const SPEC_FALLBACK_CHARS = 4_000;

const SPEC_META_PATTERNS = [
    /\b\d+\+?\s*(templates?|variants?|tones?)\b/i,
    /\bchar(?:acter)?s?\s*(?:limit|count|range)\b/i,
    /\bjobs?-to-be-done\b/i,
    /\{(?:name|context|cta|signoff)\}/i,
    /\bplaceholder(?:\s+text)?\b/i,
    /^\s*(?:copy angle|cta|signoff|tone(?: options?)?|tones|template|templates|variant|variants|prompt notes?)\s*[:=-]/i,
    /^\s*(?:app store )?(?:description|copy)\s+(?:rules?|notes?|constraints?)\s*[:=-]/i,
];

const INTERNAL_LEAK_PATTERNS = [
    /\bjobs?-to-be-done\b/i,
    /\{(?:name|context|cta|signoff)\}/i,
    /\bplaceholder(?:\s+text)?\b/i,
    /\bfallback(?:\s+logic|\s+behavior)?\b/i,
    /\bchar(?:acter)?s?\s*(?:limit|count|range)\b/i,
    /\b\d+\+?\s*(templates?|variants?|tones?)\b/i,
    /\b(?:implementation|architecture|internal field)\b/i,
];

const BULLET_LINE_PATTERN = /^\s*[-*•]\s+\S+/;
const GENERIC_CTA_PATTERNS = [
    /\bdownload (?:the |this )?app(?:\s+today)?\b/i,
    /\bget started today\b/i,
    /\binstall now\b/i,
    /\btry (?:the )?app(?:\s+today)?\b/i,
    /\btap download\b/i,
    /\bstart (?:your|the) .* today\b/i,
];

const normalizeLine = (value) => String(value || '').trim();

const splitBlocks = (value) =>
    String(value || '')
        .split(/\n\s*\n+/)
        .map((block) => block.trim())
        .filter(Boolean);

const isLikelyMetaSpecLine = (line) => {
    const normalized = normalizeLine(line);
    if (!normalized) return false;
    if (SPEC_META_PATTERNS.some((rx) => rx.test(normalized))) return true;

    if (
        /^(?:notes?|constraints?|rules?)\s*:/i.test(normalized) &&
        /(?:char|placeholder|jobs-to-be-done|tone|variant|template|cta|signoff)/i.test(normalized)
    ) {
        return true;
    }

    return false;
};

export const sanitizeClientSpecForPrompt = (rawSpec) => {
    const source = String(rawSpec || '').replace(/\r/g, '').slice(0, SPEC_MAX_CHARS);
    const lines = source
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !isLikelyMetaSpecLine(line));
    const sanitized = lines.join('\n').slice(0, SPEC_MAX_CHARS).trim();
    if (sanitized.length >= MIN_CLIENT_SPEC_LENGTH) return sanitized;
    return source.slice(0, SPEC_FALLBACK_CHARS).trim();
};

export const hasInternalLeakSignals = (text) => {
    const value = String(text || '');
    return INTERNAL_LEAK_PATTERNS.some((rx) => rx.test(value));
};

export const sanitizeDescription = (value) => {
    let out = String(value || '').trim();

    out = out.replace(/^```[a-zA-Z0-9_-]*\s*/i, '').replace(/\s*```$/i, '').trim();
    out = out
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, ''))
        .join('\n')
        .trim();

    if (out.length > MAX_DESCRIPTION_LENGTH) {
        out = out.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
    }

    return out;
};

export const analyzeGeneratedDescription = (rawValue) => {
    const text = sanitizeDescription(rawValue);
    const blocks = splitBlocks(text);
    const nonEmptyLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const bulletLines = nonEmptyLines.filter((line) => BULLET_LINE_PATTERN.test(line));
    const bulletBlockIndexes = blocks.flatMap((block, index) => {
        const blockLines = block
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (blockLines.length > 0 && blockLines.every((line) => BULLET_LINE_PATTERN.test(line))) {
            return [index];
        }
        return [];
    });
    const issues = [];

    if (!text) issues.push('empty');
    if (text.length < MIN_DESCRIPTION_LENGTH) issues.push('too_short');
    if (blocks.length < 2) issues.push('too_few_paragraphs');
    if (blocks.length > 4) issues.push('too_many_paragraphs');

    if (bulletLines.length > 0) {
        const bulletRatio = bulletLines.length / Math.max(nonEmptyLines.length, 1);
        const hasSingleMiddleBulletBlock =
            bulletBlockIndexes.length === 1 &&
            bulletBlockIndexes[0] > 0 &&
            bulletBlockIndexes[0] < blocks.length - 1;
        const tooManyBullets = bulletLines.length > 4 || bulletRatio > 0.35;
        if (!hasSingleMiddleBulletBlock || bulletBlockIndexes.length > 1 || tooManyBullets) {
            issues.push('bullet_heavy');
        }
    }

    const closingBlock = blocks[blocks.length - 1] || '';
    if (GENERIC_CTA_PATTERNS.some((rx) => rx.test(closingBlock))) {
        issues.push('generic_cta');
    }

    if (hasInternalLeakSignals(text)) {
        issues.push('internal_leak');
    }

    return {
        text,
        issues: Array.from(new Set(issues)),
        metrics: {
            charCount: text.length,
            paragraphCount: blocks.length,
            bulletLineCount: bulletLines.length,
            bulletBlockCount: bulletBlockIndexes.length,
        },
    };
};
