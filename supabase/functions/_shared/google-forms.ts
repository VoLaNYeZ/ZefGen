import { createGoogleFormInFolder, setAnyoneReaderPermission } from './google-drive.ts';
import type { SupportFormField } from './legal-templates.ts';

const FORMS_BASE = 'https://forms.googleapis.com/v1';

const formsRequest = async <T>(payload: {
    accessToken: string;
    path: string;
    method?: 'GET' | 'POST';
    body?: unknown;
}) => {
    const resp = await fetch(`${FORMS_BASE}${payload.path}`, {
        method: payload.method || 'POST',
        headers: {
            Authorization: `Bearer ${payload.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: payload.body ? JSON.stringify(payload.body) : undefined,
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        throw new Error(
            `Google Forms API ${payload.method || 'POST'} ${payload.path} failed (${resp.status}): ${String(
                data?.error?.message || 'unknown error'
            )}`
        );
    }
    return data as T;
};

const publishForm = async (payload: { accessToken: string; formId: string }) => {
    await formsRequest({
        accessToken: payload.accessToken,
        method: 'POST',
        path: `/forms/${encodeURIComponent(payload.formId)}:setPublishSettings`,
        body: {
            publishSettings: {
                publishState: {
                    isPublished: true,
                    isAcceptingResponses: true,
                },
            },
            updateMask: 'publishState',
        },
    });
};

const getResponderUri = async (payload: { accessToken: string; formId: string }) => {
    const form = await formsRequest<{ responderUri?: string }>({
        accessToken: payload.accessToken,
        method: 'GET',
        path: `/forms/${encodeURIComponent(payload.formId)}`,
    });
    return String(form?.responderUri || '').trim();
};

const getExistingItemCount = async (payload: { accessToken: string; formId: string }) => {
    const form = await formsRequest<{ items?: unknown[] }>({
        accessToken: payload.accessToken,
        method: 'GET',
        path: `/forms/${encodeURIComponent(payload.formId)}`,
    });
    return Array.isArray(form?.items) ? form.items.length : 0;
};

export const createAndConfigureSupportForm = async (payload: {
    accessToken: string;
    parentFolderId: string;
    title: string;
    description: string | null;
    fields: SupportFormField[];
}) => {
    const created = await createGoogleFormInFolder({
        accessToken: payload.accessToken,
        parentFolderId: payload.parentFolderId,
        name: payload.title,
    });
    const formId = String(created.id || '').trim();
    if (!formId) throw new Error('Google Form file creation returned empty id.');

    const requests: Array<Record<string, unknown>> = [];
    const existingItemCount = await getExistingItemCount({
        accessToken: payload.accessToken,
        formId,
    });
    if (existingItemCount > 0) {
        for (let i = existingItemCount - 1; i >= 0; i -= 1) {
            requests.push({
                deleteItem: {
                    location: { index: i },
                },
            });
        }
    }

    requests.push({
        updateFormInfo: {
            info: payload.description ? { title: payload.title, description: payload.description } : { title: payload.title },
            updateMask: payload.description ? 'title,description' : 'title',
        },
    });

    for (let i = 0; i < payload.fields.length; i += 1) {
        const field = payload.fields[i];
        requests.push({
            createItem: {
                location: { index: i },
                item: {
                    title: field.label,
                    questionItem: {
                        question: {
                            required: field.required,
                            textQuestion: {
                                paragraph: field.paragraph,
                            },
                        },
                    },
                },
            },
        });
    }

    if (requests.length > 0) {
        await formsRequest({
            accessToken: payload.accessToken,
            path: `/forms/${encodeURIComponent(formId)}:batchUpdate`,
            body: { requests },
        });
    }

    await setAnyoneReaderPermission({
        accessToken: payload.accessToken,
        fileId: formId,
    });

    await publishForm({
        accessToken: payload.accessToken,
        formId,
    });

    const responderUri = (await getResponderUri({ accessToken: payload.accessToken, formId })) || `https://docs.google.com/forms/d/${formId}/viewform`;
    return { formId, responderUri };
};
