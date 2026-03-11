import type { AppstoreAccount } from '../types/zefgen';

export type AppstoreAccountDraft = Partial<Omit<AppstoreAccount, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type AccountPasteField =
    | 'usability'
    | 'app_id'
    | 'email'
    | 'password'
    | 'email_password'
    | 'number'
    | 'geo'
    | 'company_name'
    | 'proxy'
    | 'notes';

export const ACCOUNT_PASTE_FIELD_ORDER: AccountPasteField[] = [
    'usability',
    'app_id',
    'email',
    'password',
    'email_password',
    'number',
    'geo',
    'company_name',
    'proxy',
    'notes',
];

export type AccountPasteIssue = {
    code: 'unknown_app';
    value: string;
};

export const parseClipboardRows = (value: string): string[][] => {
    const normalized = String(value ?? '').replace(/\r\n?/g, '\n');
    return normalized
        .split('\n')
        .map((line) => line.split('\t'))
        .filter((cells) => cells.some((cell) => cell !== ''));
};

export const buildDraftPatchFromClipboard = (args: {
    startField: AccountPasteField;
    cells: string[];
    resolveStatus: (value: string) => Pick<AppstoreAccount, 'usability' | 'was_used_before'> | null;
    resolveAppId: (value: string) => string | null | undefined;
}): {
    patch: AppstoreAccountDraft;
    issues: AccountPasteIssue[];
} => {
    const startIndex = ACCOUNT_PASTE_FIELD_ORDER.indexOf(args.startField);
    if (startIndex < 0) return { patch: {}, issues: [] };

    const patch: AppstoreAccountDraft = {};
    const issues: AccountPasteIssue[] = [];

    for (let offset = 0; offset < args.cells.length; offset += 1) {
        const field = ACCOUNT_PASTE_FIELD_ORDER[startIndex + offset];
        if (!field) break;

        const value = String(args.cells[offset] ?? '');
        if (field === 'usability') {
            const status = args.resolveStatus(value);
            if (status) Object.assign(patch, status);
            continue;
        }

        if (field === 'app_id') {
            const appId = args.resolveAppId(value);
            if (appId === undefined) {
                issues.push({ code: 'unknown_app', value });
                continue;
            }
            patch.app_id = appId;
            continue;
        }

        patch[field] = value;
    }

    return { patch, issues };
};
