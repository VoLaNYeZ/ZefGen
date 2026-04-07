export const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
};

const shouldUseBlobNavigationFallback = (filename: string, url: string) => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (!String(url || '').startsWith('blob:')) return false;
    if (!/\.zip$/i.test(String(filename || ''))) return false;

    const userAgent = String(navigator.userAgent || '');
    const platform = String(navigator.platform || '');
    const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
    const isIOSDevice =
        /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
    const isSafariLike =
        /AppleWebKit/i.test(userAgent) &&
        !/(CriOS|Chrome|Chromium|EdgiOS|Edg|FxiOS|Firefox|OPiOS|OPR|SamsungBrowser)/i.test(userAgent);

    return isIOSDevice || isSafariLike;
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);

    // Safari/WebKit can ignore synthetic async blob downloads for ZIP files.
    // Navigating the current tab to the blob URL is more reliable there.
    if (shouldUseBlobNavigationFallback(filename, objectUrl)) {
        window.location.assign(objectUrl);
    } else {
        triggerDownload(objectUrl, filename);
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export const downloadUrlAsFile = async (payload: { url: string; filename: string }) => {
    const resp = await fetch(payload.url, { cache: 'force-cache' });
    if (!resp.ok) {
        throw new Error(`Failed to download file (${resp.status}).`);
    }
    const blob = await resp.blob();
    downloadBlob(blob, payload.filename);
};
