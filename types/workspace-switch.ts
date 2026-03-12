export type WorkspaceSwitchGuard = {
    isDirty: boolean;
    blockReason: string | null;
    flushPending: () => Promise<boolean>;
};

export type WorkspacePreparationResult =
    | { status: 'ready' }
    | { status: 'blocked'; message: string }
    | { status: 'failed' };
