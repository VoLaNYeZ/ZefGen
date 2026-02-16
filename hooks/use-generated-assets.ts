import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type {
    AppItem,
    AppScreenshot,
    AppScreenshotSet,
    AppExportStatus,
    AssetPick,
    Brand,
    BrandReference,
    EditState,
    GeneratedAsset,
    ScreenshotProviderId,
    TextLayer,
} from '../types/zefgen';
import {
    APP_SCREENSHOT_BUCKET,
    BRAND_BUCKET,
    EDIT_FONTS,
    GENERATED_BUCKET,
    MAX_SCREENSHOT_VERSIONS,
    SCREENSHOT_SIZES,
} from '../constants/zefgen';
import { createId } from '../utils/id';
import {
    base64ToBlob,
    createPreviewJpeg,
    renderBlobToJpeg,
    renderBlobToJpegAutoFit,
    renderImageUrlWithLayersToJpeg,
} from '../utils/images';
import { downloadBlob, downloadUrlAsFile, triggerDownload } from '../utils/download';
import { useSignedUrlCache } from './use-signed-url-cache';
import { useGenerationJobs } from './use-generation-jobs';
import {
    createGeneratedAsset,
    deleteGeneratedAsset,
    deleteGeneratedAssetsByIds,
    fetchGeneratedAssets,
    bulkAssignScreenshotSetId,
    removeGeneratedAssets,
    updateGeneratedAsset,
    uploadGeneratedAsset,
} from '../data/generated-assets';
import { updateApp } from '../data/apps';
import { fetchScreenshotSets, createScreenshotSet, updateScreenshotSet, deleteScreenshotSet } from '../data/screenshot-sets';
import { fetchAssetPicks, setIconPick, setScreenshotPick } from '../data/asset-picks';
import { fetchExportStatus, upsertExportStatus } from '../data/export-status';

type SlotMapping = {
    brandRefId: string | null;
    simShotId: string | null;
};

type ScreenshotKind = 'screenshot' | 'screenshot_enhanced';
type IconKind = 'icon' | 'icon_enhanced';
type SystemPromptMode = 'generate' | 'enhance';
type GenerationApiResult = { kind: 'b64'; mimeType: string; b64: string } | { kind: 'url'; outputUrl: string };

type Params = {
    session: Session | null;
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    selectedAppScreenshots: AppScreenshot[];
    appScreenshotUrls: Record<string, string>;
    brandIconReference: BrandReference | null;
    brandScreenshotReferences: BrandReference[];
    brandRefUrls: Record<string, string>;
    getSlotMapping: (slotIndex: number) => SlotMapping;
    promptsByRefId: Record<string, string>;
    text: (key: TranslationKey) => string;
    reportError: (message: string) => void;
    onDataError?: (message: string) => void;
};

export const useGeneratedAssets = ({
    session,
    selectedBrand,
    selectedApp,
    selectedAppScreenshots,
    appScreenshotUrls,
    brandIconReference,
    brandScreenshotReferences,
    brandRefUrls,
    getSlotMapping,
    promptsByRefId,
    text,
    reportError,
    onDataError,
}: Params) => {
    const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
    const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({});
    const [generatedPreviewUrls, setGeneratedPreviewUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);
    const { getSignedUrl } = useSignedUrlCache({ userId: session?.user.id ?? null });
    const {
        jobs: generationJobs,
        hasRunningJobs,
        createJob,
        setJobProgress,
        setJobMessage,
        finishJob,
        dismissJob,
        clearFinished,
    } = useGenerationJobs();

    // Allow canceling long-running client-side stages (download provider output, render, upload, DB insert).
    // Note: this cannot reliably cancel the provider-side prediction once started.
    const abortByJobIdRef = useRef<Record<string, AbortController>>({});
    const cancelGenerationJob = useCallback(
        (jobId: string) => {
            const controller = abortByJobIdRef.current[jobId];
            if (!controller) return;
            if (!controller.signal.aborted) controller.abort();
            finishJob(jobId, { status: 'canceled', message: 'Canceled' });
        },
        [finishJob]
    );

    const [inflightScreenshotPreviewByKey, setInflightScreenshotPreviewByKey] = useState<Record<string, string>>({});

    const [iconGenerating, setIconGenerating] = useState(false);
    const [iconSlotGenerating, setIconSlotGenerating] = useState<number | null>(null);
    const [enhanceIconSlotGenerating, setEnhanceIconSlotGenerating] = useState<number | null>(null);
    const [screenshotsGenerating, setScreenshotsGenerating] = useState(false);
    const [slotGenerating, setSlotGenerating] = useState<number | null>(null);
    const [enhanceSlotGenerating, setEnhanceSlotGenerating] = useState<number | null>(null);
    // These are driven by the active screenshot set (see screenshotSets below).
    const [generationCount, setGenerationCount] = useState(3);
    const [generationSize, setGenerationSize] = useState<'6.5' | '6.9'>('6.5');
    const [iconProviderId, setIconProviderId] = useState<ScreenshotProviderId>('replicate:seedream-4');
    const [iconVariationsCount, setIconVariationsCount] = useState(1);
    const [screenshotProviderId, setScreenshotProviderId] = useState<ScreenshotProviderId>('replicate:seedream-4');
    const [editAssetId, setEditAssetId] = useState<string | null>(null);
    const [editDrafts, setEditDrafts] = useState<Record<string, EditState>>({});
    const [editSaving, setEditSaving] = useState<string | null>(null);
    const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);
    const githubRepoDbBackfillDoneRef = useRef<Record<string, boolean>>({});
    const githubRepoClearedByAppIdRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!selectedApp?.id) {
            setGithubRepoUrl(null);
            return;
        }
        const appId = selectedApp.id;
        if (githubRepoClearedByAppIdRef.current[appId]) {
            setGithubRepoUrl(null);
            return;
        }

        const fromDb = String((selectedApp as any)?.github_repo_url || '').trim();
        if (fromDb) {
            setGithubRepoUrl(fromDb);
            return;
        }

        const key = `zefgen.githubRepoUrl.${appId}`;
        const fromLocal = window.localStorage.getItem(key);
        setGithubRepoUrl(fromLocal);

        // One-time backfill: if we have a local URL but DB is empty, persist so it works across devices.
        if (!session || !fromLocal || githubRepoDbBackfillDoneRef.current[appId]) return;
        githubRepoDbBackfillDoneRef.current[appId] = true;
        updateApp({
            id: appId,
            userId: session.user.id,
            patch: {
                github_repo_url: fromLocal,
                github_repo_updated_at: new Date().toISOString(),
            } as any,
        }).catch(() => {
            // ignore; DB might not have columns yet
        });
    }, [selectedApp?.id, (selectedApp as any)?.github_repo_url, session]);

    const [screenshotSets, setScreenshotSets] = useState<AppScreenshotSet[]>([]);
    const [activeScreenshotSetId, setActiveScreenshotSetId] = useState<string | null>(null);
    const [assetPicks, setAssetPicks] = useState<AssetPick[]>([]);
    const [exportStatus, setExportStatus] = useState<AppExportStatus | null>(null);
    const setsLoadedForAppRef = useRef<string | null>(null);
    const backfillDoneForAppRef = useRef<Record<string, boolean>>({});

    const setExportCompleted = useCallback(
        async (isCompleted: boolean) => {
            if (!session || !selectedBrand || !selectedApp) return;
            const completedAt = isCompleted ? new Date().toISOString() : null;
            const { data, error } = await upsertExportStatus({
                app_id: selectedApp.id,
                user_id: session.user.id,
                brand_id: selectedBrand.id,
                is_completed: isCompleted,
                completed_at: completedAt,
            });
            if (error) {
                const msg = String((error as any)?.message || error);
                if (msg.toLowerCase().includes('app_export_status')) {
                    reportError(
                        `DB schema is missing export status tables. Run supabase/migrations/2026-02-06_sets_picks_completion.sql in Supabase, then retry.`
                    );
                } else {
                    reportError(msg);
                }
                return;
            }
            if (data) setExportStatus(data as any);
        },
        [session, selectedBrand, selectedApp, reportError]
    );

    const invalidateCompletion = useCallback(async () => {
        // Any changes should require re-locking.
        if (exportStatus?.is_completed) {
            await setExportCompleted(false);
        }
    }, [exportStatus?.is_completed, setExportCompleted]);

    const headlineSaveTimersRef = useRef<Record<string, any>>({});
    const [slotHeadlineBySlotKey, setSlotHeadlineBySlotKey] = useState<Record<string, string>>({});
    const [slotHeadlinePosBySlotKey, setSlotHeadlinePosBySlotKey] = useState<Record<string, { x: number; y: number }>>({});
    const [slotHeadlineLayerBySlotKey, setSlotHeadlineLayerBySlotKey] = useState<Record<string, TextLayer>>({});
    const [slotPromptBySlotKey, setSlotPromptBySlotKey] = useState<Record<string, string>>({});
    const [systemPromptOverridesByKey, setSystemPromptOverridesByKey] = useState<
        Record<string, { generate?: string; enhance?: string }>
    >({});
    const slotHeadlineHistoryRef = useRef<
        Record<
            string,
            { undo: Array<{ text: string; x: number; y: number }>; redo: Array<{ text: string; x: number; y: number }> }
        >
    >({});

    const refresh = useCallback(async () => {
        if (!session) {
            setGeneratedAssets([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        setLoading(true);
        setError(null);
        const { data, error } = await fetchGeneratedAssets(session.user.id);
        if (error) {
            if (error.message?.includes('app_generated_assets')) {
                setGeneratedAssets([]);
            } else {
                setError(error.message);
                onDataError?.(error.message);
            }
        } else {
            setGeneratedAssets(data || []);
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [session, onDataError]);

    useEffect(() => {
        if (!session) {
            setGeneratedAssets([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id && generatedAssets.length) return;
        refresh();
    }, [session, generatedAssets.length, refresh]);

    const ensureOriginalScreenshotSet = useCallback(
        async (sets: AppScreenshotSet[]) => {
            if (!session || !selectedBrand || !selectedApp) return { sets, original: null as AppScreenshotSet | null };

            const wanted = text('set_original');
            const existing =
                sets.find((s) => s.name === wanted) ??
                sets.find((s) => s.name.toLowerCase() === 'original') ??
                null;
            if (existing) return { sets, original: existing };

            const { data, error } = await createScreenshotSet({
                user_id: session.user.id,
                brand_id: selectedBrand.id,
                app_id: selectedApp.id,
                name: wanted,
                size_label: '6.5',
                slot_count: 3,
                order_index: 0,
            });
            if (error) throw error;
            const next = data ? ([data as any, ...sets] as AppScreenshotSet[]) : sets;
            return { sets: next, original: (data as any) ?? null };
        },
        [session, selectedBrand, selectedApp, text]
    );

    const loadSetsPicksStatus = useCallback(async () => {
        if (!session || !selectedBrand || !selectedApp) {
            setScreenshotSets([]);
            setActiveScreenshotSetId(null);
            setAssetPicks([]);
            setExportStatus(null);
            setsLoadedForAppRef.current = null;
            return;
        }

        try {
            const { data: setsData, error: setsError } = await fetchScreenshotSets({
                userId: session.user.id,
                appId: selectedApp.id,
            });
            if (setsError) {
                const msg = String((setsError as any)?.message || setsError);
                if (msg.toLowerCase().includes('app_screenshot_sets')) {
                    reportError(
                        `DB schema is missing screenshot set tables. Run supabase/migrations/2026-02-06_sets_picks_completion.sql in Supabase, then retry.`
                    );
                } else {
                    reportError(msg);
                }
                return;
            }

            let sets = (setsData as any as AppScreenshotSet[]) || [];
            const ensured = await ensureOriginalScreenshotSet(sets);
            sets = ensured.sets;

            // Decide active set (persisted per app).
            const lsKey = `zefgen.activeScreenshotSet.${selectedApp.id}`;
            const storedId = typeof window !== 'undefined' ? window.localStorage.getItem(lsKey) : null;
            const defaultId = storedId && sets.some((s) => s.id === storedId) ? storedId : ensured.original?.id ?? sets[0]?.id ?? null;
            if (typeof window !== 'undefined') {
                if (defaultId) window.localStorage.setItem(lsKey, defaultId);
                else window.localStorage.removeItem(lsKey);
            }

            setScreenshotSets(sets);
            setActiveScreenshotSetId(defaultId);
            setsLoadedForAppRef.current = selectedApp.id;

            // Picks + completion status.
            const [{ data: picksData, error: picksError }, { data: statusData, error: statusError }] = await Promise.all([
                fetchAssetPicks({ userId: session.user.id, appId: selectedApp.id }),
                fetchExportStatus({ userId: session.user.id, appId: selectedApp.id }),
            ]);

            if (picksError) {
                const msg = String((picksError as any)?.message || picksError);
                if (msg.toLowerCase().includes('app_asset_picks')) {
                    reportError(
                        `DB schema is missing picks tables. Run supabase/migrations/2026-02-06_sets_picks_completion.sql in Supabase, then retry.`
                    );
                } else {
                    reportError(msg);
                }
            } else {
                setAssetPicks((picksData as any as AssetPick[]) || []);
            }

            if (statusError) {
                const msg = String((statusError as any)?.message || statusError);
                if (msg.toLowerCase().includes('app_export_status')) {
                    reportError(
                        `DB schema is missing export status tables. Run supabase/migrations/2026-02-06_sets_picks_completion.sql in Supabase, then retry.`
                    );
                } else {
                    reportError(msg);
                }
                setExportStatus(null);
            } else {
                setExportStatus((statusData as any) ?? null);
            }
        } catch (error: any) {
            reportError(error?.message || 'Failed to load sets.');
        }
    }, [session, selectedBrand, selectedApp, ensureOriginalScreenshotSet, reportError]);

    useEffect(() => {
        // Reload when app changes or user changes.
        if (!session || !selectedApp?.id) return;
        if (setsLoadedForAppRef.current === selectedApp.id) return;
        loadSetsPicksStatus();
    }, [session, selectedApp?.id, loadSetsPicksStatus]);

    const selectedGeneratedAssets = useMemo(
        () => generatedAssets.filter((asset) => asset.app_id === selectedApp?.id),
        [generatedAssets, selectedApp?.id]
    );

    useEffect(() => {
        if (!session || !selectedApp?.id) return;
        if (!screenshotSets.length) return;
        if (backfillDoneForAppRef.current[selectedApp.id]) return;

        const originalName = text('set_original');
        const original =
            screenshotSets.find((s) => s.name === originalName) ??
            screenshotSets.find((s) => s.name.toLowerCase() === 'original') ??
            null;
        if (!original) return;

        const needsBackfill = selectedGeneratedAssets.some(
            (asset) =>
                (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced') &&
                (asset as any).screenshot_set_id == null
        );
        if (!needsBackfill) {
            backfillDoneForAppRef.current[selectedApp.id] = true;
            return;
        }

        backfillDoneForAppRef.current[selectedApp.id] = true;
        (async () => {
            try {
                const { error } = await bulkAssignScreenshotSetId({
                    userId: session.user.id,
                    appId: selectedApp.id,
                    screenshotSetId: original.id,
                });
                if (error) throw error;
                await refresh();
            } catch (error: any) {
                reportError(error?.message || 'Failed to backfill screenshot sets.');
            }
        })();
    }, [session, selectedApp?.id, screenshotSets, selectedGeneratedAssets, bulkAssignScreenshotSetId, refresh, reportError, text]);

    const generatedIconSlots = useMemo(() => {
        const slotMap = new Map<number, GeneratedAsset[]>();
        selectedGeneratedAssets
            .filter((asset) => asset.kind === 'icon' && asset.slot_index !== null)
            .forEach((asset) => {
                const slotIndex = asset.slot_index ?? 0;
                const existing = slotMap.get(slotIndex) || [];
                existing.push(asset);
                slotMap.set(slotIndex, existing);
            });

        // Newest slot on the left => sort slot_index descending.
        return Array.from(slotMap.entries())
            .map(([slotIndex, versions]) => ({
                slotIndex,
                versions: versions.sort((a, b) => (a.version_index ?? 1) - (b.version_index ?? 1)),
            }))
            .sort((a, b) => b.slotIndex - a.slotIndex);
    }, [selectedGeneratedAssets]);

    const activeScreenshotSet = useMemo(() => {
        if (!activeScreenshotSetId) return null;
        return screenshotSets.find((s) => s.id === activeScreenshotSetId) ?? null;
    }, [screenshotSets, activeScreenshotSetId]);

    useEffect(() => {
        if (!activeScreenshotSet) return;
        const nextCount = Math.min(6, Math.max(3, Number(activeScreenshotSet.slot_count) || 3));
        const nextSize = (activeScreenshotSet.size_label === '6.9' ? '6.9' : '6.5') as '6.5' | '6.9';
        setGenerationCount((prev) => (prev === nextCount ? prev : nextCount));
        setGenerationSize((prev) => (prev === nextSize ? prev : nextSize));
    }, [activeScreenshotSet]);

    const setActiveScreenshotSet = useCallback(
        (id: string | null) => {
            setActiveScreenshotSetId(id);
            if (typeof window !== 'undefined' && selectedApp?.id) {
                const lsKey = `zefgen.activeScreenshotSet.${selectedApp.id}`;
                if (id) window.localStorage.setItem(lsKey, id);
                else window.localStorage.removeItem(lsKey);
            }
        },
        [selectedApp?.id]
    );

    const setGenerationCountForActiveSet = useCallback(
        async (value: number) => {
            const next = Math.min(6, Math.max(3, Number(value) || 3));
            setGenerationCount(next);
            if (!session || !activeScreenshotSet) return;
            const { data, error } = await updateScreenshotSet({
                id: activeScreenshotSet.id,
                userId: session.user.id,
                patch: { slot_count: next },
            });
            if (error) {
                reportError(String((error as any)?.message || error));
                return;
            }
            if (data) {
                setScreenshotSets((prev) => prev.map((s) => (s.id === data.id ? (data as any) : s)));
            }
            await invalidateCompletion();
        },
        [session, activeScreenshotSet, reportError, invalidateCompletion]
    );

    const setGenerationSizeForActiveSet = useCallback(
        async (value: '6.5' | '6.9') => {
            const next = value === '6.9' ? '6.9' : '6.5';
            setGenerationSize(next);
            if (!session || !activeScreenshotSet) return;
            const { data, error } = await updateScreenshotSet({
                id: activeScreenshotSet.id,
                userId: session.user.id,
                patch: { size_label: next },
            });
            if (error) {
                reportError(String((error as any)?.message || error));
                return;
            }
            if (data) {
                setScreenshotSets((prev) => prev.map((s) => (s.id === data.id ? (data as any) : s)));
            }
            await invalidateCompletion();
        },
        [session, activeScreenshotSet, reportError, invalidateCompletion]
    );

    const handleAddScreenshotSet = useCallback(async () => {
        if (!session || !selectedBrand || !selectedApp) return;
        const prefix = text('set_ab_test_prefix');
        const existing = screenshotSets
            .map((s) => s.name)
            .filter((n) => typeof n === 'string' && n.startsWith(prefix))
            .map((n) => {
                const rest = n.slice(prefix.length).trim();
                const num = Number(rest);
                return Number.isFinite(num) ? num : 0;
            });
        const nextNum = (existing.length ? Math.max(...existing) : 0) + 1;
        const name = `${prefix}${nextNum}`;

        const { data, error } = await createScreenshotSet({
            user_id: session.user.id,
            brand_id: selectedBrand.id,
            app_id: selectedApp.id,
            name,
            size_label: generationSize,
            slot_count: generationCount,
            order_index: screenshotSets.length,
        });
        if (error) {
            reportError(String((error as any)?.message || error));
            return;
        }
        if (data) {
            setScreenshotSets((prev) => [...prev, data as any]);
            setActiveScreenshotSet((data as any).id);
            await invalidateCompletion();
        }
    }, [
        session,
        selectedBrand,
        selectedApp,
        screenshotSets,
        text,
        createScreenshotSet,
        setActiveScreenshotSet,
        generationSize,
        generationCount,
        reportError,
        invalidateCompletion,
    ]);

    const handleDeleteScreenshotSet = useCallback(
        async (setId: string) => {
            if (!session || !selectedBrand || !selectedApp) return;
            if (!setId) return;

            const original =
                screenshotSets.find((s) => Number((s as any).order_index) === 0) ??
                screenshotSets.find((s) => s.name === text('set_original')) ??
                screenshotSets.find((s) => s.name.toLowerCase() === 'original') ??
                null;

            if (original?.id && String(original.id) === String(setId)) {
                reportError(text('cannot_delete_original_set'));
                return;
            }

            try {
                // Delete assets belonging to the set (and their previews) so they don't fall back into "Original".
                const deletable = selectedGeneratedAssets.filter((asset) => {
                    const kindOk = asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced';
                    const setOk = String((asset as any).screenshot_set_id ?? '') === String(setId);
                    return kindOk && setOk;
                });

                const paths: string[] = [];
                for (const asset of deletable) {
                    if (!asset.image_path) continue;
                    paths.push(asset.image_path);
                    if (/\.jpg$/i.test(asset.image_path)) {
                        paths.push(asset.image_path.replace(/\.jpg$/i, '-preview.jpg'));
                    }
                }

                if (paths.length) {
                    const { error: storageError } = await removeGeneratedAssets(paths);
                    if (storageError) {
                        reportError(String((storageError as any)?.message || storageError));
                        return;
                    }
                }

                if (deletable.length) {
                    const { error: deleteAssetsError } = await deleteGeneratedAssetsByIds({
                        userId: session.user.id,
                        ids: deletable.map((a) => a.id),
                    });
                    if (deleteAssetsError) {
                        reportError(String((deleteAssetsError as any)?.message || deleteAssetsError));
                        return;
                    }
                }

                const { error: deleteSetError } = await deleteScreenshotSet({ id: setId, userId: session.user.id });
                if (deleteSetError) {
                    reportError(String((deleteSetError as any)?.message || deleteSetError));
                    return;
                }

                setScreenshotSets((prev) => prev.filter((s) => s.id !== setId));
                if (activeScreenshotSetId && String(activeScreenshotSetId) === String(setId)) {
                    const nextActive = original?.id ?? screenshotSets.find((s) => s.id !== setId)?.id ?? null;
                    setActiveScreenshotSet(nextActive);
                }

                await invalidateCompletion();
                await refresh();
                await loadSetsPicksStatus();
            } catch (err: any) {
                reportError(String(err?.message || err || 'Failed to delete set.'));
            }
        },
        [
            session,
            selectedBrand,
            selectedApp,
            selectedGeneratedAssets,
            screenshotSets,
            activeScreenshotSetId,
            text,
            reportError,
            removeGeneratedAssets,
            deleteGeneratedAssetsByIds,
            deleteScreenshotSet,
            setActiveScreenshotSet,
            invalidateCompletion,
            refresh,
            loadSetsPicksStatus,
        ]
    );

    const enhancedIconSlots = useMemo(() => {
        const slotMap = new Map<number, GeneratedAsset[]>();
        selectedGeneratedAssets
            .filter((asset) => asset.kind === 'icon_enhanced' && asset.slot_index !== null)
            .forEach((asset) => {
                const slotIndex = asset.slot_index ?? 0;
                const existing = slotMap.get(slotIndex) || [];
                existing.push(asset);
                slotMap.set(slotIndex, existing);
            });

        return Array.from(slotMap.entries())
            .map(([slotIndex, versions]) => ({
                slotIndex,
                versions: versions.sort((a, b) => (a.version_index ?? 1) - (b.version_index ?? 1)),
            }))
            .sort((a, b) => b.slotIndex - a.slotIndex);
    }, [selectedGeneratedAssets]);

    const generatedScreenshotSlots = useMemo(() => {
        const original =
            screenshotSets.find((s) => Number((s as any).order_index) === 0) ??
            screenshotSets.find((s) => s.name === text('set_original')) ??
            screenshotSets.find((s) => s.name.toLowerCase() === 'original') ??
            null;
        const isOriginalActive = Boolean(activeScreenshotSetId && original?.id && activeScreenshotSetId === original.id);

        const slotMap = new Map<number, GeneratedAsset[]>();
        selectedGeneratedAssets
            .filter(
                (asset) =>
                    asset.kind === 'screenshot' &&
                    asset.slot_index !== null &&
                    (!activeScreenshotSetId ||
                        String((asset as any).screenshot_set_id ?? '') === String(activeScreenshotSetId) ||
                        (isOriginalActive && (asset as any).screenshot_set_id == null))
            )
            .forEach((asset) => {
                const slotIndex = asset.slot_index ?? 0;
                const existing = slotMap.get(slotIndex) || [];
                existing.push(asset);
                slotMap.set(slotIndex, existing);
            });

        return Array.from(slotMap.entries())
            .map(([slotIndex, versions]) => ({
                slotIndex,
                versions: versions.sort((a, b) => (a.version_index ?? 1) - (b.version_index ?? 1)),
            }))
            .sort((a, b) => a.slotIndex - b.slotIndex);
    }, [selectedGeneratedAssets, activeScreenshotSetId, screenshotSets, text]);

    const enhancedScreenshotSlots = useMemo(() => {
        const original =
            screenshotSets.find((s) => Number((s as any).order_index) === 0) ??
            screenshotSets.find((s) => s.name === text('set_original')) ??
            screenshotSets.find((s) => s.name.toLowerCase() === 'original') ??
            null;
        const isOriginalActive = Boolean(activeScreenshotSetId && original?.id && activeScreenshotSetId === original.id);

        const slotMap = new Map<number, GeneratedAsset[]>();
        selectedGeneratedAssets
            .filter(
                (asset) =>
                    asset.kind === 'screenshot_enhanced' &&
                    asset.slot_index !== null &&
                    (!activeScreenshotSetId ||
                        String((asset as any).screenshot_set_id ?? '') === String(activeScreenshotSetId) ||
                        (isOriginalActive && (asset as any).screenshot_set_id == null))
            )
            .forEach((asset) => {
                const slotIndex = asset.slot_index ?? 0;
                const existing = slotMap.get(slotIndex) || [];
                existing.push(asset);
                slotMap.set(slotIndex, existing);
            });

        return Array.from(slotMap.entries())
            .map(([slotIndex, versions]) => ({
                slotIndex,
                versions: versions.sort((a, b) => (a.version_index ?? 1) - (b.version_index ?? 1)),
            }))
            .sort((a, b) => a.slotIndex - b.slotIndex);
    }, [selectedGeneratedAssets, activeScreenshotSetId, screenshotSets, text]);

    const getScreenshotSlotKey = useCallback(
        (slotIndex: number, screenshotSetId?: string | null) =>
            `${screenshotSetId ?? activeScreenshotSetId ?? 'none'}:${slotIndex}`,
        [activeScreenshotSetId]
    );

    const getInflightScreenshotKey = useCallback(
        (slotIndex: number, tab: 'generated' | 'enhanced', screenshotSetId?: string | null) =>
            `${getScreenshotSlotKey(slotIndex, screenshotSetId)}:${tab}`,
        [getScreenshotSlotKey]
    );

    const setInflightScreenshotPreview = useCallback(
        (slotIndex: number, tab: 'generated' | 'enhanced', url: string) => {
            if (!activeScreenshotSetId) return;
            const key = getInflightScreenshotKey(slotIndex, tab, activeScreenshotSetId);
            setInflightScreenshotPreviewByKey((prev) => ({ ...prev, [key]: url }));
        },
        [activeScreenshotSetId, getInflightScreenshotKey]
    );

    const clearInflightScreenshotPreview = useCallback(
        (slotIndex: number, tab: 'generated' | 'enhanced') => {
            if (!activeScreenshotSetId) return;
            const key = getInflightScreenshotKey(slotIndex, tab, activeScreenshotSetId);
            setInflightScreenshotPreviewByKey((prev) => {
                if (!prev[key]) return prev;
                const next = { ...prev };
                delete next[key];
                return next;
            });
        },
        [activeScreenshotSetId, getInflightScreenshotKey]
    );

    useEffect(() => {
        // Switching sets should drop any transient previews from prior set.
        setInflightScreenshotPreviewByKey({});
    }, [activeScreenshotSetId]);

    const getSystemPromptStorageKey = useCallback(
        (payload: { appId: string; screenshotSetId: string; slotIndex: number; mode: SystemPromptMode }) =>
            `zefgen.sysPrompt.${payload.appId}.${payload.screenshotSetId}.${payload.slotIndex}.${payload.mode}`,
        []
    );

    const getSlotPromptStorageKey = useCallback(
        (payload: { appId: string; screenshotSetId: string; slotIndex: number }) =>
            `zefgen.slotPrompt.${payload.appId}.${payload.screenshotSetId}.${payload.slotIndex}`,
        []
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!selectedApp?.id || !activeScreenshotSetId) return;

        const next: Record<string, { generate?: string; enhance?: string }> = {};
        for (let slotIndex = 1; slotIndex <= 6; slotIndex += 1) {
            const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
            const genKey = getSystemPromptStorageKey({
                appId: selectedApp.id,
                screenshotSetId: activeScreenshotSetId,
                slotIndex,
                mode: 'generate',
            });
            const enhKey = getSystemPromptStorageKey({
                appId: selectedApp.id,
                screenshotSetId: activeScreenshotSetId,
                slotIndex,
                mode: 'enhance',
            });
            const genRaw = window.localStorage.getItem(genKey);
            const enhRaw = window.localStorage.getItem(enhKey);
            if (genRaw || enhRaw) {
                next[key] = {
                    generate: genRaw ?? undefined,
                    enhance: enhRaw ?? undefined,
                };
            }
        }

        setSystemPromptOverridesByKey((prev) => ({ ...prev, ...next }));
    }, [selectedApp?.id, activeScreenshotSetId, getScreenshotSlotKey, getSystemPromptStorageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!selectedApp?.id || !activeScreenshotSetId) return;

        const next: Record<string, string> = {};
        for (let slotIndex = 1; slotIndex <= 6; slotIndex += 1) {
            const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
            const lsKey = getSlotPromptStorageKey({
                appId: selectedApp.id,
                screenshotSetId: activeScreenshotSetId,
                slotIndex,
            });
            const raw = window.localStorage.getItem(lsKey);
            if (typeof raw === 'string') {
                next[key] = raw;
            }
        }

        setSlotPromptBySlotKey((prev) => ({ ...prev, ...next }));
    }, [selectedApp?.id, activeScreenshotSetId, getScreenshotSlotKey, getSlotPromptStorageKey]);

    const buildDefaultSystemPrompt = useCallback(
        (payload: {
            providerId: ScreenshotProviderId;
            mode: SystemPromptMode;
            sizeLabel: '6.5' | '6.9';
            width: number;
            height: number;
        }) => {
            // Keep the prompt concise and non-contradictory.
            // Important: avoid printing explicit "1234x5678" strings; some providers will echo them as corner text.
            // We already send width/height as parameters to the generation endpoint.
            const common = [
                `Goal: an iOS App Store screenshot ready to upload to App Store Connect.`,
                `Image 1 is the layout source of truth: preserve the UI exactly (same scale, positions, spacing, and readability).`,
                `If the iOS status bar exists in image 1, keep it exactly as-is (do not remove or rewrite).`,
                `Image 2 is style only: use it for colors/lighting/background mood, but do not change the UI geometry from image 1.`,
                `Keep a clean empty header band at the top (empty background for later text). Do NOT move/enlarge the UI upward to fill it.`,
                `No device frames/mockups/hands/bezels/floating phones.`,
                `No added text anywhere: no headlines, captions, badges, stickers, labels, logos, watermarks, or any extra UI.`,
                `Never print any resolution/metadata text anywhere.`,
                `Match the requested output size and aspect ratio exactly (full-bleed, no padding).`,
                `Keep it sharp and clean (no blur, no artifacts).`,
            ].join(' ');

            if (payload.mode === 'generate') {
                return common;
            }

            // enhance
            return [
                `Goal: enhance image 1 into an iOS App Store screenshot ready to upload.`,
                `Preserve image 1 layout exactly: same UI scale, same composition, same spacing, same content.`,
                `If the iOS status bar exists in image 1, keep it exactly as-is.`,
                `Image 2 is style only: colors/lighting/background mood; do not change UI geometry.`,
                `Keep the top header band empty (do not move/enlarge the UI upward).`,
                `No added text, logos, or watermarks. Never print resolution/metadata text.`,
                `Match the requested output size and aspect ratio exactly (full-bleed, no padding).`,
                `Keep it sharp and clean.`,
            ].join(' ');
        },
        []
    );

    const getSystemPromptForSlot = useCallback(
        (slotIndex: number, mode: SystemPromptMode) => {
            const setId = activeScreenshotSetId;
            if (!selectedApp?.id || !setId) {
                const size = SCREENSHOT_SIZES[generationSize];
                const defaultPrompt = buildDefaultSystemPrompt({
                    providerId: screenshotProviderId,
                    mode,
                    sizeLabel: generationSize,
                    width: size.width,
                    height: size.height,
                });
                return { defaultPrompt, effectivePrompt: defaultPrompt, isOverridden: false };
            }

            const size = SCREENSHOT_SIZES[generationSize];
            const defaultPrompt = buildDefaultSystemPrompt({
                providerId: screenshotProviderId,
                mode,
                sizeLabel: generationSize,
                width: size.width,
                height: size.height,
            });
            const key = getScreenshotSlotKey(slotIndex, setId);
            const override = systemPromptOverridesByKey[key]?.[mode];
            return {
                defaultPrompt,
                effectivePrompt: typeof override === 'string' && override.length ? override : defaultPrompt,
                isOverridden: Boolean(typeof override === 'string' && override.length),
            };
        },
        [
            activeScreenshotSetId,
            selectedApp?.id,
            generationSize,
            screenshotProviderId,
            getScreenshotSlotKey,
            systemPromptOverridesByKey,
            buildDefaultSystemPrompt,
        ]
    );

    const setSystemPromptOverride = useCallback(
        (slotIndex: number, mode: SystemPromptMode, value: string) => {
            if (!selectedApp?.id || !activeScreenshotSetId) return;
            const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
            setSystemPromptOverridesByKey((prev) => ({
                ...prev,
                [key]: { ...(prev[key] ?? {}), [mode]: value },
            }));
            if (typeof window !== 'undefined') {
                const lsKey = getSystemPromptStorageKey({
                    appId: selectedApp.id,
                    screenshotSetId: activeScreenshotSetId,
                    slotIndex,
                    mode,
                });
                window.localStorage.setItem(lsKey, value);
            }
        },
        [selectedApp?.id, activeScreenshotSetId, getScreenshotSlotKey, getSystemPromptStorageKey]
    );

    const resetSystemPromptOverride = useCallback(
        (slotIndex: number, mode: SystemPromptMode) => {
            if (!selectedApp?.id || !activeScreenshotSetId) return;
            const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
            setSystemPromptOverridesByKey((prev) => ({
                ...prev,
                [key]: { ...(prev[key] ?? {}), [mode]: undefined },
            }));
            if (typeof window !== 'undefined') {
                const lsKey = getSystemPromptStorageKey({
                    appId: selectedApp.id,
                    screenshotSetId: activeScreenshotSetId,
                    slotIndex,
                    mode,
                });
                window.localStorage.removeItem(lsKey);
            }
        },
        [selectedApp?.id, activeScreenshotSetId, getScreenshotSlotKey, getSystemPromptStorageKey]
    );

    const setSlotPrompt = useCallback(
        (slotIndex: number, value: string) => {
            if (!selectedApp?.id || !activeScreenshotSetId) return;
            const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
            setSlotPromptBySlotKey((prev) => ({ ...prev, [key]: value }));
            if (typeof window !== 'undefined') {
                const lsKey = getSlotPromptStorageKey({
                    appId: selectedApp.id,
                    screenshotSetId: activeScreenshotSetId,
                    slotIndex,
                });
                if (String(value || '').trim().length) {
                    window.localStorage.setItem(lsKey, value);
                } else {
                    window.localStorage.removeItem(lsKey);
                }
            }
        },
        [selectedApp?.id, activeScreenshotSetId, getScreenshotSlotKey, getSlotPromptStorageKey]
    );

    const deriveSlotHeadlineBySlotKey = useMemo(() => {
        const original =
            screenshotSets.find((s) => Number((s as any).order_index) === 0) ??
            screenshotSets.find((s) => s.name === text('set_original')) ??
            screenshotSets.find((s) => s.name.toLowerCase() === 'original') ??
            null;
        const isOriginalActive = Boolean(activeScreenshotSetId && original?.id && activeScreenshotSetId === original.id);

        const candidates = selectedGeneratedAssets.filter((asset) => {
            const kindOk = asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced';
            const slotOk = asset.slot_index !== null;
            const setOk =
                !activeScreenshotSetId ||
                String((asset as any).screenshot_set_id ?? '') === String(activeScreenshotSetId);
            const legacyOriginalOk = Boolean(isOriginalActive && (asset as any).screenshot_set_id == null);
            return kindOk && slotOk && (setOk || legacyOriginalOk);
        });

        const bySlot: Record<number, { text: string; kind: ScreenshotKind; createdAt: number }> = {};
        for (const asset of candidates) {
            const slotIndex = asset.slot_index ?? 0;
            const layers = (asset.edit_state as any)?.layers;
            const textValue = Array.isArray(layers) ? layers?.[0]?.text : null;
            if (typeof textValue !== 'string') continue;

            const createdAt = asset.created_at ? new Date(asset.created_at).getTime() : 0;
            const kind = asset.kind as ScreenshotKind;
            const existing = bySlot[slotIndex];
            if (!existing) {
                bySlot[slotIndex] = { text: textValue, kind, createdAt };
                continue;
            }

            // Prefer generated screenshots as the source of truth when both exist.
            if (existing.kind === kind) {
                if (createdAt >= existing.createdAt) bySlot[slotIndex] = { text: textValue, kind, createdAt };
                continue;
            }
            if (existing.kind === 'screenshot') continue;
            if (kind === 'screenshot') bySlot[slotIndex] = { text: textValue, kind, createdAt };
        }

        const result: Record<string, string> = {};
        for (const [slotIndex, payload] of Object.entries(bySlot)) {
            result[getScreenshotSlotKey(Number(slotIndex), activeScreenshotSetId)] = payload.text;
        }
        return result;
    }, [selectedGeneratedAssets, activeScreenshotSetId, screenshotSets, text, getScreenshotSlotKey]);

    const deriveSlotHeadlinePosBySlotKey = useMemo(() => {
        const original =
            screenshotSets.find((s) => Number((s as any).order_index) === 0) ??
            screenshotSets.find((s) => s.name === text('set_original')) ??
            screenshotSets.find((s) => s.name.toLowerCase() === 'original') ??
            null;
        const isOriginalActive = Boolean(activeScreenshotSetId && original?.id && activeScreenshotSetId === original.id);

        const candidates = selectedGeneratedAssets.filter((asset) => {
            const kindOk = asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced';
            const slotOk = asset.slot_index !== null;
            const setOk =
                !activeScreenshotSetId ||
                String((asset as any).screenshot_set_id ?? '') === String(activeScreenshotSetId);
            const legacyOriginalOk = Boolean(isOriginalActive && (asset as any).screenshot_set_id == null);
            return kindOk && slotOk && (setOk || legacyOriginalOk);
        });

        const bySlot: Record<number, { x: number; y: number; kind: ScreenshotKind; createdAt: number }> = {};
        for (const asset of candidates) {
            const slotIndex = asset.slot_index ?? 0;
            const layers = (asset.edit_state as any)?.layers;
            const layer0 = Array.isArray(layers) ? layers?.[0] : null;
            const xValue = layer0?.x;
            const yValue = layer0?.y;
            if (typeof xValue !== 'number' || typeof yValue !== 'number') continue;

            const createdAt = asset.created_at ? new Date(asset.created_at).getTime() : 0;
            const kind = asset.kind as ScreenshotKind;
            const existing = bySlot[slotIndex];
            if (!existing) {
                bySlot[slotIndex] = { x: xValue, y: yValue, kind, createdAt };
                continue;
            }

            // Prefer generated screenshots as the source of truth when both exist.
            if (existing.kind === kind) {
                if (createdAt >= existing.createdAt) bySlot[slotIndex] = { x: xValue, y: yValue, kind, createdAt };
                continue;
            }
            if (existing.kind === 'screenshot') continue;
            if (kind === 'screenshot') bySlot[slotIndex] = { x: xValue, y: yValue, kind, createdAt };
        }

        const result: Record<string, { x: number; y: number }> = {};
        for (const [slotIndex, payload] of Object.entries(bySlot)) {
            result[getScreenshotSlotKey(Number(slotIndex), activeScreenshotSetId)] = { x: payload.x, y: payload.y };
        }
        return result;
    }, [selectedGeneratedAssets, activeScreenshotSetId, screenshotSets, text, getScreenshotSlotKey]);

    useEffect(() => {
        if (!selectedApp?.id) return;
        setSlotHeadlineBySlotKey((prev) => ({ ...prev, ...deriveSlotHeadlineBySlotKey }));
        setSlotHeadlinePosBySlotKey((prev) => ({ ...prev, ...deriveSlotHeadlinePosBySlotKey }));
    }, [selectedApp?.id, activeScreenshotSetId, deriveSlotHeadlineBySlotKey, deriveSlotHeadlinePosBySlotKey]);

    useEffect(() => {
        if (!session?.user.id) {
            setGeneratedUrls({});
            setGeneratedPreviewUrls({});
            return;
        }

        let isMounted = true;
        const loadUrls = async () => {
            const entries = await Promise.all(
                generatedAssets
                    .filter((asset) => asset.image_path)
                    .map(async (asset) => {
                        try {
                            const url = await getSignedUrl(GENERATED_BUCKET, asset.image_path);
                            let previewUrl = '';
                            if (
                                (asset.kind === 'screenshot' ||
                                    asset.kind === 'screenshot_enhanced' ||
                                    asset.kind === 'icon' ||
                                    asset.kind === 'icon_enhanced') &&
                                /\.jpg$/i.test(String(asset.image_path))
                            ) {
                                const previewPath = String(asset.image_path).replace(/\.jpg$/i, '-preview.jpg');
                                try {
                                    previewUrl = await getSignedUrl(GENERATED_BUCKET, previewPath);
                                } catch {
                                    // Older assets won't have previews; silently fall back to full.
                                }
                            }

                            return [asset.id, url, previewUrl] as const;
                        } catch (error: any) {
                            reportError(error.message);
                            return [asset.id, '', ''] as const;
                        }
                    })
            );

            if (!isMounted) return;
            setGeneratedUrls((prev) => {
                const nextUrls = { ...prev };
                entries.forEach(([id, url]) => {
                    if (url) nextUrls[id] = url;
                });
                return nextUrls;
            });
            setGeneratedPreviewUrls((prev) => {
                const nextUrls = { ...prev };
                entries.forEach(([id, _url, previewUrl]) => {
                    if (previewUrl) nextUrls[id] = previewUrl;
                });
                return nextUrls;
            });
        };

        loadUrls();
        return () => {
            isMounted = false;
        };
    }, [session?.user.id, generatedAssets, getSignedUrl, reportError]);

    const resolveGeneratedUrl = async (asset: GeneratedAsset) =>
        generatedUrls[asset.id] ?? (await getSignedUrl(GENERATED_BUCKET, asset.image_path));

    const formatSlotIndex = (value: number) => String(value).padStart(2, '0');

    const handleDownloadGeneratedAsset = async (asset: GeneratedAsset, filename: string) => {
        try {
            const url = await resolveGeneratedUrl(asset);
            if (asset.kind !== 'screenshot' && asset.kind !== 'screenshot_enhanced') {
                // Safari/cross-origin often ignores <a download> for remote URLs.
                await downloadUrlAsFile({ url, filename });
                return;
            }

            const sizeLabel = (asset.size_label as '6.5' | '6.9' | null) ?? '6.5';
            const fallbackSize = SCREENSHOT_SIZES[sizeLabel === '6.9' ? '6.9' : '6.5'];
            const width = asset.width ?? fallbackSize.width;
            const height = asset.height ?? fallbackSize.height;
            const layers = getEffectiveLayersForScreenshotAsset(asset);

            const file = await renderImageUrlWithLayersToJpeg({ url, width, height, layers });
            downloadBlob(file, filename);
        } catch (error: any) {
            reportError(error.message || text('download_failed'));
        }
    };

    const pickLatest = (versions: GeneratedAsset[]) => {
        if (!versions.length) return null;
        return versions.reduce((prev, current) => {
            const prevIndex = prev.version_index ?? 1;
            const currentIndex = current.version_index ?? 1;
            return currentIndex > prevIndex ? current : prev;
        }, versions[0]);
    };

    const sanitizeFilenamePart = (value: string) =>
        String(value || '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^a-z0-9 _.-]+/gi, '')
            .replace(/\s/g, '-')
            .slice(0, 60) || 'set';

    const handleDownloadScreenshotSetZip = async (payload: { setId: string; preferPicks?: boolean }) => {
        if (!selectedApp) return;
        const set = screenshotSets.find((s) => s.id === payload.setId) ?? null;
        if (!set) return;

        const slotCount = Math.min(6, Math.max(3, Number(set.slot_count) || 3));
        const preferPicks = Boolean(payload.preferPicks);

        const bySlot = (kind: 'screenshot' | 'screenshot_enhanced') => {
            const map = new Map<number, GeneratedAsset[]>();
            for (const asset of selectedGeneratedAssets) {
                if (asset.kind !== kind) continue;
                if (asset.slot_index == null) continue;
                if (String((asset as any).screenshot_set_id ?? '') !== String(set.id)) continue;
                const slot = asset.slot_index ?? 0;
                const existing = map.get(slot) ?? [];
                existing.push(asset);
                map.set(slot, existing);
            }
            for (const [slot, versions] of map.entries()) {
                map.set(
                    slot,
                    [...versions].sort((a, b) => (a.version_index ?? 1) - (b.version_index ?? 1))
                );
            }
            return map;
        };

        const enhBySlot = bySlot('screenshot_enhanced');
        const genBySlot = bySlot('screenshot');

        const items: Array<{ slotIndex: number; asset: GeneratedAsset }> = [];
        for (let slotIndex = 1; slotIndex <= slotCount; slotIndex += 1) {
            if (preferPicks) {
                const pickId = pickedScreenshotAssetIdBySetSlot[`${set.id}:${slotIndex}`];
                const pickedAsset = pickId ? selectedGeneratedAssets.find((a) => a.id === pickId) ?? null : null;
                if (pickedAsset) {
                    items.push({ slotIndex, asset: pickedAsset });
                } else {
                    reportError(text('need_picks_to_complete'));
                    return;
                }
            } else {
                const chosen =
                    pickLatest(enhBySlot.get(slotIndex) ?? []) ?? pickLatest(genBySlot.get(slotIndex) ?? []);
                if (chosen) items.push({ slotIndex, asset: chosen });
            }
        }

        if (!items.length) return;

        const jobId = createJob({
            title: `Download ${set.name} zip`,
            kind: 'download_zip',
            progressTotal: items.length,
        });

        try {
            const { default: JSZip } = await import('jszip');
            const zip = new JSZip();

            for (let i = 0; i < items.length; i += 1) {
                const { slotIndex, asset } = items[i];
                setJobProgress(jobId, { current: i, total: items.length });
                setJobMessage(jobId, `Rendering slot ${slotIndex}`);

                const url = await resolveGeneratedUrl(asset);
                const sizeLabel = (set.size_label as '6.5' | '6.9') ?? generationSize;
                const fallbackSize = SCREENSHOT_SIZES[sizeLabel === '6.9' ? '6.9' : '6.5'];
                const width = asset.width ?? fallbackSize.width;
                const height = asset.height ?? fallbackSize.height;
                const layers = getEffectiveLayersForScreenshotAsset(asset);
                const file = await renderImageUrlWithLayersToJpeg({ url, width, height, layers });

                const name = `iOS ${sizeLabel} ${slotIndex}.jpg`;
                zip.file(name, file);
            }

            setJobProgress(jobId, { current: items.length, total: items.length });
            setJobMessage(jobId, 'Packaging zip');
            const blob = await zip.generateAsync({ type: 'blob' });

            const zipName = `${selectedApp.alias || 'app'}-${sanitizeFilenamePart(set.name)}-screenshots.zip`;
            downloadBlob(blob, zipName);

            finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            finishJob(jobId, { status: 'error', message: String(error?.message || 'ZIP failed').slice(0, 200) });
            reportError(error.message || text('download_failed'));
        }
    };

    const handleDownloadAllScreenshots = async () => {
        if (!activeScreenshotSetId) return;
        const preferPicks = Boolean(exportStatus?.is_completed);
        await handleDownloadScreenshotSetZip({ setId: activeScreenshotSetId, preferPicks });
    };

    const createDefaultLayer = () => ({
        id: createId(),
        text: text('text_layer_default'),
        font: EDIT_FONTS[0],
        size: 36,
        color: '#ffffff',
        x: 50,
        y: 18,
        rotation: 0,
        align: 'center' as const,
        weight: 600,
        shadow: { enabled: true, color: '#000000', blur: 14, offsetX: 0, offsetY: 8 },
        outline: { enabled: false, color: '#000000', width: 3 },
    });

    const createHeadlineLayer = (headlineText: string, position?: { x: number; y: number }) => ({
        id: createId(),
        text: headlineText,
        font: EDIT_FONTS[0],
        size: 40,
        color: '#ffffff',
        x: position?.x ?? 50,
        y: position?.y ?? 12,
        rotation: 0,
        align: 'center' as const,
        weight: 700,
        shadow: { enabled: true, color: '#000000', blur: 14, offsetX: 0, offsetY: 8 },
        outline: { enabled: false, color: '#000000', width: 3 },
    });

    const cloneLayers = (layers: unknown): TextLayer[] => {
        try {
            return JSON.parse(JSON.stringify(layers ?? []));
        } catch {
            return [];
        }
    };

    const getCarryForwardLayersForSlot = (slotIndex: number, screenshotSetId?: string | null) => {
        const setId = screenshotSetId ?? activeScreenshotSetId;
        if (!setId) return null;
        const candidates = selectedGeneratedAssets
            .filter(
                (asset) =>
                    (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced') &&
                    (asset.slot_index ?? 0) === slotIndex &&
                    String((asset as any).screenshot_set_id ?? '') === String(setId)
            )
            .sort((a, b) => {
                const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                return bTime - aTime;
            });

        for (const asset of candidates) {
            const layers = (asset.edit_state as any)?.layers;
            if (Array.isArray(layers) && layers.length) return cloneLayers(layers);
        }
        return null;
    };

    const persistSlotHeadlineState = async (slotIndex: number, headline: TextLayer) => {
        if (!session || !activeScreenshotSetId) return;
        const assetsToUpdate = selectedGeneratedAssets.filter(
            (asset) =>
                (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced') &&
                (asset.slot_index ?? 0) === slotIndex &&
                String((asset as any).screenshot_set_id ?? '') === String(activeScreenshotSetId)
        );
        if (!assetsToUpdate.length) return;

        const updates = await Promise.all(
            assetsToUpdate.map(async (asset) => {
                const storedLayers = (asset.edit_state as any)?.layers;
                // Important: headline autosave must NOT persist unrelated unsaved draft edits.
                // Always base the DB write on stored layers, and patch only layer[0].
                const layers = cloneLayers(storedLayers ?? []);
                const storedFirst = layers[0] ?? null;
                const next = storedFirst
                    ? {
                          ...storedFirst,
                          ...headline,
                          shadow: (headline as any).shadow
                              ? { ...(storedFirst as any).shadow, ...(headline as any).shadow }
                              : (storedFirst as any).shadow,
                          outline: (headline as any).outline
                              ? { ...(storedFirst as any).outline, ...(headline as any).outline }
                              : (storedFirst as any).outline,
                          id: storedFirst.id,
                      }
                    : createHeadlineLayer(String((headline as any)?.text ?? ''), {
                          x: typeof (headline as any)?.x === 'number' ? (headline as any).x : 50,
                          y: typeof (headline as any)?.y === 'number' ? (headline as any).y : 12,
                      });
                if (!layers.length) layers.push(next);
                else layers[0] = next;

                setEditDrafts((prev) => {
                    const existing = prev[asset.id];
                    if (!existing) return prev;
                    const nextDraftLayers = cloneLayers(existing.layers ?? []);
                    const draftFirst = nextDraftLayers[0] ?? null;
                    const nextDraft = draftFirst
                        ? {
                              ...draftFirst,
                              ...headline,
                              shadow: (headline as any).shadow
                                  ? { ...(draftFirst as any).shadow, ...(headline as any).shadow }
                                  : (draftFirst as any).shadow,
                              outline: (headline as any).outline
                                  ? { ...(draftFirst as any).outline, ...(headline as any).outline }
                                  : (draftFirst as any).outline,
                              id: draftFirst.id,
                          }
                        : createHeadlineLayer(String((headline as any)?.text ?? ''), {
                              x: typeof (headline as any)?.x === 'number' ? (headline as any).x : 50,
                              y: typeof (headline as any)?.y === 'number' ? (headline as any).y : 12,
                          });
                    if (!nextDraftLayers.length) nextDraftLayers.push(nextDraft);
                    else nextDraftLayers[0] = nextDraft;
                    return { ...prev, [asset.id]: { ...existing, layers: nextDraftLayers } };
                });

                const { data, error } = await updateGeneratedAsset({
                    id: asset.id,
                    userId: session.user.id,
                    patch: { edit_state: { layers } },
                });
                if (error) throw error;
                return data;
            })
        );

        const nextById = new Map((updates || []).filter(Boolean).map((a: any) => [a.id, a]));
        setGeneratedAssets((prev) => prev.map((asset) => nextById.get(asset.id) ?? asset));
    };

    const getSlotHeadlineState = (slotIndex: number) => {
        const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
        const textValue = slotHeadlineBySlotKey[key] ?? '';
        const pos = slotHeadlinePosBySlotKey[key];
        const x = typeof pos?.x === 'number' ? pos.x : 50;
        const y = typeof pos?.y === 'number' ? pos.y : 12;
        return { text: textValue, x, y };
    };

    const schedulePersistSlotHeadline = (slotIndex: number, headline: TextLayer) => {
        const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
        if (headlineSaveTimersRef.current[key]) {
            clearTimeout(headlineSaveTimersRef.current[key]);
        }
        headlineSaveTimersRef.current[key] = setTimeout(() => {
            persistSlotHeadlineState(slotIndex, headline).catch((error: any) => {
                reportError(error.message || text('generation_failed'));
            });
        }, 500);
    };

    const pushHeadlineHistory = (slotIndex: number, prev: { text: string; x: number; y: number }) => {
        const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
        const existing = slotHeadlineHistoryRef.current[key] ?? { undo: [], redo: [] };
        const last = existing.undo[existing.undo.length - 1];
        const isSameAsLast =
            last &&
            last.text === prev.text &&
            Math.abs(last.x - prev.x) < 0.001 &&
            Math.abs(last.y - prev.y) < 0.001;
        if (!isSameAsLast) {
            existing.undo = [...existing.undo, prev].slice(-50);
        }
        existing.redo = [];
        slotHeadlineHistoryRef.current[key] = existing;
    };

    const applyHeadlineState = (slotIndex: number, next: { text: string; x: number; y: number }, opts?: { pushHistory?: boolean }) => {
        const prev = getSlotHeadlineState(slotIndex);
        if (opts?.pushHistory !== false) {
            pushHeadlineHistory(slotIndex, prev);
        }

        const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
        setSlotHeadlineBySlotKey((p) => ({ ...p, [key]: next.text }));
        setSlotHeadlinePosBySlotKey((p) => ({ ...p, [key]: { x: next.x, y: next.y } }));
        const baseLayer = slotHeadlineLayerBySlotKey[key] ?? createHeadlineLayer(next.text, { x: next.x, y: next.y });
        const mergedLayer: TextLayer = { ...baseLayer, text: next.text, x: next.x, y: next.y, id: baseLayer.id };
        setSlotHeadlineLayerBySlotKey((p) => ({ ...p, [key]: mergedLayer }));
        schedulePersistSlotHeadline(slotIndex, mergedLayer);
    };

    const setSlotHeadline = (slotIndex: number, headlineText: string, opts?: { pushHistory?: boolean }) => {
        const prev = getSlotHeadlineState(slotIndex);
        applyHeadlineState(slotIndex, { ...prev, text: headlineText }, opts);
    };

    const setSlotHeadlinePosition = (
        slotIndex: number,
        pos: { x: number; y: number },
        opts?: { pushHistory?: boolean }
    ) => {
        const prev = getSlotHeadlineState(slotIndex);
        applyHeadlineState(slotIndex, { ...prev, x: pos.x, y: pos.y }, opts);
    };

    const beginSlotHeadlineDrag = (slotIndex: number) => {
        pushHeadlineHistory(slotIndex, getSlotHeadlineState(slotIndex));
    };

    const beginSlotHeadlineTextEdit = (slotIndex: number) => {
        pushHeadlineHistory(slotIndex, getSlotHeadlineState(slotIndex));
    };

    const undoSlotHeadline = (slotIndex: number) => {
        const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
        const history = slotHeadlineHistoryRef.current[key];
        if (!history?.undo?.length) return;
        const prev = history.undo[history.undo.length - 1];
        const current = getSlotHeadlineState(slotIndex);
        history.undo = history.undo.slice(0, -1);
        history.redo = [...history.redo, current].slice(-50);
        slotHeadlineHistoryRef.current[key] = history;
        applyHeadlineState(slotIndex, prev, { pushHistory: false });
    };

    const redoSlotHeadline = (slotIndex: number) => {
        const key = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
        const history = slotHeadlineHistoryRef.current[key];
        if (!history?.redo?.length) return;
        const next = history.redo[history.redo.length - 1];
        const current = getSlotHeadlineState(slotIndex);
        history.redo = history.redo.slice(0, -1);
        history.undo = [...history.undo, current].slice(-50);
        slotHeadlineHistoryRef.current[key] = history;
        applyHeadlineState(slotIndex, next, { pushHistory: false });
    };

    const getEffectiveLayersForScreenshotAsset = (asset: GeneratedAsset) => {
        const baseLayers =
            editDrafts[asset.id]?.layers ??
            ((asset.edit_state as any)?.layers as TextLayer[] | undefined) ??
            [];
        const layers = cloneLayers(baseLayers);

        const slotIndex = asset.slot_index ?? 0;
        const setId = (asset as any).screenshot_set_id ?? activeScreenshotSetId;
        const key = getScreenshotSlotKey(slotIndex, setId);
        const headlineText = slotHeadlineBySlotKey[key] ?? (layers[0]?.text ?? '');
        const headlinePos = slotHeadlinePosBySlotKey[key] ?? { x: layers[0]?.x ?? 50, y: layers[0]?.y ?? 12 };
        const canonical = slotHeadlineLayerBySlotKey[key] ?? layers[0] ?? createHeadlineLayer(headlineText, headlinePos);
        const id = layers[0]?.id ?? canonical.id;
        const nextHeadline = { ...canonical, text: headlineText, x: headlinePos.x, y: headlinePos.y, id };
        if (!layers.length) layers.push(nextHeadline);
        else layers[0] = nextHeadline;
        return layers;
    };

    const beginEditAsset = (asset: GeneratedAsset) => {
        setEditAssetId(asset.id);
        setEditDrafts((prev) => {
            if (prev[asset.id]) return prev;
            return {
                ...prev,
                [asset.id]: asset.edit_state ?? { layers: [createDefaultLayer()] },
            };
        });
    };

    const updateLayer = (assetId: string, layerId: string, patch: Partial<TextLayer>) => {
        const asset = selectedGeneratedAssets.find((a) => a.id === assetId) || null;
        const isScreenshotAsset =
            asset && (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced');
        const layer0Id =
            (editDrafts[assetId]?.layers?.[0]?.id as any) ??
            ((asset?.edit_state as any)?.layers?.[0]?.id as any) ??
            null;
        const isHeadlineLayer = Boolean(isScreenshotAsset && layer0Id && String(layer0Id) === String(layerId));

        if (isHeadlineLayer && asset) {
            const slotIndex = asset.slot_index ?? 0;
            const setId = (asset as any).screenshot_set_id ?? activeScreenshotSetId;
            const key = getScreenshotSlotKey(slotIndex, setId);

            // Merge headline edits into the slot-level canonical layer so style doesn't "reset" between versions.
            setSlotHeadlineLayerBySlotKey((prev) => {
                const base = prev[key] ?? (cloneLayers((asset.edit_state as any)?.layers ?? [])[0] ?? createHeadlineLayer('', { x: 50, y: 12 }));
                const merged: TextLayer = {
                    ...base,
                    ...patch,
                    shadow: (patch as any).shadow ? { ...(base as any).shadow, ...(patch as any).shadow } : (base as any).shadow,
                    outline: (patch as any).outline ? { ...(base as any).outline, ...(patch as any).outline } : (base as any).outline,
                    id: base.id,
                } as any;
                return { ...prev, [key]: merged };
            });

            if (typeof patch.text === 'string') {
                setSlotHeadlineBySlotKey((p) => ({ ...p, [key]: patch.text as string }));
            }
            if (typeof patch.x === 'number' || typeof patch.y === 'number') {
                setSlotHeadlinePosBySlotKey((p) => {
                    const existing = p[key] ?? { x: 50, y: 12 };
                    return {
                        ...p,
                        [key]: {
                            x: typeof patch.x === 'number' ? patch.x : existing.x,
                            y: typeof patch.y === 'number' ? patch.y : existing.y,
                        },
                    };
                });
            }

            // Debounced DB write based on stored layers only (avoids committing unrelated drafts).
            // We persist the full headline layer so style stays consistent across versions.
            const nextText = typeof patch.text === 'string' ? patch.text : (slotHeadlineBySlotKey[key] ?? '');
            const nextPos = slotHeadlinePosBySlotKey[key] ?? { x: 50, y: 12 };
            const baseLayer = slotHeadlineLayerBySlotKey[key] ?? createHeadlineLayer(nextText, nextPos);
            const nextLayer: any = {
                ...baseLayer,
                ...patch,
                shadow: (patch as any).shadow ? { ...(baseLayer as any).shadow, ...(patch as any).shadow } : (baseLayer as any).shadow,
                outline: (patch as any).outline ? { ...(baseLayer as any).outline, ...(patch as any).outline } : (baseLayer as any).outline,
                text: nextText,
                x: typeof patch.x === 'number' ? patch.x : nextPos.x,
                y: typeof patch.y === 'number' ? patch.y : nextPos.y,
                id: baseLayer.id,
            };
            schedulePersistSlotHeadline(slotIndex, nextLayer);
        }

        setEditDrafts((prev) => {
            const draft = prev[assetId];
            if (!draft) return prev;
            return {
                ...prev,
                [assetId]: {
                    ...draft,
                    layers: draft.layers.map((layer) =>
                        layer.id === layerId ? { ...layer, ...patch } : layer
                    ),
                },
            };
        });
    };

    const addLayer = (assetId: string) => {
        setEditDrafts((prev) => {
            const draft = prev[assetId] ?? { layers: [] };
            return {
                ...prev,
                [assetId]: {
                    ...draft,
                    layers: [...draft.layers, createDefaultLayer()],
                },
            };
        });
    };

    const removeLayer = (assetId: string, layerId: string) => {
        setEditDrafts((prev) => {
            const draft = prev[assetId];
            if (!draft) return prev;
            const nextLayers = draft.layers.filter((layer) => layer.id !== layerId);
            return {
                ...prev,
                [assetId]: {
                    ...draft,
                    layers: nextLayers.length ? nextLayers : [createDefaultLayer()],
                },
            };
        });
    };

    const resetEditDraft = (asset: GeneratedAsset) => {
        setEditDrafts((prev) => ({
            ...prev,
            [asset.id]: asset.edit_state ?? { layers: [createDefaultLayer()] },
        }));
        setEditAssetId(null);
    };

    const handleSaveEdit = async (assetId: string) => {
        if (!session) return;
        const draft = editDrafts[assetId];
        if (!draft) return;
        setEditSaving(assetId);
        const { data, error } = await updateGeneratedAsset({
            id: assetId,
            userId: session.user.id,
            patch: { edit_state: draft },
        });
        if (error) {
            reportError(error.message);
        } else if (data) {
            setGeneratedAssets((prev) => prev.map((asset) => (asset.id === data.id ? data : asset)));
            setEditAssetId(null);
        }
        setEditSaving(null);
    };

    const handleDeleteGeneratedAsset = async (asset: GeneratedAsset) => {
        if (!session) return;
        const { error } = await deleteGeneratedAsset({ id: asset.id, userId: session.user.id });
        if (error) {
            reportError(error.message);
            return;
        }
        if (asset.image_path) {
            const paths = [asset.image_path];
            if (/\.jpg$/i.test(asset.image_path)) {
                paths.push(asset.image_path.replace(/\.jpg$/i, '-preview.jpg'));
            }
            try {
                await removeGeneratedAssets(paths);
            } catch {
                // Ignore missing preview objects; storage state may be out-of-sync for older assets.
            }
        }
        setGeneratedAssets((prev) => prev.filter((item) => item.id !== asset.id));
        if (editAssetId === asset.id) {
            setEditAssetId(null);
        }
    };

    const handleGenerateIcon = async () => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!brandIconReference) {
            reportError(text('need_icon_reference'));
            return;
        }

        setIconGenerating(true);

        try {
            const iconUrl =
                brandRefUrls[brandIconReference.id] ??
                (await getSignedUrl(BRAND_BUCKET, brandIconReference.image_path));

            const basePrompt = [
                `Create an App Store-ready iOS app icon (ready to submit).`,
                `Use image 1 as the reference for the core motif/subject and overall composition.`,
                `Keep the icon centered, balanced, crisp, and high quality.`,
                `No text, no letters, no numbers, no words, no slogans.`,
                `No watermarks, no provider marks.`,
                `No device frame, no screenshots, no UI elements.`,
                `Output must be a single square image at EXACTLY 1024x1024 pixels.`,
            ].join(' ');
            const userPrompt = String(brandIconReference.prompt ?? '').trim();
            const prompt = userPrompt ? `${basePrompt}\n\n${userPrompt}` : basePrompt;

            const existingIconLike = selectedGeneratedAssets.filter(
                (asset) =>
                    (asset.kind === 'icon' || asset.kind === 'icon_enhanced') &&
                    asset.slot_index !== null
            );
            const maxSlotIndex = existingIconLike.length
                ? Math.max(...existingIconLike.map((a) => a.slot_index ?? 0))
                : 0;
            const variations = Math.max(1, Math.min(3, Number(iconVariationsCount) || 1));

            const jobId = createJob({
                title: 'Generate icon',
                kind: 'icon_generate',
                providerId: iconProviderId,
                progressTotal: variations,
            });
            const controller = new AbortController();
            abortByJobIdRef.current[jobId] = controller;
            const eta =
                iconProviderId === 'replicate:seedream-4'
                    ? 'Dream ETA ~40s'
                    : iconProviderId === 'replicate:nano-banana-pro'
                        ? 'Nano ETA ~2m'
                        : 'Giga ETA ~2m';
            setJobMessage(jobId, `${eta} · generating`);

            const failed: number[] = [];
            for (let i = 0; i < variations; i += 1) {
                if (controller.signal.aborted) break;
                const slotIndex = maxSlotIndex + 1 + i;
                setIconSlotGenerating(slotIndex);
                try {
                    setJobProgress(jobId, { current: i, total: variations });
                    setJobMessage(jobId, `${eta} · Variation ${i + 1}/${variations}`);

                    const result = await requestGeneratedScreenshot({
                        providerId: iconProviderId,
                        prompt,
                        simulatorImageUrl: iconUrl,
                        brandRefImageUrl: iconUrl,
                        width: 1024,
                        height: 1024,
                        signal: controller.signal,
                    });

                    let blob: Blob;
                    if (result.kind === 'url') {
                        const resp = await fetch(result.outputUrl, { signal: controller.signal });
                        if (!resp.ok) throw new Error(`Failed to fetch provider output (${resp.status}).`);
                        blob = await resp.blob();
                    } else {
                        blob = base64ToBlob(result.b64, result.mimeType);
                    }
                    // Icons should not be cropped; preserve by containing into the square if needed.
                    const jpgFile = await renderBlobToJpeg(blob, 1024, 1024, 'contain');
                    const version = 1;
                    const path = `${session.user.id}/apps/${selectedApp.id}/generated/icons/slot-${slotIndex}/v${version}-${createId()}.jpg`;

                    if (controller.signal.aborted) throw new Error('Canceled');

                    const { error: uploadError } = await uploadGeneratedAsset({
                        path,
                        file: jpgFile,
                        contentType: 'image/jpeg',
                    });
                    if (uploadError) throw uploadError;

                    const previewPath = path.replace(/\.jpg$/i, '-preview.jpg');
                    try {
                        const previewFile = await createPreviewJpeg(jpgFile, 256, 0.82);
                        const { error: previewUploadError } = await uploadGeneratedAsset({
                            path: previewPath,
                            file: previewFile,
                            contentType: 'image/jpeg',
                        });
                        if (previewUploadError) throw previewUploadError;
                    } catch (error: any) {
                        reportError(error?.message ? `Preview upload failed: ${error.message}` : 'Preview upload failed.');
                    }

                    const { data, error } = await createGeneratedAsset({
                        app_id: selectedApp.id,
                        brand_id: selectedBrand.id,
                        user_id: session.user.id,
                        kind: 'icon',
                        slot_index: slotIndex,
                        version_index: version,
                        image_path: path,
                        size_label: '1024',
                        width: 1024,
                        height: 1024,
                        status: 'ready',
                        edit_state: null,
                    });
                    if (error) throw error;
                    if (data) setGeneratedAssets((prev) => [...prev, data]);
                } catch {
                    if (!controller.signal.aborted) failed.push(slotIndex);
                }
            }

            delete abortByJobIdRef.current[jobId];

            if (controller.signal.aborted) {
                finishJob(jobId, { status: 'canceled', message: 'Canceled' });
                return;
            }

            if (failed.length) {
                reportError(`${text('generation_failed')} Slots: ${failed.join(', ')}`);
                finishJob(jobId, { status: 'error', message: `Failed slots: ${failed.join(', ')}` });
            } else {
                setJobProgress(jobId, { current: variations, total: variations });
                finishJob(jobId, { status: 'success' });
            }
        } catch (error: any) {
            reportError(error.message || text('generation_failed'));
        } finally {
            setIconSlotGenerating(null);
            setIconGenerating(false);
        }
    };

    const handleEnhanceIconSlot = async (payload: { slotIndex: number; base: { kind: IconKind; assetId: string }; enhancePrompt: string }) => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!brandIconReference) {
            reportError(text('need_icon_reference'));
            return;
        }

        const { slotIndex, base, enhancePrompt } = payload;
        setEnhanceIconSlotGenerating(slotIndex);
        const jobId = createJob({
            title: `Enhance icon ${slotIndex}`,
            kind: 'icon_enhance',
            providerId: iconProviderId,
        });
        const controller = new AbortController();
        abortByJobIdRef.current[jobId] = controller;
        const eta =
            iconProviderId === 'replicate:seedream-4'
                ? 'Dream ETA ~40s'
                : iconProviderId === 'replicate:nano-banana-pro'
                    ? 'Nano ETA ~2m'
                    : 'Giga ETA ~2m';
        setJobMessage(jobId, `${eta} · generating`);

        try {
            const baseAsset = selectedGeneratedAssets.find((asset) => asset.id === base.assetId) || null;
            if (!baseAsset || (baseAsset.kind !== 'icon' && baseAsset.kind !== 'icon_enhanced')) {
                finishJob(jobId, { status: 'error', message: 'Missing base icon' });
                throw new Error(text('generation_failed'));
            }

            const baseImageUrl = await resolveGeneratedUrl(baseAsset);
            const iconRefUrl =
                brandRefUrls[brandIconReference.id] ??
                (await getSignedUrl(BRAND_BUCKET, brandIconReference.image_path));

            const existingEnhanced = enhancedIconSlots.find((item) => item.slotIndex === slotIndex) || null;
            const nextVersion = existingEnhanced
                ? Math.max(...existingEnhanced.versions.map((item) => item.version_index ?? 1)) + 1
                : 1;

            const enhanceBasePrompt = [
                `Enhance image 1 into an App Store-ready iOS app icon (ready to submit).`,
                `Preserve image 1 motif/subject and overall composition.`,
                `Use image 2 only as a style/color reference (palette, lighting, finish) without changing the motif.`,
                `No text, no letters, no numbers, no words, no slogans.`,
                `No watermarks, no provider marks.`,
                `Output must be EXACTLY 1024x1024 pixels.`,
                `Keep it crisp, clean, and high quality (no blur, no artifacts).`,
            ].join(' ');
            const extra = String(enhancePrompt || '').trim();
            const prompt = extra ? `${enhanceBasePrompt}\n\n${extra}` : enhanceBasePrompt;

            const result = await requestGeneratedScreenshot({
                providerId: iconProviderId,
                prompt,
                simulatorImageUrl: baseImageUrl,
                brandRefImageUrl: iconRefUrl,
                width: 1024,
                height: 1024,
                signal: controller.signal,
            });

            let blob: Blob;
            if (result.kind === 'url') {
                const resp = await fetch(result.outputUrl, { signal: controller.signal });
                if (!resp.ok) throw new Error(`Failed to fetch provider output (${resp.status}).`);
                blob = await resp.blob();
            } else {
                blob = base64ToBlob(result.b64, result.mimeType);
            }
            const jpgFile = await renderBlobToJpeg(blob, 1024, 1024, 'contain');
            const path = `${session.user.id}/apps/${selectedApp.id}/generated/icons-enhanced/slot-${slotIndex}/v${nextVersion}-${createId()}.jpg`;

            if (controller.signal.aborted) throw new Error('Canceled');

            const { error: uploadError } = await uploadGeneratedAsset({
                path,
                file: jpgFile,
                contentType: 'image/jpeg',
            });
            if (uploadError) throw uploadError;

            const previewPath = path.replace(/\.jpg$/i, '-preview.jpg');
            try {
                const previewFile = await createPreviewJpeg(jpgFile, 256, 0.82);
                const { error: previewUploadError } = await uploadGeneratedAsset({
                    path: previewPath,
                    file: previewFile,
                    contentType: 'image/jpeg',
                });
                if (previewUploadError) throw previewUploadError;
            } catch (error: any) {
                reportError(error?.message ? `Preview upload failed: ${error.message}` : 'Preview upload failed.');
            }

            const { data, error } = await createGeneratedAsset({
                app_id: selectedApp.id,
                brand_id: selectedBrand.id,
                user_id: session.user.id,
                kind: 'icon_enhanced',
                slot_index: slotIndex,
                version_index: nextVersion,
                image_path: path,
                size_label: '1024',
                width: 1024,
                height: 1024,
                status: 'ready',
                edit_state: null,
            });
            if (error) throw error;
            if (data) setGeneratedAssets((prev) => [...prev, data]);
            finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            if (controller.signal.aborted) {
                finishJob(jobId, { status: 'canceled', message: 'Canceled' });
            } else {
                reportError(error.message || text('generation_failed'));
                finishJob(jobId, { status: 'error', message: String(error?.message || 'Failed').slice(0, 200) });
            }
        } finally {
            delete abortByJobIdRef.current[jobId];
            setEnhanceIconSlotGenerating(null);
        }
    };

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const readErrorPayload = async (response: Response) => {
        const status = response.status;
        const contentType = response.headers.get('content-type');
        const xZefGenApi = response.headers.get('x-zefgen-api');
        const xVercelId = response.headers.get('x-vercel-id');

        let message = `Generation failed (${status}).`;

        try {
            const data = await response.clone().json().catch(() => ({}));
            const maybeError = (data as any)?.error ?? (data as any)?.message;
            if (typeof maybeError === 'string' && maybeError.trim()) {
                message = maybeError;
            } else if (maybeError && typeof maybeError === 'object') {
                message = JSON.stringify(maybeError).slice(0, 500);
            }
        } catch {
            // ignore and fall back to text
        }

        if (message.startsWith('Generation failed')) {
            try {
                const textBody = await response.text();
                const snippet = textBody.trim().slice(0, 200);
                if (snippet) message = snippet;
            } catch {
                // ignore
            }
        }

        return { status, contentType, xZefGenApi, xVercelId, message };
    };

    const fetchWithRetry = async (url: string, init: RequestInit) => {
        const retryStatuses = new Set([403, 429, 502, 503, 504]);
        const maxAttempts = 2;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const response = await fetch(url, init);
            if (response.ok) return response;

            const shouldRetry = retryStatuses.has(response.status);
            if (!shouldRetry || attempt >= maxAttempts) return response;

            // Small, jittered backoff: enough to bypass transient edge/WAF/rate-limit spikes.
            const delayMs = 400 + Math.random() * 600;
            await sleep(delayMs);
        }

        // Unreachable; loop always returns above.
        throw new Error('Failed to fetch generation result.');
    };

    const requestGeneratedScreenshot = async (payload: {
        providerId: ScreenshotProviderId;
        prompt: string;
        simulatorImageUrl: string;
        brandRefImageUrl: string;
        width: number;
        height: number;
        signal?: AbortSignal;
    }): Promise<GenerationApiResult> => {
        if (!session?.access_token) {
            throw new Error('Missing session token.');
        }

        const responseMode =
            typeof payload.providerId === 'string' && payload.providerId.startsWith('replicate:')
                ? 'url'
                : 'b64';

        const response = await fetchWithRetry('/api/generate-screenshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            signal: payload.signal,
            body: JSON.stringify({
                providerId: payload.providerId,
                prompt: payload.prompt,
                simulatorImageUrl: payload.simulatorImageUrl,
                brandRefImageUrl: payload.brandRefImageUrl,
                width: payload.width,
                height: payload.height,
                responseMode,
            }),
        });

        if (!response.ok) {
            const errorPayload = await readErrorPayload(response);
            const contentType = errorPayload.contentType || '';

            if (
                errorPayload.status === 403 &&
                contentType.includes('text/html') &&
                !errorPayload.xZefGenApi
            ) {
                throw new Error(
                    "Request blocked at edge (403). Try again or refresh. If this keeps happening, check Vercel Firewall/Bot Protection for /api/* and /manifest.json."
                );
            }

            const vercelSuffix = errorPayload.xVercelId ? ` (x-vercel-id: ${errorPayload.xVercelId})` : '';
            throw new Error(`${errorPayload.message}${vercelSuffix}`);
        }

        const data = await response.json().catch(() => ({}));
        const outputUrl = (data as any)?.outputUrl;
        if (typeof outputUrl === 'string' && outputUrl.length) {
            return { kind: 'url', outputUrl };
        }

        const mimeType = (data as any)?.mimeType;
        const b64 = (data as any)?.b64;
        if (typeof mimeType !== 'string' || typeof b64 !== 'string' || !b64.length) {
            throw new Error('Generation API returned an invalid payload.');
        }

        return { kind: 'b64', mimeType, b64 };
    };

    const generateSlotOrThrow = async (slotIndex: number, ctx?: { signal?: AbortSignal; jobId?: string }) => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!activeScreenshotSetId) {
            throw new Error(
                `Screenshot sets are not initialized. Run supabase/migrations/2026-02-06_sets_picks_completion.sql in Supabase, then reload.`
            );
        }
        if (!selectedAppScreenshots.length) {
            throw new Error(text('need_simulator_screenshots'));
        }

        const mapping = getSlotMapping(slotIndex);
        const brandRefId = mapping.brandRefId;
        const simShotId = mapping.simShotId;
        if (!simShotId) {
            throw new Error(text('select_sim_screenshot'));
        }

        const sourceShot = selectedAppScreenshots.find((shot) => shot.id === simShotId);
        if (!sourceShot) {
            throw new Error(text('select_sim_screenshot'));
        }

        const simulatorImageUrl =
            appScreenshotUrls[sourceShot.id] ??
            (await getSignedUrl(APP_SCREENSHOT_BUCKET, sourceShot.image_path));

        const noReferenceClause =
            `No style reference is provided. Ignore image 2 and invent the background/style per the prompt while preserving image 1 layout.`;

        let brandRefImageUrl = simulatorImageUrl;
        let userPrompt = '';
        if (brandRefId) {
            const brandRef = brandScreenshotReferences.find((ref) => ref.id === brandRefId) ?? null;
            if (!brandRef) {
                throw new Error(text('select_brand_reference'));
            }
            brandRefImageUrl =
                brandRefUrls[brandRef.id] ??
                (await getSignedUrl(BRAND_BUCKET, brandRef.image_path));
            userPrompt = (promptsByRefId[brandRef.id] ?? '').trim();
        } else {
            const slotKey = getScreenshotSlotKey(slotIndex, activeScreenshotSetId);
            userPrompt = (slotPromptBySlotKey[slotKey] ?? '').trim();
        }

        const existingSlot = generatedScreenshotSlots.find((item) => item.slotIndex === slotIndex) || null;
        if (existingSlot && existingSlot.versions.length >= MAX_SCREENSHOT_VERSIONS) {
            throw new Error(text('version_limit_reached'));
        }

        const nextVersion = existingSlot
            ? Math.max(...existingSlot.versions.map((item) => item.version_index ?? 1)) + 1
            : 1;

        const sizeLabel = (existingSlot?.versions?.[0]?.size_label as '6.5' | '6.9' | null) ?? generationSize;
        const size = SCREENSHOT_SIZES[sizeLabel];

        const { effectivePrompt: basePrompt } = getSystemPromptForSlot(slotIndex, 'generate');
        const prompt = [
            basePrompt,
            !brandRefId ? noReferenceClause : null,
            userPrompt ? userPrompt : null,
        ]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join('\n\n');

        const image1 = simulatorImageUrl;
        const image2 = brandRefImageUrl;

        const result = await requestGeneratedScreenshot({
            providerId: screenshotProviderId,
            prompt,
            simulatorImageUrl: image1,
            brandRefImageUrl: image2,
            width: size.width,
            height: size.height,
            signal: ctx?.signal,
        });

        if (ctx?.signal?.aborted) throw new Error('Canceled');
        if (ctx?.jobId) {
            setJobProgress(ctx.jobId, { current: 1, total: 2 });
            setJobMessage(ctx.jobId, 'Saving…');
        }

        let blob: Blob;
        if (result.kind === 'url') {
            setInflightScreenshotPreview(slotIndex, 'generated', result.outputUrl);
            const resp = await fetch(result.outputUrl, { signal: ctx?.signal });
            if (!resp.ok) throw new Error(`Failed to fetch provider output (${resp.status}).`);
            blob = await resp.blob();
        } else {
            blob = base64ToBlob(result.b64, result.mimeType);
        }
        const jpgFile = await renderBlobToJpegAutoFit(blob, size.width, size.height);
        const path = `${session.user.id}/apps/${selectedApp.id}/generated/screenshots/slot-${slotIndex}/v${nextVersion}-${createId()}.jpg`;

        if (ctx?.signal?.aborted) throw new Error('Canceled');

        const { error: uploadError } = await uploadGeneratedAsset({
            path,
            file: jpgFile,
            contentType: 'image/jpeg',
        });
        if (uploadError) {
            const raw = String((uploadError as any)?.message || uploadError);
            const lower = raw.toLowerCase();
            if (lower.includes('bucket') && lower.includes('not') && lower.includes('found')) {
                throw new Error(
                    `Supabase Storage bucket "${GENERATED_BUCKET}" is missing. Create it in Supabase Storage (private), then retry.`
                );
            }
            if (
                lower.includes('row level security') ||
                lower.includes('violates row-level security') ||
                lower.includes('policy') ||
                lower.includes('unauthorized') ||
                lower.includes('permission')
            ) {
                throw new Error(
                    `Supabase Storage policies for "${GENERATED_BUCKET}" are not allowing uploads. ` +
                    `In Supabase, run the generated-assets policies from supabase/storage_policies.sql, then retry. ` +
                    `(${raw})`
                );
            }
            throw uploadError;
        }

        // Upload a small preview variant to keep UI fast (thumbnails/lightbox).
        const previewPath = path.replace(/\.jpg$/i, '-preview.jpg');
        try {
            const previewFile = await createPreviewJpeg(jpgFile, 420, 0.82);
            const { error: previewUploadError } = await uploadGeneratedAsset({
                path: previewPath,
                file: previewFile,
                contentType: 'image/jpeg',
            });
            if (previewUploadError) throw previewUploadError;
        } catch (error: any) {
            // Non-fatal: the UI will fall back to full-size.
            reportError(error?.message ? `Preview upload failed: ${error.message}` : 'Preview upload failed.');
        }

        const headline = getSlotHeadlineState(slotIndex);
        const headlineText = String(headline.text ?? '').trim();
        const headlinePos = { x: headline.x, y: headline.y };
        const carryForward = getCarryForwardLayersForSlot(slotIndex, activeScreenshotSetId);
        const layers = carryForward?.length ? carryForward : [createHeadlineLayer(headlineText, headlinePos)];
        if (layers.length) layers[0] = { ...layers[0], text: headlineText, x: headlinePos.x, y: headlinePos.y };

        const { data, error } = await createGeneratedAsset({
            app_id: selectedApp.id,
            brand_id: selectedBrand.id,
            user_id: session.user.id,
            kind: 'screenshot',
            slot_index: slotIndex,
            version_index: nextVersion,
            image_path: path,
            screenshot_set_id: activeScreenshotSetId,
            size_label: sizeLabel,
            width: size.width,
            height: size.height,
            status: 'ready',
            edit_state: { layers },
        });
        if (error) throw error;
        if (data) setGeneratedAssets((prev) => [...prev, data]);
        clearInflightScreenshotPreview(slotIndex, 'generated');
    };

    const enhanceSlotOrThrow = async (
        payload: {
            slotIndex: number;
            base: { kind: ScreenshotKind; assetId: string };
            enhancePrompt: string;
        },
        ctx?: { signal?: AbortSignal; jobId?: string }
    ) => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!activeScreenshotSetId) {
            throw new Error(
                `Screenshot sets are not initialized. Run supabase/migrations/2026-02-06_sets_picks_completion.sql in Supabase, then reload.`
            );
        }

        const { slotIndex, base, enhancePrompt } = payload;

        const mapping = getSlotMapping(slotIndex);
        const brandRefId = mapping.brandRefId;

        const baseAsset = selectedGeneratedAssets.find((asset) => asset.id === base.assetId) || null;
        if (!baseAsset || (baseAsset.kind !== 'screenshot' && baseAsset.kind !== 'screenshot_enhanced')) {
            throw new Error(text('generation_failed'));
        }

        const existingEnhanced = enhancedScreenshotSlots.find((item) => item.slotIndex === slotIndex) || null;
        if (existingEnhanced && existingEnhanced.versions.length >= MAX_SCREENSHOT_VERSIONS) {
            throw new Error(text('version_limit_reached'));
        }

        const nextVersion = existingEnhanced
            ? Math.max(...existingEnhanced.versions.map((item) => item.version_index ?? 1)) + 1
            : 1;

        const sizeLabel = ((baseAsset.size_label as '6.5' | '6.9' | null) ?? generationSize);
        const size = SCREENSHOT_SIZES[sizeLabel];

        const baseImageUrl = await resolveGeneratedUrl(baseAsset);

        const noReferenceClause =
            `No style reference is provided. Ignore image 2 and invent the background/style per the prompt while preserving image 1 layout.`;

        let brandRefImageUrl = baseImageUrl;
        if (brandRefId) {
            const brandRef = brandScreenshotReferences.find((ref) => ref.id === brandRefId) ?? null;
            if (!brandRef) {
                throw new Error(text('select_brand_reference'));
            }
            brandRefImageUrl =
                brandRefUrls[brandRef.id] ??
                (await getSignedUrl(BRAND_BUCKET, brandRef.image_path));
        }

        const { effectivePrompt: enhanceBasePrompt } = getSystemPromptForSlot(slotIndex, 'enhance');
        const extra = String(enhancePrompt || '').trim();
        const prompt = [
            enhanceBasePrompt,
            !brandRefId ? noReferenceClause : null,
            extra ? extra : null,
        ]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join('\n\n');

        const result = await requestGeneratedScreenshot({
            providerId: screenshotProviderId,
            prompt,
            simulatorImageUrl: baseImageUrl,
            brandRefImageUrl,
            width: size.width,
            height: size.height,
            signal: ctx?.signal,
        });

        if (ctx?.signal?.aborted) throw new Error('Canceled');
        if (ctx?.jobId) {
            setJobProgress(ctx.jobId, { current: 1, total: 2 });
            setJobMessage(ctx.jobId, 'Saving…');
        }

        let blob: Blob;
        if (result.kind === 'url') {
            setInflightScreenshotPreview(slotIndex, 'enhanced', result.outputUrl);
            const resp = await fetch(result.outputUrl, { signal: ctx?.signal });
            if (!resp.ok) throw new Error(`Failed to fetch provider output (${resp.status}).`);
            blob = await resp.blob();
        } else {
            blob = base64ToBlob(result.b64, result.mimeType);
        }
        const jpgFile = await renderBlobToJpegAutoFit(blob, size.width, size.height);
        const path = `${session.user.id}/apps/${selectedApp.id}/generated/screenshots-enhanced/slot-${slotIndex}/v${nextVersion}-${createId()}.jpg`;

        if (ctx?.signal?.aborted) throw new Error('Canceled');

        const { error: uploadError } = await uploadGeneratedAsset({
            path,
            file: jpgFile,
            contentType: 'image/jpeg',
        });
        if (uploadError) throw uploadError;

        // Upload a small preview variant to keep UI fast (thumbnails/lightbox).
        const previewPath = path.replace(/\.jpg$/i, '-preview.jpg');
        try {
            const previewFile = await createPreviewJpeg(jpgFile, 420, 0.82);
            const { error: previewUploadError } = await uploadGeneratedAsset({
                path: previewPath,
                file: previewFile,
                contentType: 'image/jpeg',
            });
            if (previewUploadError) throw previewUploadError;
        } catch (error: any) {
            // Non-fatal: the UI will fall back to full-size.
            reportError(error?.message ? `Preview upload failed: ${error.message}` : 'Preview upload failed.');
        }

        const headline = getSlotHeadlineState(slotIndex);
        const headlineText = String(headline.text ?? '').trim();
        const headlinePos = { x: headline.x, y: headline.y };
        const carryForward = getCarryForwardLayersForSlot(slotIndex, activeScreenshotSetId);
        const layers = carryForward?.length ? carryForward : [createHeadlineLayer(headlineText, headlinePos)];
        if (layers.length) layers[0] = { ...layers[0], text: headlineText, x: headlinePos.x, y: headlinePos.y };

        const { data, error } = await createGeneratedAsset({
            app_id: selectedApp.id,
            brand_id: selectedBrand.id,
            user_id: session.user.id,
            kind: 'screenshot_enhanced',
            slot_index: slotIndex,
            version_index: nextVersion,
            image_path: path,
            screenshot_set_id: activeScreenshotSetId,
            size_label: sizeLabel,
            width: size.width,
            height: size.height,
            status: 'ready',
            edit_state: { layers },
        });
        if (error) {
            const msg = String((error as any)?.message || error);
            if (msg.toLowerCase().includes('check constraint') && msg.toLowerCase().includes('kind')) {
                throw new Error(
                    `DB schema is missing kind='screenshot_enhanced'. Run supabase/migrations/2026-02-06_app_generated_assets_kind_screenshot_enhanced.sql in Supabase, then retry.`
                );
            }
            throw error;
        }
        if (data) setGeneratedAssets((prev) => [...prev, data]);
        clearInflightScreenshotPreview(slotIndex, 'enhanced');
    };

    const handleGenerateSlot = async (slotIndex: number) => {
        if (!session || !selectedBrand || !selectedApp) return;
        setSlotGenerating(slotIndex);
        const jobId = createJob({
            title: `Generate screenshot ${slotIndex}`,
            kind: 'screenshot_generate',
            providerId: screenshotProviderId,
            progressTotal: 2,
        });
        const controller = new AbortController();
        abortByJobIdRef.current[jobId] = controller;
        const eta =
            screenshotProviderId === 'replicate:seedream-4'
                ? 'ETA ~40s'
                : screenshotProviderId === 'replicate:nano-banana-pro'
                    ? 'ETA ~2m'
                    : 'ETA ~2m';
        setJobMessage(jobId, `${eta} · generating`);
        try {
            await generateSlotOrThrow(slotIndex, { signal: controller.signal, jobId });
            if (controller.signal.aborted) {
                finishJob(jobId, { status: 'canceled', message: 'Canceled' });
            } else {
                setJobProgress(jobId, { current: 2, total: 2 });
                finishJob(jobId, { status: 'success' });
            }
        } catch (error: any) {
            if (controller.signal.aborted) {
                finishJob(jobId, { status: 'canceled', message: 'Canceled' });
            } else {
                reportError(error.message || text('generation_failed'));
                finishJob(jobId, { status: 'error', message: String(error?.message || 'Failed').slice(0, 200) });
            }
        } finally {
            delete abortByJobIdRef.current[jobId];
            clearInflightScreenshotPreview(slotIndex, 'generated');
            setSlotGenerating(null);
        }
    };

    const handleEnhanceSlot = async (payload: {
        slotIndex: number;
        base: { kind: ScreenshotKind; assetId: string };
        enhancePrompt: string;
    }) => {
        if (!session || !selectedBrand || !selectedApp) return;
        setEnhanceSlotGenerating(payload.slotIndex);
        const jobId = createJob({
            title: `Enhance screenshot ${payload.slotIndex}`,
            kind: 'screenshot_enhance',
            providerId: screenshotProviderId,
            progressTotal: 2,
        });
        const controller = new AbortController();
        abortByJobIdRef.current[jobId] = controller;
        const eta =
            screenshotProviderId === 'replicate:seedream-4'
                ? 'ETA ~40s'
                : screenshotProviderId === 'replicate:nano-banana-pro'
                    ? 'ETA ~2m'
                    : 'ETA ~2m';
        setJobMessage(jobId, `${eta} · generating`);
        try {
            await enhanceSlotOrThrow(payload, { signal: controller.signal, jobId });
            if (controller.signal.aborted) {
                finishJob(jobId, { status: 'canceled', message: 'Canceled' });
            } else {
                setJobProgress(jobId, { current: 2, total: 2 });
                finishJob(jobId, { status: 'success' });
            }
        } catch (error: any) {
            if (controller.signal.aborted) {
                finishJob(jobId, { status: 'canceled', message: 'Canceled' });
            } else {
                reportError(error.message || text('generation_failed'));
                finishJob(jobId, { status: 'error', message: String(error?.message || 'Failed').slice(0, 200) });
            }
        } finally {
            delete abortByJobIdRef.current[jobId];
            clearInflightScreenshotPreview(payload.slotIndex, 'enhanced');
            setEnhanceSlotGenerating(null);
        }
    };

    const handleGenerateAllScreenshots = async () => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!selectedAppScreenshots.length) {
            reportError(text('need_simulator_screenshots'));
            return;
        }

        const jobId = createJob({
            title: 'Generate all screenshots',
            kind: 'screenshot_generate',
            providerId: screenshotProviderId,
            progressTotal: targetSlotCount,
        });
        const controller = new AbortController();
        abortByJobIdRef.current[jobId] = controller;
        const eta =
            screenshotProviderId === 'replicate:seedream-4'
                ? 'Dream ~40s/slot'
                : screenshotProviderId === 'replicate:nano-banana-pro'
                    ? 'Nano ~2m/slot'
                    : 'Giga ~2m/slot';
        setJobMessage(jobId, `${eta}`);

        const failedSlots: number[] = [];
        setScreenshotsGenerating(true);
        try {
            for (let slotIndex = 1; slotIndex <= targetSlotCount; slotIndex++) {
                if (controller.signal.aborted) break;
                setJobProgress(jobId, { current: slotIndex - 1, total: targetSlotCount });
                setJobMessage(jobId, `${eta} · Slot ${slotIndex}/${targetSlotCount}`);
                const existingSlot = generatedScreenshotSlots.find((item) => item.slotIndex === slotIndex) || null;
                if (existingSlot && existingSlot.versions.length >= MAX_SCREENSHOT_VERSIONS) {
                    continue;
                }
                setSlotGenerating(slotIndex);
                try {
                    await generateSlotOrThrow(slotIndex, { signal: controller.signal });
                } catch {
                    clearInflightScreenshotPreview(slotIndex, 'generated');
                    if (controller.signal.aborted) break;
                    failedSlots.push(slotIndex);
                }
            }
        } finally {
            delete abortByJobIdRef.current[jobId];
            setSlotGenerating(null);
            setScreenshotsGenerating(false);
        }

        if (controller.signal.aborted) {
            finishJob(jobId, { status: 'canceled', message: 'Canceled' });
        } else if (failedSlots.length) {
            reportError(`${text('generation_failed')} Slots: ${failedSlots.join(', ')}`);
            finishJob(jobId, { status: 'error', message: `Failed slots: ${failedSlots.join(', ')}` });
        } else {
            setJobProgress(jobId, { current: targetSlotCount, total: targetSlotCount });
            finishJob(jobId, { status: 'success' });
        }
    };

    const targetSlotCount = Math.min(Math.max(generationCount, 3), 6);
    const existingSlotCount = generatedScreenshotSlots.length;
    const slotsToCreate = Array.from({ length: targetSlotCount }, (_, index) => index + 1).filter(
        (slotIndex) => !generatedScreenshotSlots.some((slot) => slot.slotIndex === slotIndex)
    );
    const canGenerateIcon = Boolean(selectedApp && selectedBrand && brandIconReference);
    const canGenerateScreenshots = Boolean(selectedApp && selectedBrand);

    const slotPromptBySlotIndex = useMemo(() => {
        const out: Record<number, string> = {};
        if (!activeScreenshotSetId) return out;
        for (let i = 1; i <= targetSlotCount; i += 1) {
            const key = getScreenshotSlotKey(i, activeScreenshotSetId);
            out[i] = slotPromptBySlotKey[key] ?? '';
        }
        return out;
    }, [slotPromptBySlotKey, activeScreenshotSetId, targetSlotCount, getScreenshotSlotKey]);

    const slotHeadlineBySlotIndex = useMemo(() => {
        const out: Record<number, string> = {};
        if (!activeScreenshotSetId) return out;
        for (let i = 1; i <= targetSlotCount; i += 1) {
            const key = getScreenshotSlotKey(i, activeScreenshotSetId);
            out[i] = slotHeadlineBySlotKey[key] ?? '';
        }
        return out;
    }, [slotHeadlineBySlotKey, activeScreenshotSetId, targetSlotCount, getScreenshotSlotKey]);

    const slotHeadlinePosBySlotIndex = useMemo(() => {
        const out: Record<number, { x: number; y: number }> = {};
        if (!activeScreenshotSetId) return out;
        for (let i = 1; i <= targetSlotCount; i += 1) {
            const key = getScreenshotSlotKey(i, activeScreenshotSetId);
            out[i] = slotHeadlinePosBySlotKey[key] ?? { x: 50, y: 12 };
        }
        return out;
    }, [slotHeadlinePosBySlotKey, activeScreenshotSetId, targetSlotCount, getScreenshotSlotKey]);

    const pickedIconAssetId = useMemo(
        () => assetPicks.find((p) => p.kind === 'icon')?.generated_asset_id ?? null,
        [assetPicks]
    );

    const pickedScreenshotAssetIdBySetSlot = useMemo(() => {
        const map: Record<string, string> = {};
        for (const pick of assetPicks) {
            if (pick.kind !== 'screenshot') continue;
            if (!pick.screenshot_set_id || typeof pick.slot_index !== 'number') continue;
            map[`${pick.screenshot_set_id}:${pick.slot_index}`] = pick.generated_asset_id;
        }
        return map;
    }, [assetPicks]);

    const pickedScreenshotAssetIdBySlotIndex = useMemo(() => {
        const out: Record<number, string | null> = {};
        if (!activeScreenshotSetId) return out;
        for (let i = 1; i <= targetSlotCount; i += 1) {
            out[i] = pickedScreenshotAssetIdBySetSlot[`${activeScreenshotSetId}:${i}`] ?? null;
        }
        return out;
    }, [activeScreenshotSetId, pickedScreenshotAssetIdBySetSlot, targetSlotCount]);

    const handlePickIcon = useCallback(
        async (assetId: string) => {
            if (!session || !selectedBrand || !selectedApp) return;
            const { data, error } = await setIconPick({
                userId: session.user.id,
                brandId: selectedBrand.id,
                appId: selectedApp.id,
                generatedAssetId: assetId,
            });
            if (error) {
                reportError(String((error as any)?.message || error));
                return;
            }
            // Refresh picks in-memory
            setAssetPicks((prev) => {
                const next = prev.filter((p) => p.kind !== 'icon');
                if (data) next.push(data as any);
                return next;
            });
            await invalidateCompletion();
        },
        [session, selectedBrand, selectedApp, reportError, invalidateCompletion]
    );

    const handlePickScreenshot = useCallback(
        async (payload: { screenshotSetId: string; slotIndex: number; assetId: string }) => {
            if (!session || !selectedBrand || !selectedApp) return;
            const { screenshotSetId, slotIndex, assetId } = payload;
            const { data, error } = await setScreenshotPick({
                userId: session.user.id,
                brandId: selectedBrand.id,
                appId: selectedApp.id,
                screenshotSetId,
                slotIndex,
                generatedAssetId: assetId,
            });
            if (error) {
                reportError(String((error as any)?.message || error));
                return;
            }
            setAssetPicks((prev) => {
                const next = prev.filter(
                    (p) =>
                        !(
                            p.kind === 'screenshot' &&
                            p.screenshot_set_id === screenshotSetId &&
                            p.slot_index === slotIndex
                        )
                );
                if (data) next.push(data as any);
                return next;
            });
            await invalidateCompletion();
        },
        [session, selectedBrand, selectedApp, reportError, invalidateCompletion]
    );

    const getCompletionMissingReason = useCallback(() => {
        if (!pickedIconAssetId) return text('need_picks_to_complete');
        for (const set of screenshotSets) {
            const slots = Math.min(6, Math.max(3, Number(set.slot_count) || 3));
            for (let i = 1; i <= slots; i += 1) {
                const id = pickedScreenshotAssetIdBySetSlot[`${set.id}:${i}`];
                if (!id) return text('need_picks_to_complete');
            }
        }
        return null;
    }, [pickedIconAssetId, pickedScreenshotAssetIdBySetSlot, screenshotSets, text]);

    const handleMarkAsCompleted = useCallback(
        async (opts?: { pruneUnpicked?: boolean }) => {
            if (!session || !selectedBrand || !selectedApp) return;
            const missing = getCompletionMissingReason();
            if (missing) {
                reportError(missing);
                return;
            }

            const keepIds = new Set<string>(assetPicks.map((p) => p.generated_asset_id));
            const deletable = selectedGeneratedAssets.filter((a) => !keepIds.has(a.id));

            if (opts?.pruneUnpicked) {
                const paths: string[] = [];
                for (const asset of deletable) {
                    if (!asset.image_path) continue;
                    paths.push(asset.image_path);
                    if (/\.jpg$/i.test(asset.image_path)) {
                        paths.push(asset.image_path.replace(/\.jpg$/i, '-preview.jpg'));
                    }
                }

                if (paths.length) {
                    const { error: storageError } = await removeGeneratedAssets(paths);
                    if (storageError) {
                        reportError(String((storageError as any)?.message || storageError));
                        return;
                    }
                }

                if (deletable.length) {
                    const { error: deleteError } = await deleteGeneratedAssetsByIds({
                        userId: session.user.id,
                        ids: deletable.map((a) => a.id),
                    });
                    if (deleteError) {
                        reportError(String((deleteError as any)?.message || deleteError));
                        return;
                    }
                }
            }

            await setExportCompleted(true);
            await refresh();
            await loadSetsPicksStatus();
        },
        [
            session,
            selectedBrand,
            selectedApp,
            getCompletionMissingReason,
            assetPicks,
            selectedGeneratedAssets,
            removeGeneratedAssets,
            deleteGeneratedAssetsByIds,
            reportError,
            setExportCompleted,
            refresh,
            loadSetsPicksStatus,
        ]
    );

    const handleCreateGithubRepo = useCallback(async () => {
        if (!session || !selectedBrand || !selectedApp) return;

        const jobId = createJob({
            title: 'Create GitHub repo',
            kind: 'github_repo_create',
            progressTotal: 3,
        });
        setJobProgress(jobId, { current: 0, total: 3 });

        const controller = new AbortController();
        abortByJobIdRef.current[jobId] = controller;

        try {
            setJobMessage(jobId, 'Creating repo…');
            const resp = await fetch('/api/create-github-repo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    appId: selectedApp.id,
                    appAlias: selectedApp.alias,
                    appName: selectedApp.name,
                    brandName: selectedBrand.name,
                    brandSlug: selectedBrand.slug,
                }),
                signal: controller.signal,
            });

            setJobProgress(jobId, { current: 1, total: 3 });

            const payload = await resp.json().catch(() => null);
            if (!resp.ok) {
                const message = String(payload?.message || 'Failed to create GitHub repo.');
                const err: any = new Error(message);
                err.statusCode = resp.status;
                throw err;
            }

            const repoUrl = String(payload?.repoUrl || '');
            if (!repoUrl) throw new Error('GitHub response missing repo URL.');
            const repoFullName = String(payload?.repoFullName || '').trim();

            setJobMessage(jobId, 'Saving link…');
            setJobProgress(jobId, { current: 2, total: 3 });

            const key = `zefgen.githubRepoUrl.${selectedApp.id}`;
            window.localStorage.setItem(key, repoUrl);
            setGithubRepoUrl(repoUrl);
            githubRepoClearedByAppIdRef.current[selectedApp.id] = false;

            // Persist globally (cross-device). If schema isn't applied yet, keep localStorage fallback.
            const nowIso = new Date().toISOString();
            const { error: appUpdateError } = await updateApp({
                id: selectedApp.id,
                userId: session.user.id,
                patch: {
                    github_repo_url: repoUrl,
                    github_repo_full_name: repoFullName || null,
                    github_repo_created_at: nowIso,
                    github_repo_updated_at: nowIso,
                } as any,
            });
            if (appUpdateError) {
                const msg = String((appUpdateError as any)?.message || appUpdateError);
                if (msg.toLowerCase().includes('github_repo')) {
                    reportError(
                        `DB schema missing GitHub repo columns. Run supabase/migrations/2026-02-08_app_github_repo.sql in Supabase SQL editor to persist repo links across devices.`
                    );
                }
            }

            setJobMessage(jobId, 'Done');
            setJobProgress(jobId, { current: 3, total: 3 });
            finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            const msg = String(error?.message || 'GitHub repo creation failed.');
            reportError(msg);
            finishJob(jobId, { status: error?.name === 'AbortError' ? 'canceled' : 'error', message: msg });
        } finally {
            delete abortByJobIdRef.current[jobId];
        }
    }, [session, selectedBrand, selectedApp, createJob, setJobProgress, setJobMessage, finishJob, reportError]);

    const handleDeleteGithubRepo = useCallback(async () => {
        if (!session || !selectedApp) return;
        if (!githubRepoUrl && !(selectedApp as any)?.github_repo_url) {
            reportError('No GitHub repo is stored for this app.');
            return;
        }

        const jobId = createJob({
            title: 'Delete GitHub repo',
            kind: 'github_repo_delete',
            progressTotal: 2,
        });
        setJobProgress(jobId, { current: 0, total: 2 });

        const controller = new AbortController();
        abortByJobIdRef.current[jobId] = controller;

        try {
            setJobMessage(jobId, 'Deleting repo…');
            const resp = await fetch('/api/delete-github-repo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ appId: selectedApp.id }),
                signal: controller.signal,
            });

            setJobProgress(jobId, { current: 1, total: 2 });

            const payload = await resp.json().catch(() => null);
            if (!resp.ok) {
                const message = String(payload?.message || 'Failed to delete GitHub repo.');
                const err: any = new Error(message);
                err.statusCode = resp.status;
                throw err;
            }

            setJobMessage(jobId, 'Clearing link…');
            githubRepoClearedByAppIdRef.current[selectedApp.id] = true;
            const key = `zefgen.githubRepoUrl.${selectedApp.id}`;
            window.localStorage.removeItem(key);
            setGithubRepoUrl(null);

            setJobMessage(jobId, 'Done');
            setJobProgress(jobId, { current: 2, total: 2 });
            finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            const msg = String(error?.message || 'GitHub repo delete failed.');
            reportError(msg);
            finishJob(jobId, { status: error?.name === 'AbortError' ? 'canceled' : 'error', message: msg });
        } finally {
            delete abortByJobIdRef.current[jobId];
        }
    }, [session, selectedApp, githubRepoUrl, createJob, setJobProgress, setJobMessage, finishJob, reportError]);

    return {
        screenshotSets,
        activeScreenshotSetId,
        setActiveScreenshotSetId: setActiveScreenshotSet,
        handleAddScreenshotSet,
        handleDeleteScreenshotSet,
        assetPicks,
        exportStatus,
        pickedIconAssetId,
        pickedScreenshotAssetIdBySlotIndex,
        handlePickIcon,
        handlePickScreenshot,
        handleMarkAsCompleted,
        handleDownloadScreenshotSetZip,
        generatedAssets,
        generatedUrls,
        generatedPreviewUrls,
        inflightScreenshotPreviewByKey,
        generationJobs,
        hasRunningJobs,
        cancelGenerationJob,
        dismissJob,
        clearFinished,
        githubRepoUrl,
        handleCreateGithubRepo,
        handleDeleteGithubRepo,
        loading,
        error,
        refresh,
        selectedGeneratedAssets,
        generatedIconSlots,
        enhancedIconSlots,
        generatedScreenshotSlots,
        enhancedScreenshotSlots,
        iconGenerating,
        iconSlotGenerating,
        enhanceIconSlotGenerating,
        screenshotsGenerating,
        slotGenerating,
        enhanceSlotGenerating,
        generationCount,
        setGenerationCount: setGenerationCountForActiveSet,
        generationSize,
        setGenerationSize: setGenerationSizeForActiveSet,
        screenshotProviderId,
        setScreenshotProviderId,
        iconProviderId,
        setIconProviderId,
        iconVariationsCount,
        setIconVariationsCount,
        slotPromptBySlotIndex,
        setSlotPrompt,
        slotHeadlineBySlotIndex,
        slotHeadlinePosBySlotIndex,
        setSlotHeadline,
        setSlotHeadlinePosition,
        beginSlotHeadlineDrag,
        beginSlotHeadlineTextEdit,
        undoSlotHeadline,
        redoSlotHeadline,
        editAssetId,
        editDrafts,
        editSaving,
        beginEditAsset,
        resetEditDraft,
        updateLayer,
        addLayer,
        removeLayer,
        handleSaveEdit,
        handleGenerateIcon,
        handleEnhanceIconSlot,
        handleGenerateSlot,
        handleEnhanceSlot,
        handleGenerateAllScreenshots,
        handleDownloadGeneratedAsset,
        handleDownloadAllScreenshots,
        handleDeleteGeneratedAsset,
        getSystemPromptForSlot,
        setSystemPromptOverride,
        resetSystemPromptOverride,
        targetSlotCount,
        existingSlotCount,
        slotsToCreate,
        canGenerateIcon,
        canGenerateScreenshots,
    };
};
