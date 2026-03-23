export const APPSTORE_REVIEW_TERMINAL_STATES = Object.freeze([
    'READY_FOR_SALE',
    'REJECTED',
    'METADATA_REJECTED',
    'INVALID_BINARY',
    'DEVELOPER_REJECTED',
    'DEVELOPER_REMOVED_FROM_SALE',
    'REMOVED_FROM_SALE',
]);

const APPSTORE_REVIEW_TERMINAL_STATE_SET = new Set(APPSTORE_REVIEW_TERMINAL_STATES);

export const normalizeAppstoreReviewState = (value) => String(value || '').trim().toUpperCase();

export const isTerminalAppstoreReviewState = (value) =>
    APPSTORE_REVIEW_TERMINAL_STATE_SET.has(normalizeAppstoreReviewState(value));

export const shouldBackgroundRefreshAppstoreReviewState = (value) =>
    !isTerminalAppstoreReviewState(value);
