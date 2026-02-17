type GoogleDriveFile = {
    id: string;
    name?: string;
    parents?: string[];
    webViewLink?: string;
};

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

const driveRequest = async <T>(payload: {
    accessToken: string;
    path: string;
    method?: 'GET' | 'POST' | 'PATCH';
    query?: URLSearchParams;
    body?: unknown;
}) => {
    const url = new URL(`${DRIVE_BASE}${payload.path}`);
    if (payload.query) {
        for (const [key, value] of payload.query.entries()) url.searchParams.set(key, value);
    }

    const resp = await fetch(url.toString(), {
        method: payload.method || 'GET',
        headers: {
            Authorization: `Bearer ${payload.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: payload.body ? JSON.stringify(payload.body) : undefined,
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(
            `Google Drive API ${payload.method || 'GET'} ${payload.path} failed (${resp.status}): ${String(
                data?.error?.message || 'unknown error'
            )}`
        );
    }
    return data as T;
};

const escapeDriveQueryValue = (input: string) => input.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const ensureAppFolder = async (payload: { accessToken: string; folderName: string; sharedDriveId?: string | null }) => {
    const sharedDriveId = String(payload.sharedDriveId || '').trim();
    const parentId = sharedDriveId || 'root';
    const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${escapeDriveQueryValue(payload.folderName)}' and '${escapeDriveQueryValue(parentId)}' in parents`;

    const query = new URLSearchParams({
        q,
        fields: 'files(id,name)',
        pageSize: '1',
        spaces: 'drive',
        supportsAllDrives: 'true',
    });
    if (sharedDriveId) {
        query.set('corpora', 'drive');
        query.set('driveId', sharedDriveId);
        query.set('includeItemsFromAllDrives', 'true');
    }

    const listed = await driveRequest<{ files?: GoogleDriveFile[] }>({
        accessToken: payload.accessToken,
        path: '/files',
        query,
    });
    const existing = listed.files?.[0];
    if (existing?.id) return existing.id;

    const created = await driveRequest<GoogleDriveFile>({
        accessToken: payload.accessToken,
        path: '/files',
        method: 'POST',
        query: new URLSearchParams({ fields: 'id,name', supportsAllDrives: 'true' }),
        body: {
            name: payload.folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
    });
    return String(created.id);
};

export const ensureSharedDriveAppFolder = async (payload: { accessToken: string; folderName: string; sharedDriveId: string }) =>
    ensureAppFolder({
        accessToken: payload.accessToken,
        folderName: payload.folderName,
        sharedDriveId: payload.sharedDriveId,
    });

export const createGoogleDocInFolder = async (payload: {
    accessToken: string;
    parentFolderId: string;
    name: string;
}) => {
    const created = await driveRequest<GoogleDriveFile>({
        accessToken: payload.accessToken,
        path: '/files',
        method: 'POST',
        query: new URLSearchParams({ fields: 'id,name,webViewLink', supportsAllDrives: 'true' }),
        body: {
            name: payload.name,
            mimeType: 'application/vnd.google-apps.document',
            parents: [payload.parentFolderId],
        },
    });

    return {
        id: String(created.id),
        webViewLink: created.webViewLink ? String(created.webViewLink) : null,
    };
};

export const createGoogleFormInFolder = async (payload: {
    accessToken: string;
    parentFolderId: string;
    name: string;
}) => {
    const created = await driveRequest<GoogleDriveFile>({
        accessToken: payload.accessToken,
        path: '/files',
        method: 'POST',
        query: new URLSearchParams({ fields: 'id,name,webViewLink', supportsAllDrives: 'true' }),
        body: {
            name: payload.name,
            mimeType: 'application/vnd.google-apps.form',
            parents: [payload.parentFolderId],
        },
    });

    return {
        id: String(created.id),
        webViewLink: created.webViewLink ? String(created.webViewLink) : null,
    };
};

export const moveFileToFolder = async (payload: {
    accessToken: string;
    fileId: string;
    parentFolderId: string;
}) => {
    const fileId = encodeURIComponent(payload.fileId);
    const file = await driveRequest<GoogleDriveFile>({
        accessToken: payload.accessToken,
        path: `/files/${fileId}`,
        query: new URLSearchParams({ fields: 'parents', supportsAllDrives: 'true' }),
    });

    const currentParents = (file.parents || []).filter(Boolean);
    const query = new URLSearchParams({
        addParents: payload.parentFolderId,
        fields: 'id,parents',
        supportsAllDrives: 'true',
    });
    if (currentParents.length > 0) query.set('removeParents', currentParents.join(','));

    await driveRequest<GoogleDriveFile>({
        accessToken: payload.accessToken,
        path: `/files/${fileId}`,
        method: 'PATCH',
        query,
        body: {},
    });
};

export const setAnyoneReaderPermission = async (payload: { accessToken: string; fileId: string }) => {
    const fileId = encodeURIComponent(payload.fileId);
    await driveRequest<{ id: string }>({
        accessToken: payload.accessToken,
        path: `/files/${fileId}/permissions`,
        method: 'POST',
        query: new URLSearchParams({ sendNotificationEmail: 'false', fields: 'id', supportsAllDrives: 'true' }),
        body: {
            role: 'reader',
            type: 'anyone',
        },
    });
};

export const trashGoogleFile = async (payload: { accessToken: string; fileId: string }) => {
    const fileId = encodeURIComponent(payload.fileId);
    await driveRequest<{ id: string }>({
        accessToken: payload.accessToken,
        path: `/files/${fileId}`,
        method: 'PATCH',
        query: new URLSearchParams({ fields: 'id', supportsAllDrives: 'true' }),
        body: {
            trashed: true,
        },
    });
};
