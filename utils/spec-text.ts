export const normalizeLegacyRenderedSpec = (value: unknown) => {
    const text = String(value ?? '');
    if (!text.includes('\\n') || /[\r\n]/.test(text)) return text;
    return text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
};
