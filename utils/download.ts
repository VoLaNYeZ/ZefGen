export const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
};

export const downloadUrlAsFile = async (payload: { url: string; filename: string }) => {
    const resp = await fetch(payload.url, { cache: 'force-cache' });
    if (!resp.ok) {
        throw new Error(`Failed to download file (${resp.status}).`);
    }
    const blob = await resp.blob();
    downloadBlob(blob, payload.filename);
};
