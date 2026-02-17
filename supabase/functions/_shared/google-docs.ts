const DOCS_BASE = 'https://docs.googleapis.com/v1';

const docsRequest = async <T>(payload: {
    accessToken: string;
    path: string;
    body: unknown;
}) => {
    const resp = await fetch(`${DOCS_BASE}${payload.path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${payload.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload.body),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(
            `Google Docs API POST ${payload.path} failed (${resp.status}): ${String(
                data?.error?.message || 'unknown error'
            )}`
        );
    }
    return data as T;
};

export const writeDocumentText = async (payload: {
    accessToken: string;
    documentId: string;
    text: string;
}) => {
    const documentId = encodeURIComponent(payload.documentId);
    await docsRequest({
        accessToken: payload.accessToken,
        path: `/documents/${documentId}:batchUpdate`,
        body: {
            requests: [
                {
                    insertText: {
                        location: { index: 1 },
                        text: payload.text,
                    },
                },
            ],
        },
    });
};
