import React from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppItem } from '../types/zefgen';
import { fetchConnectorAppConfig, upsertConnectorAppConfig } from '../data/connector-app-config';
import { deleteConnectorSecret, fetchConnectorSecretMetas, upsertConnectorSecret } from '../data/connector-secrets';

export const useConnectorConfigForm = (payload: {
    session: Session | null;
    selectedApp: AppItem | null;
    reportError?: (msg: string) => void;
}) => {
    const { session, selectedApp, reportError } = payload;

    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [secretBusy, setSecretBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [projectBrief, setProjectBrief] = React.useState('');
    const [variables, setVariables] = React.useState<Record<string, any>>({});
    const [secretMetas, setSecretMetas] = React.useState<any[]>([]);

    const refresh = React.useCallback(async () => {
        if (!session || !selectedApp) return;
        setLoading(true);
        setError(null);
        try {
            const cfg = await fetchConnectorAppConfig({ userId: session.user.id, appId: selectedApp.id });
            if (cfg.error) throw cfg.error;

            if (cfg.data) {
                setProjectBrief(String((cfg.data as any).project_brief || ''));
                setVariables((cfg.data as any).variables || {});
            } else {
                // First use: create a default row (keeps UI consistent).
                const created = await upsertConnectorAppConfig({
                    userId: session.user.id,
                    appId: selectedApp.id,
                    patch: {
                        project_kind: 'ios',
                        project_brief: '',
                        variables: {
                            privacy_policy_url: 'https://google.com',
                            terms_of_use_url: 'https://google.com',
                            support_form_url: 'https://google.com',
                        },
                        verify_command: null,
                    },
                });
                if (created.error) throw created.error;
                setProjectBrief(String((created.data as any)?.project_brief || ''));
                setVariables((created.data as any)?.variables || {});
            }

            const secrets = await fetchConnectorSecretMetas({ userId: session.user.id, appId: selectedApp.id });
            if (secrets.error) throw secrets.error;
            setSecretMetas(secrets.data || []);
        } catch (e: any) {
            const msg = String(e?.message || e);
            setError(msg);
            reportError?.(msg);
        } finally {
            setLoading(false);
        }
    }, [session, selectedApp, reportError]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const savePatch = React.useCallback(
        async (patch: { project_brief?: string; variables?: Record<string, any> }) => {
            if (!session || !selectedApp) return;
            setSaving(true);
            setError(null);
            try {
                const resp = await upsertConnectorAppConfig({
                    userId: session.user.id,
                    appId: selectedApp.id,
                    patch: {
                        // UI invariant: always iOS for now.
                        project_kind: 'ios',
                        ...patch,
                    } as any,
                });
                if (resp.error) throw resp.error;

                // Keep local state in sync with the canonical row.
                if (resp.data) {
                    if (typeof (resp.data as any).project_brief === 'string') {
                        setProjectBrief(String((resp.data as any).project_brief || ''));
                    }
                    if ((resp.data as any).variables) {
                        setVariables((resp.data as any).variables || {});
                    }
                }
            } catch (e: any) {
                const msg = String(e?.message || e);
                setError(msg);
                reportError?.(msg);
            } finally {
                setSaving(false);
            }
        },
        [session, selectedApp, reportError]
    );

    const setVariable = React.useCallback((k: string, v: any) => {
        setVariables((prev) => ({ ...prev, [k]: v }));
    }, []);

    const upsertSecret = React.useCallback(
        async (key: string, value: string) => {
            if (!session || !selectedApp) return;
            const k = String(key || '').trim();
            if (!k) return;
            if (!value) return;
            setSecretBusy(true);
            setError(null);
            try {
                const resp = await upsertConnectorSecret({
                    userId: session.user.id,
                    appId: selectedApp.id,
                    key: k,
                    value,
                });
                if (resp.error) throw resp.error;
                await refresh();
            } catch (e: any) {
                const msg = String(e?.message || e);
                setError(msg);
                reportError?.(msg);
            } finally {
                setSecretBusy(false);
            }
        },
        [session, selectedApp, refresh, reportError]
    );

    const removeSecret = React.useCallback(
        async (key: string) => {
            if (!session || !selectedApp) return;
            const k = String(key || '').trim();
            if (!k) return;
            setSecretBusy(true);
            setError(null);
            try {
                const resp = await deleteConnectorSecret({ userId: session.user.id, appId: selectedApp.id, key: k });
                if (resp.error) throw resp.error;
                await refresh();
            } catch (e: any) {
                const msg = String(e?.message || e);
                setError(msg);
                reportError?.(msg);
            } finally {
                setSecretBusy(false);
            }
        },
        [session, selectedApp, refresh, reportError]
    );

    return {
        loading,
        saving,
        secretBusy,
        error,
        projectBrief,
        setProjectBrief,
        variables,
        setVariables,
        setVariable,
        secretMetas,
        refresh,
        savePatch,
        upsertSecret,
        removeSecret,
    };
};
