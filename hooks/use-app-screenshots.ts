import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { AppItem, AppScreenshot, AppScreenshotImportWarning, AppScreenshotImportWarningCode, Brand } from '../types/zefgen';
import {
    createAppScreenshotArtifactIgnore,
    createAppScreenshot,
    createAppScreenshotsBatch,
    deleteAppScreenshot,
    fetchAppScreenshots,
    fetchAppScreenshotArtifactIgnores,
    removeAppScreenshotImage,
    updateAppScreenshotOrder,
    uploadAppScreenshotImage,
} from '../data/app-screenshots';
import {
    fetchConnectorArtifactSignedUrl,
    fetchConnectorJobArtifactsByIds,
    fetchConnectorJobArtifactsByJob,
} from '../data/connector-job-artifacts';
import { fetchConnectorJobById, fetchConnectorJobs } from '../data/connector-jobs';
import { createId } from '../utils/id';
import { isFileTooLarge, isValidImageType, resizeImageToJpeg } from '../utils/images';
import {
    filterRunnerScreenshotArtifactsForApp,
    validatePersistedRunnerScreenshotArtifacts,
} from '../utils/app-screenshot-runner-import.js';
import { useSignedUrlCache } from './use-signed-url-cache';
import { APP_SCREENSHOT_BUCKET } from '../constants/zefgen';

const RUNNER_IMPORT_POLL_MS = 10000;
const MAX_SCREENSHOT_JOB_IMPORTS = 100;

const getAppScreenshotSourceKind = (shot: AppScreenshot) =>
    shot.source_kind === 'runner' || Boolean(shot.artifact_id) ? 'runner' : 'upload';

const getNextAppScreenshotOrderIndex = (shots: AppScreenshot[]) =>
    shots.reduce((maxOrder, shot) => Math.max(maxOrder, Number(shot.order_index ?? -1)), -1) + 1;

const getSelectedScreenshotsForApp = (shots: AppScreenshot[], appId: string | null) =>
    shots
        .filter((shot) => shot.app_id === appId)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

const normalizeCaptureVariant = (value: unknown): 'render' | 'simulator' | null => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'simulator') return 'simulator';
    if (normalized === 'render' || normalized === 'renders') return 'render';
    return null;
};

const mergeScreenshotsById = (current: AppScreenshot[], incoming: AppScreenshot[]) => {
    const merged = new Map<string, AppScreenshot>();
    current.forEach((shot) => merged.set(shot.id, shot));
    incoming.forEach((shot) => merged.set(shot.id, shot));
    return [...merged.values()];
};

const isUniqueConstraintError = (error: any) => {
    const code = String(error?.code || '').trim();
    const message = String(error?.message || '').trim().toLowerCase();
    return code === '23505' || message.includes('duplicate key') || message.includes('unique constraint');
};

const buildRunnerImportWarningMessage = (
    code: AppScreenshotImportWarningCode,
    jobId: string,
    text: (key: TranslationKey) => string
) => {
    const key =
        code === 'job_app_mismatch'
            ? 'simulator_screenshots_import_warning_job_app_mismatch'
            : code === 'source_job_app_mismatch'
              ? 'simulator_screenshots_import_warning_source_job_mismatch'
              : 'simulator_screenshots_import_warning_artifact_app_mismatch';
    return String(text(key) || '').replace('{jobId}', jobId);
};

type Params = {
    session: Session | null;
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    text: (key: TranslationKey) => string;
    reportError: (message: string) => void;
    onDataError?: (message: string) => void;
};

export const useAppScreenshots = ({
    session,
    selectedBrand,
    selectedApp,
    text,
    reportError,
    onDataError,
}: Params) => {
    const [appScreenshots, setAppScreenshots] = useState<AppScreenshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);
    const [appScreenshotUrls, setAppScreenshotUrls] = useState<Record<string, string>>({});
    const [appScreenshotsUploading, setAppScreenshotsUploading] = useState(false);
    const [isScreenshotDropActive, setIsScreenshotDropActive] = useState(false);
    const [runnerImportWarnings, setRunnerImportWarnings] = useState<AppScreenshotImportWarning[]>([]);
    const [runnerIntegrityWarnings, setRunnerIntegrityWarnings] = useState<AppScreenshotImportWarning[]>([]);
    const [runnerArtifactValidityById, setRunnerArtifactValidityById] = useState<Record<string, boolean>>({});
    const appScreenshotsRef = useRef<AppScreenshot[]>([]);
    const mutationChainRef = useRef<Promise<void>>(Promise.resolve());
    const runnerImportErrorMessageRef = useRef<string | null>(null);
    const runnerValidationErrorMessageRef = useRef<string | null>(null);
    const { getSignedUrl } = useSignedUrlCache({ userId: session?.user.id ?? null });
    const sessionUserId = session?.user.id ?? null;
    const sessionAccessToken = String(session?.access_token || '').trim();
    const selectedAppId = String(selectedApp?.id || '').trim() || null;
    const selectedBrandId = String(selectedBrand?.id || '').trim() || null;

    const updateAppScreenshotsState = useCallback(
        (next: AppScreenshot[] | ((current: AppScreenshot[]) => AppScreenshot[])) => {
            setAppScreenshots((current) => {
                const resolved = typeof next === 'function' ? (next as (current: AppScreenshot[]) => AppScreenshot[])(current) : next;
                appScreenshotsRef.current = resolved;
                return resolved;
            });
        },
        []
    );

    const enqueueAppScreenshotMutation = useCallback(async <T,>(task: () => Promise<T>) => {
        const nextTask = mutationChainRef.current.then(task, task);
        mutationChainRef.current = nextTask.then(
            () => undefined,
            () => undefined
        );
        return nextTask;
    }, []);

    const reportRunnerImportError = useCallback(
        (message: string) => {
            if (!message) return;
            if (runnerImportErrorMessageRef.current === message) return;
            runnerImportErrorMessageRef.current = message;
            reportError(message);
        },
        [reportError]
    );

    const reportRunnerValidationError = useCallback(
        (message: string) => {
            if (!message) return;
            if (runnerValidationErrorMessageRef.current === message) return;
            runnerValidationErrorMessageRef.current = message;
            reportError(message);
        },
        [reportError]
    );

    const refresh = useCallback(async () => {
        if (!session) {
            updateAppScreenshotsState([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await fetchAppScreenshots(session.user.id);
        if (fetchError) {
            setError(fetchError.message);
            onDataError?.(fetchError.message);
        } else {
            updateAppScreenshotsState(data || []);
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [onDataError, session, updateAppScreenshotsState]);

    useEffect(() => {
        if (!session) {
            updateAppScreenshotsState([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id) return;
        void refresh();
    }, [refresh, session, updateAppScreenshotsState]);

    useEffect(() => {
        appScreenshotsRef.current = appScreenshots;
    }, [appScreenshots]);

    const selectedPersistedAppScreenshots = useMemo(
        () => getSelectedScreenshotsForApp(appScreenshots, selectedApp?.id || null),
        [appScreenshots, selectedApp?.id]
    );

    const selectedAppScreenshots = useMemo(
        () =>
            selectedPersistedAppScreenshots.filter((shot) => {
                const isRunnerBacked = getAppScreenshotSourceKind(shot) === 'runner';
                if (!isRunnerBacked) return true;
                const artifactId = String(shot.artifact_id || '').trim();
                return artifactId ? runnerArtifactValidityById[artifactId] !== false : false;
            }),
        [runnerArtifactValidityById, selectedPersistedAppScreenshots]
    );

    useEffect(() => {
        if (!sessionUserId || !selectedAppId) {
            setRunnerArtifactValidityById({});
            setRunnerIntegrityWarnings([]);
            runnerValidationErrorMessageRef.current = null;
            return;
        }

        const runnerBackedShots = selectedPersistedAppScreenshots.filter(
            (shot) => getAppScreenshotSourceKind(shot) === 'runner' && String(shot.artifact_id || '').trim()
        );
        if (!runnerBackedShots.length) {
            setRunnerArtifactValidityById({});
            setRunnerIntegrityWarnings([]);
            runnerValidationErrorMessageRef.current = null;
            return;
        }

        let canceled = false;
        const validatePersistedRunnerRows = async () => {
            const { data, error: fetchError } = await fetchConnectorJobArtifactsByIds({
                artifactIds: runnerBackedShots.map((shot) => String(shot.artifact_id || '')),
            });
            if (canceled) return;
            if (fetchError) {
                reportRunnerValidationError(text('simulator_screenshots_validation_failed'));
                return;
            }

            runnerValidationErrorMessageRef.current = null;
            const validation = validatePersistedRunnerScreenshotArtifacts({
                shots: runnerBackedShots,
                artifactIdentities: data || [],
                expectedAppId: selectedAppId,
            });
            const nextWarnings: AppScreenshotImportWarning[] = validation.invalidShots.map((entry) => ({
                jobId: entry.importedFromJobId || entry.artifactId.slice(0, 8),
                code: 'artifact_app_mismatch',
                message: buildRunnerImportWarningMessage(
                    'artifact_app_mismatch',
                    entry.importedFromJobId || entry.artifactId.slice(0, 8),
                    text
                ),
            }));

            setRunnerArtifactValidityById(validation.artifactValidityById);
            setRunnerIntegrityWarnings(nextWarnings);
        };

        void validatePersistedRunnerRows();
        return () => {
            canceled = true;
        };
    }, [reportRunnerValidationError, selectedPersistedAppScreenshots, selectedAppId, sessionUserId, text]);

    const canUploadAppScreenshots = Boolean(selectedApp && selectedBrand);

    useEffect(() => {
        if (!sessionUserId || !selectedAppId || !selectedBrandId || loading) {
            setRunnerImportWarnings([]);
            runnerImportErrorMessageRef.current = null;
            return;
        }

        let canceled = false;
        const syncRunnerScreenshotsIntoStep08 = async () => {
            try {
                let didEncounterSyncError = false;
                const { data: jobs, error: jobsError } = await fetchConnectorJobs({
                    userId: sessionUserId,
                    appId: selectedAppId,
                    limit: MAX_SCREENSHOT_JOB_IMPORTS,
                });
                if (jobsError) throw jobsError;

                const successfulScreenshotJobs = (jobs || [])
                    .filter((job) => String(job?.kind || '') === 'screenshots' && String(job?.status || '') === 'succeeded')
                    .sort(
                        (left, right) =>
                            new Date(String(left?.created_at || 0)).getTime() -
                            new Date(String(right?.created_at || 0)).getTime()
                    );

                if (!successfulScreenshotJobs.length) {
                    if (!canceled) setRunnerImportWarnings([]);
                    runnerImportErrorMessageRef.current = null;
                    return;
                }

                const sourceJobCache = new Map<string, any | null>();
                const nextWarnings: AppScreenshotImportWarning[] = [];
                const candidateArtifacts: Array<{
                    jobId: string;
                    artifactId: string;
                    imagePath: string;
                    captureVariant: 'render' | 'simulator';
                    theme: string | null;
                    viewport: string | null;
                    targetId: string | null;
                }> = [];
                const seenCandidateArtifactIds = new Set<string>();

                const pushWarning = (jobId: string, code: AppScreenshotImportWarningCode) => {
                    const warningKey = `${jobId}:${code}`;
                    if (nextWarnings.some((warning) => `${warning.jobId}:${warning.code}` === warningKey)) return;
                    nextWarnings.push({
                        jobId,
                        code,
                        message: buildRunnerImportWarningMessage(code, jobId, text),
                    });
                };

                for (const job of successfulScreenshotJobs) {
                    const jobId = String(job?.id || '').trim();
                    const jobAppId = String(job?.app_id || '').trim();
                    if (!jobId) continue;
                    if (!jobAppId || jobAppId !== selectedAppId) {
                        pushWarning(jobId, 'job_app_mismatch');
                        continue;
                    }

                    const sourceJobId = String(job?.input?.source_job_id || '').trim();
                    if (sourceJobId) {
                        if (!sourceJobCache.has(sourceJobId)) {
                            const { data, error: sourceJobError } = await fetchConnectorJobById({
                                userId: sessionUserId,
                                jobId: sourceJobId,
                            });
                            sourceJobCache.set(sourceJobId, sourceJobError ? null : (data || null));
                        }
                        const sourceJob = sourceJobCache.get(sourceJobId);
                        const sourceJobAppId = String(sourceJob?.app_id || '').trim();
                        if (!sourceJob || !sourceJobAppId || sourceJobAppId !== jobAppId) {
                            pushWarning(jobId, 'source_job_app_mismatch');
                            continue;
                        }
                    }

                    const { data: artifacts, error: artifactsError } = await fetchConnectorJobArtifactsByJob({
                        jobId,
                        limit: 200,
                    });
                    if (artifactsError) {
                        didEncounterSyncError = true;
                        continue;
                    }

                    const artifactRows = (artifacts || []).filter(
                        (artifact) => String(artifact?.kind || '') === 'screenshot_image'
                    );
                    const { validArtifacts, mismatchedArtifacts } = filterRunnerScreenshotArtifactsForApp({
                        artifacts: artifactRows,
                        expectedAppId: jobAppId,
                    });
                    if (mismatchedArtifacts.length > 0) {
                        pushWarning(jobId, 'artifact_app_mismatch');
                    }

                    validArtifacts.forEach((artifact) => {
                        const artifactId = String(artifact?.id || '').trim();
                        const imagePath = String(artifact?.object_path || '').trim();
                        if (!artifactId || !imagePath || seenCandidateArtifactIds.has(artifactId)) return;
                        seenCandidateArtifactIds.add(artifactId);
                        candidateArtifacts.push({
                            jobId,
                            artifactId,
                            imagePath,
                            captureVariant:
                                normalizeCaptureVariant(
                                    artifact?.metadata?.capture_variant ??
                                        artifact?.metadata?.variant ??
                                        artifact?.metadata?.capture_mode
                                ) ?? 'render',
                            theme: String(artifact?.metadata?.theme || '').trim() || null,
                            viewport: String(artifact?.metadata?.viewport || '').trim() || null,
                            targetId: String(artifact?.metadata?.target_id || '').trim() || null,
                        });
                    });
                }

                if (!canceled) {
                    setRunnerImportWarnings(nextWarnings);
                    if (didEncounterSyncError) {
                        reportRunnerImportError(text('simulator_screenshots_import_sync_failed'));
                    } else {
                        runnerImportErrorMessageRef.current = null;
                    }
                }

                if (!candidateArtifacts.length) return;

                await enqueueAppScreenshotMutation(async () => {
                    const { data: latestIgnores, error: ignoresError } = await fetchAppScreenshotArtifactIgnores({
                        userId: sessionUserId,
                        appId: selectedAppId,
                    });
                    if (ignoresError) throw ignoresError;

                    const currentSelectedPersisted = getSelectedScreenshotsForApp(appScreenshotsRef.current, selectedAppId);
                    const existingArtifactIds = new Set(
                        currentSelectedPersisted.map((shot) => String(shot.artifact_id || '').trim()).filter(Boolean)
                    );
                    (latestIgnores || []).forEach((row) => {
                        const artifactId = String((row as any)?.artifact_id || '').trim();
                        if (artifactId) existingArtifactIds.add(artifactId);
                    });

                    let nextOrderIndex = getNextAppScreenshotOrderIndex(currentSelectedPersisted);
                    const nextRows: Parameters<typeof createAppScreenshotsBatch>[0] = [];

                    candidateArtifacts.forEach((artifact) => {
                        if (existingArtifactIds.has(artifact.artifactId)) return;
                        existingArtifactIds.add(artifact.artifactId);
                        nextRows.push({
                            userId: sessionUserId,
                            brandId: selectedBrandId,
                            appId: selectedAppId,
                            imagePath: artifact.imagePath,
                            orderIndex: nextOrderIndex,
                            sourceKind: 'runner',
                            artifactId: artifact.artifactId,
                            importedFromJobId: artifact.jobId,
                            captureVariant: artifact.captureVariant,
                            theme: artifact.theme,
                            viewport: artifact.viewport,
                            targetId: artifact.targetId,
                        });
                        nextOrderIndex += 1;
                    });

                    if (!nextRows.length) return;

                    const { data: insertedRows, error: insertError } = await createAppScreenshotsBatch(nextRows);
                    if (insertError) {
                        if (isUniqueConstraintError(insertError)) {
                            await refresh();
                            runnerImportErrorMessageRef.current = null;
                            return;
                        }
                        throw insertError;
                    }
                    if (canceled || !insertedRows?.length) return;
                    runnerImportErrorMessageRef.current = null;
                    updateAppScreenshotsState((current) => mergeScreenshotsById(current, insertedRows as AppScreenshot[]));
                });
            } catch {
                if (!canceled) {
                    reportRunnerImportError(text('simulator_screenshots_import_sync_failed'));
                }
            }
        };

        void syncRunnerScreenshotsIntoStep08();
        const timer = window.setInterval(() => void syncRunnerScreenshotsIntoStep08(), RUNNER_IMPORT_POLL_MS);
        return () => {
            canceled = true;
            window.clearInterval(timer);
        };
    }, [
        enqueueAppScreenshotMutation,
        loading,
        refresh,
        selectedAppId,
        selectedBrandId,
        sessionUserId,
        text,
        reportRunnerImportError,
        updateAppScreenshotsState,
    ]);

    useEffect(() => {
        if (!sessionUserId) {
            setAppScreenshotUrls({});
            return;
        }

        let isMounted = true;
        const loadUrls = async () => {
            const scopedShots = selectedAppScreenshots.filter((shot) => shot.image_path);
            const entries = await Promise.all(
                scopedShots.map(async (shot) => {
                    try {
                        const url =
                            shot.artifact_id && sessionAccessToken
                                ? await fetchConnectorArtifactSignedUrl({
                                      token: sessionAccessToken,
                                      artifactId: shot.artifact_id,
                                      appId: selectedAppId,
                                      jobId: shot.imported_from_job_id ?? null,
                                  })
                                : await getSignedUrl(APP_SCREENSHOT_BUCKET, shot.image_path);
                        return [shot.id, url] as const;
                    } catch (loadError: any) {
                        reportError(loadError.message);
                        return [shot.id, ''] as const;
                    }
                })
            );

            if (!isMounted) return;
            setAppScreenshotUrls((prev) => {
                const nextUrls: Record<string, string> = {};
                scopedShots.forEach((shot) => {
                    const prevUrl = prev[shot.id];
                    if (prevUrl) nextUrls[shot.id] = prevUrl;
                });
                entries.forEach(([id, url]) => {
                    if (url) nextUrls[id] = url;
                });
                return nextUrls;
            });
        };

        void loadUrls();
        return () => {
            isMounted = false;
        };
    }, [getSignedUrl, reportError, selectedAppId, selectedAppScreenshots, sessionAccessToken, sessionUserId]);

    const normalizeScreenshotFiles = (files: File[]) =>
        [...files].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

    const uploadAppScreenshots = async (files: File[]) => {
        if (!files.length || !session || !selectedBrand || !selectedApp) return;

        setAppScreenshotsUploading(true);

        try {
            await enqueueAppScreenshotMutation(async () => {
                const orderedFiles = normalizeScreenshotFiles(files);
                let nextOrderIndex = getNextAppScreenshotOrderIndex(
                    getSelectedScreenshotsForApp(appScreenshotsRef.current, selectedApp.id)
                );

                for (let index = 0; index < orderedFiles.length; index += 1) {
                    const file = orderedFiles[index];
                    if (!isValidImageType(file)) {
                        reportError(text('invalid_file_type'));
                        continue;
                    }
                    if (isFileTooLarge(file)) {
                        reportError(text('file_too_large'));
                        continue;
                    }

                    const jpgFile = await resizeImageToJpeg(file, 1320, 2868);
                    const path = `${session.user.id}/apps/${selectedApp.id}/simulator/${createId()}.jpg`;
                    const { error: uploadError } = await uploadAppScreenshotImage({
                        path,
                        file: jpgFile,
                        contentType: 'image/jpeg',
                    });
                    if (uploadError) throw uploadError;

                    const { data, error: createError } = await createAppScreenshot({
                        userId: session.user.id,
                        brandId: selectedBrand.id,
                        appId: selectedApp.id,
                        imagePath: path,
                        orderIndex: nextOrderIndex,
                        sourceKind: 'upload',
                    });
                    if (createError) throw createError;
                    if (data) {
                        nextOrderIndex += 1;
                        updateAppScreenshotsState((current) => [...current, data]);
                    }
                }
            });
        } catch (uploadError: any) {
            reportError(uploadError.message || text('upload_failed'));
        } finally {
            setAppScreenshotsUploading(false);
        }
    };

    const handleAppScreenshotsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files: File[] = event.target.files ? Array.from(event.target.files) : [];
        event.target.value = '';
        await uploadAppScreenshots(files);
    };

    const handleScreenshotDrop = async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsScreenshotDropActive(false);
        if (appScreenshotsUploading) return;
        const files: File[] = Array.from(event.dataTransfer.files);
        await uploadAppScreenshots(files);
    };

    const handleScreenshotDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!isScreenshotDropActive) {
            setIsScreenshotDropActive(true);
        }
    };

    const handleScreenshotDragLeave = () => {
        setIsScreenshotDropActive(false);
    };

    const handleDeleteAppScreenshot = async (shot: AppScreenshot) => {
        if (!session) return;

        await enqueueAppScreenshotMutation(async () => {
            const isRunnerBacked = getAppScreenshotSourceKind(shot) === 'runner';
            if (isRunnerBacked && shot.artifact_id) {
                const { error: ignoreError } = await createAppScreenshotArtifactIgnore({
                    userId: session.user.id,
                    appId: shot.app_id,
                    artifactId: shot.artifact_id,
                });
                if (ignoreError && !isUniqueConstraintError(ignoreError)) {
                    reportError(ignoreError.message);
                    return;
                }
            }

            const { error: deleteError } = await deleteAppScreenshot({ id: shot.id, userId: session.user.id });
            if (deleteError) {
                reportError(deleteError.message);
                return;
            }

            if (!isRunnerBacked && shot.image_path) {
                await removeAppScreenshotImage(shot.image_path);
            }

            const remaining = getSelectedScreenshotsForApp(
                appScreenshotsRef.current.filter((item) => item.id !== shot.id),
                shot.app_id
            );
            updateAppScreenshotsState((current) =>
                current
                    .filter((item) => item.id !== shot.id)
                    .map((item) => {
                        const idx = remaining.findIndex((entry) => entry.id === item.id);
                        if (idx === -1) return item;
                        return { ...item, order_index: idx };
                    })
            );

            await Promise.all(
                remaining.map((item, index) =>
                    updateAppScreenshotOrder({
                        id: item.id,
                        userId: session.user.id,
                        orderIndex: index,
                    })
                )
            );
        });
    };

    const handleReorderAppScreenshot = async (fromIndex: number, toIndex: number) => {
        if (!session || !selectedAppId) return;
        if (toIndex < 0 || toIndex >= selectedAppScreenshots.length) return;

        await enqueueAppScreenshotMutation(async () => {
            const allCurrentForApp = getSelectedScreenshotsForApp(appScreenshotsRef.current, selectedAppId);
            const currentVisible = allCurrentForApp.filter((shot) => {
                const isRunnerBacked = getAppScreenshotSourceKind(shot) === 'runner';
                if (!isRunnerBacked) return true;
                const artifactId = String(shot.artifact_id || '').trim();
                return artifactId ? runnerArtifactValidityById[artifactId] !== false : false;
            });
            if (toIndex < 0 || toIndex >= currentVisible.length) return;

            const nextVisible = [...currentVisible];
            const [moved] = nextVisible.splice(fromIndex, 1);
            nextVisible.splice(toIndex, 0, moved);

            const visibleIds = new Set(nextVisible.map((shot) => shot.id));
            const hiddenRows = allCurrentForApp.filter((shot) => !visibleIds.has(shot.id));
            const nextAll = [...nextVisible, ...hiddenRows];

            updateAppScreenshotsState((current) =>
                current.map((shot) => {
                    const idx = nextAll.findIndex((item) => item.id === shot.id);
                    if (idx === -1) return shot;
                    return { ...shot, order_index: idx };
                })
            );

            await Promise.all(
                nextAll.map((shot, index) =>
                    updateAppScreenshotOrder({
                        id: shot.id,
                        userId: session.user.id,
                        orderIndex: index,
                    })
                )
            );
        });
    };

    const combinedRunnerWarnings = useMemo(() => {
        const seen = new Set<string>();
        const next: AppScreenshotImportWarning[] = [];
        [...runnerImportWarnings, ...runnerIntegrityWarnings].forEach((warning) => {
            const key = `${warning.jobId}:${warning.code}:${warning.message}`;
            if (seen.has(key)) return;
            seen.add(key);
            next.push(warning);
        });
        return next;
    }, [runnerImportWarnings, runnerIntegrityWarnings]);

    return {
        appScreenshots,
        loading,
        error,
        refresh,
        selectedAppScreenshots,
        appScreenshotUrls,
        runnerImportWarnings: combinedRunnerWarnings,
        appScreenshotsUploading,
        isScreenshotDropActive,
        handleReorderAppScreenshot,
        handleDeleteAppScreenshot,
        handleScreenshotDragOver,
        handleScreenshotDragLeave,
        handleScreenshotDrop,
        handleAppScreenshotsUpload,
        canUploadAppScreenshots,
    };
};
