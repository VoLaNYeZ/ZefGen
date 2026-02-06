import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type {
    AppItem,
    AppScreenshot,
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
    removeGeneratedAssets,
    updateGeneratedAsset,
    uploadGeneratedAsset,
} from '../data/generated-assets';

type SlotMapping = {
    brandRefId: string | null;
    simShotId: string | null;
};

type ScreenshotKind = 'screenshot' | 'screenshot_enhanced';
type IconKind = 'icon' | 'icon_enhanced';

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

    const [iconGenerating, setIconGenerating] = useState(false);
    const [iconSlotGenerating, setIconSlotGenerating] = useState<number | null>(null);
    const [enhanceIconSlotGenerating, setEnhanceIconSlotGenerating] = useState<number | null>(null);
    const [screenshotsGenerating, setScreenshotsGenerating] = useState(false);
    const [slotGenerating, setSlotGenerating] = useState<number | null>(null);
    const [enhanceSlotGenerating, setEnhanceSlotGenerating] = useState<number | null>(null);
    const [generationCount, setGenerationCount] = useState(3);
    const [generationSize, setGenerationSize] = useState<'6.5' | '6.9'>('6.5');
    const [iconProviderId, setIconProviderId] = useState<ScreenshotProviderId>('replicate:seedream-4');
    const [iconVariationsCount, setIconVariationsCount] = useState(1);
    const [screenshotProviderId, setScreenshotProviderId] = useState<ScreenshotProviderId>('replicate:seedream-4');
    const [editAssetId, setEditAssetId] = useState<string | null>(null);
    const [editDrafts, setEditDrafts] = useState<Record<string, EditState>>({});
    const [editSaving, setEditSaving] = useState<string | null>(null);

    const headlineSaveTimersRef = useRef<Record<number, any>>({});
    const [slotHeadlineBySlotIndex, setSlotHeadlineBySlotIndex] = useState<Record<number, string>>({});
    const [slotHeadlinePosBySlotIndex, setSlotHeadlinePosBySlotIndex] = useState<Record<number, { x: number; y: number }>>({});
    const slotHeadlineHistoryRef = useRef<Record<number, { undo: Array<{ text: string; x: number; y: number }>; redo: Array<{ text: string; x: number; y: number }> }>>({});

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

    const selectedGeneratedAssets = useMemo(
        () => generatedAssets.filter((asset) => asset.app_id === selectedApp?.id),
        [generatedAssets, selectedApp?.id]
    );

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
        const slotMap = new Map<number, GeneratedAsset[]>();
        selectedGeneratedAssets
            .filter((asset) => asset.kind === 'screenshot' && asset.slot_index !== null)
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
    }, [selectedGeneratedAssets]);

    const enhancedScreenshotSlots = useMemo(() => {
        const slotMap = new Map<number, GeneratedAsset[]>();
        selectedGeneratedAssets
            .filter((asset) => asset.kind === 'screenshot_enhanced' && asset.slot_index !== null)
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
    }, [selectedGeneratedAssets]);

    const deriveSlotHeadlineBySlotIndex = useMemo(() => {
        const candidates = selectedGeneratedAssets.filter(
            (asset) =>
                (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced') &&
                asset.slot_index !== null
        );

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

        const result: Record<number, string> = {};
        for (const [slotIndex, payload] of Object.entries(bySlot)) {
            result[Number(slotIndex)] = payload.text;
        }
        return result;
    }, [selectedGeneratedAssets]);

    const deriveSlotHeadlinePosBySlotIndex = useMemo(() => {
        const candidates = selectedGeneratedAssets.filter(
            (asset) =>
                (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced') &&
                asset.slot_index !== null
        );

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

        const result: Record<number, { x: number; y: number }> = {};
        for (const [slotIndex, payload] of Object.entries(bySlot)) {
            result[Number(slotIndex)] = { x: payload.x, y: payload.y };
        }
        return result;
    }, [selectedGeneratedAssets]);

    useEffect(() => {
        if (!selectedApp?.id) {
            setSlotHeadlineBySlotIndex({});
            setSlotHeadlinePosBySlotIndex({});
            return;
        }
        setSlotHeadlineBySlotIndex(deriveSlotHeadlineBySlotIndex);
        setSlotHeadlinePosBySlotIndex(deriveSlotHeadlinePosBySlotIndex);
    }, [selectedApp?.id, deriveSlotHeadlineBySlotIndex, deriveSlotHeadlinePosBySlotIndex]);

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

    const handleDownloadAllScreenshots = async () => {
        if (!selectedApp) return;

        const items: Array<{ slotIndex: number; asset: GeneratedAsset }> = [];
        for (let slotIndex = 1; slotIndex <= targetSlotCount; slotIndex += 1) {
            const enh = enhancedScreenshotSlots.find((s) => s.slotIndex === slotIndex)?.versions ?? [];
            const gen = generatedScreenshotSlots.find((s) => s.slotIndex === slotIndex)?.versions ?? [];
            const chosen = pickLatest(enh) ?? pickLatest(gen);
            if (chosen) items.push({ slotIndex, asset: chosen });
        }

        if (!items.length) return;

        const jobId = createJob({
            title: 'Download screenshots zip',
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
                const sizeLabel = (asset.size_label as '6.5' | '6.9' | null) ?? generationSize;
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

            const zipName = `${selectedApp.alias || 'app'}-screenshots.zip`;
            downloadBlob(blob, zipName);

            finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            finishJob(jobId, { status: 'error', message: String(error?.message || 'ZIP failed').slice(0, 200) });
            reportError(error.message || text('download_failed'));
        }
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

    const getCarryForwardLayersForSlot = (slotIndex: number) => {
        const candidates = selectedGeneratedAssets
            .filter(
                (asset) =>
                    (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced') &&
                    (asset.slot_index ?? 0) === slotIndex
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

    const persistSlotHeadlineState = async (slotIndex: number, headline: { text: string; x: number; y: number }) => {
        if (!session) return;
        const assetsToUpdate = selectedGeneratedAssets.filter(
            (asset) =>
                (asset.kind === 'screenshot' || asset.kind === 'screenshot_enhanced') &&
                (asset.slot_index ?? 0) === slotIndex
        );
        if (!assetsToUpdate.length) return;

        const updates = await Promise.all(
            assetsToUpdate.map(async (asset) => {
                const storedLayers = (asset.edit_state as any)?.layers;
                // Important: headline autosave must NOT persist unrelated unsaved draft edits.
                // Always base the DB write on stored layers, and patch only layer[0].
                const layers = cloneLayers(storedLayers ?? []);
                if (!layers.length) {
                    layers.push(createHeadlineLayer(headline.text, { x: headline.x, y: headline.y }));
                } else {
                    layers[0] = { ...layers[0], text: headline.text, x: headline.x, y: headline.y };
                }

                setEditDrafts((prev) => {
                    const existing = prev[asset.id];
                    if (!existing) return prev;
                    const nextDraftLayers = cloneLayers(existing.layers ?? []);
                    if (!nextDraftLayers.length) {
                        nextDraftLayers.push(createHeadlineLayer(headline.text, { x: headline.x, y: headline.y }));
                    } else {
                        nextDraftLayers[0] = { ...nextDraftLayers[0], text: headline.text, x: headline.x, y: headline.y };
                    }
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
        const textValue = slotHeadlineBySlotIndex[slotIndex] ?? '';
        const pos = slotHeadlinePosBySlotIndex[slotIndex];
        const x = typeof pos?.x === 'number' ? pos.x : 50;
        const y = typeof pos?.y === 'number' ? pos.y : 12;
        return { text: textValue, x, y };
    };

    const schedulePersistSlotHeadline = (slotIndex: number, headline: { text: string; x: number; y: number }) => {
        if (headlineSaveTimersRef.current[slotIndex]) {
            clearTimeout(headlineSaveTimersRef.current[slotIndex]);
        }
        headlineSaveTimersRef.current[slotIndex] = setTimeout(() => {
            persistSlotHeadlineState(slotIndex, headline).catch((error: any) => {
                reportError(error.message || text('generation_failed'));
            });
        }, 500);
    };

    const pushHeadlineHistory = (slotIndex: number, prev: { text: string; x: number; y: number }) => {
        const existing = slotHeadlineHistoryRef.current[slotIndex] ?? { undo: [], redo: [] };
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
        slotHeadlineHistoryRef.current[slotIndex] = existing;
    };

    const applyHeadlineState = (slotIndex: number, next: { text: string; x: number; y: number }, opts?: { pushHistory?: boolean }) => {
        const prev = getSlotHeadlineState(slotIndex);
        if (opts?.pushHistory !== false) {
            pushHeadlineHistory(slotIndex, prev);
        }

        setSlotHeadlineBySlotIndex((p) => ({ ...p, [slotIndex]: next.text }));
        setSlotHeadlinePosBySlotIndex((p) => ({ ...p, [slotIndex]: { x: next.x, y: next.y } }));
        schedulePersistSlotHeadline(slotIndex, next);
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
        const history = slotHeadlineHistoryRef.current[slotIndex];
        if (!history?.undo?.length) return;
        const prev = history.undo[history.undo.length - 1];
        const current = getSlotHeadlineState(slotIndex);
        history.undo = history.undo.slice(0, -1);
        history.redo = [...history.redo, current].slice(-50);
        slotHeadlineHistoryRef.current[slotIndex] = history;
        applyHeadlineState(slotIndex, prev, { pushHistory: false });
    };

    const redoSlotHeadline = (slotIndex: number) => {
        const history = slotHeadlineHistoryRef.current[slotIndex];
        if (!history?.redo?.length) return;
        const next = history.redo[history.redo.length - 1];
        const current = getSlotHeadlineState(slotIndex);
        history.redo = history.redo.slice(0, -1);
        history.undo = [...history.undo, current].slice(-50);
        slotHeadlineHistoryRef.current[slotIndex] = history;
        applyHeadlineState(slotIndex, next, { pushHistory: false });
    };

    const getEffectiveLayersForScreenshotAsset = (asset: GeneratedAsset) => {
        const baseLayers =
            editDrafts[asset.id]?.layers ??
            ((asset.edit_state as any)?.layers as TextLayer[] | undefined) ??
            [];
        const layers = cloneLayers(baseLayers);

        const slotIndex = asset.slot_index ?? 0;
        const headlineText = slotHeadlineBySlotIndex[slotIndex] ?? (layers[0]?.text ?? '');
        const headlinePos = slotHeadlinePosBySlotIndex[slotIndex] ?? { x: layers[0]?.x ?? 50, y: layers[0]?.y ?? 12 };

        if (!layers.length) {
            layers.push(createHeadlineLayer(headlineText, headlinePos));
        } else {
            layers[0] = { ...layers[0], text: headlineText, x: headlinePos.x, y: headlinePos.y };
        }
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

            const failed: number[] = [];
            for (let i = 0; i < variations; i += 1) {
                const slotIndex = maxSlotIndex + 1 + i;
                setIconSlotGenerating(slotIndex);
                try {
                    setJobProgress(jobId, { current: i, total: variations });
                    setJobMessage(jobId, `Variation ${i + 1}/${variations}`);

                    const result = await requestGeneratedScreenshot({
                        providerId: iconProviderId,
                        prompt,
                        simulatorImageUrl: iconUrl,
                        brandRefImageUrl: iconUrl,
                        width: 1024,
                        height: 1024,
                    });

                    const blob = base64ToBlob(result.b64, result.mimeType);
                    // Icons should not be cropped; preserve by containing into the square if needed.
                    const jpgFile = await renderBlobToJpeg(blob, 1024, 1024, 'contain');
                    const version = 1;
                    const path = `${session.user.id}/apps/${selectedApp.id}/generated/icons/slot-${slotIndex}/v${version}-${createId()}.jpg`;

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
                    failed.push(slotIndex);
                }
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
            });

            const blob = base64ToBlob(result.b64, result.mimeType);
            const jpgFile = await renderBlobToJpeg(blob, 1024, 1024, 'contain');
            const path = `${session.user.id}/apps/${selectedApp.id}/generated/icons-enhanced/slot-${slotIndex}/v${nextVersion}-${createId()}.jpg`;

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
            reportError(error.message || text('generation_failed'));
            finishJob(jobId, { status: 'error', message: String(error?.message || 'Failed').slice(0, 200) });
        } finally {
            setEnhanceIconSlotGenerating(null);
        }
    };

    const requestGeneratedScreenshot = async (payload: {
        providerId: ScreenshotProviderId;
        prompt: string;
        simulatorImageUrl: string;
        brandRefImageUrl: string;
        width: number;
        height: number;
    }) => {
        if (!session?.access_token) {
            throw new Error('Missing session token.');
        }

        const response = await fetch('/api/generate-screenshot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = (data as any)?.error || `Generation failed (${response.status}).`;
            throw new Error(message);
        }

        const mimeType = (data as any)?.mimeType;
        const b64 = (data as any)?.b64;
        if (typeof mimeType !== 'string' || typeof b64 !== 'string' || !b64.length) {
            throw new Error('Generation API returned an invalid payload.');
        }

        return { mimeType, b64 };
    };

    const generateSlotOrThrow = async (slotIndex: number) => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!selectedAppScreenshots.length) {
            throw new Error(text('need_simulator_screenshots'));
        }

        const mapping = getSlotMapping(slotIndex);
        const brandRefId = mapping.brandRefId;
        const simShotId = mapping.simShotId;
        if (!brandRefId) {
            throw new Error(text('select_brand_reference'));
        }
        if (!simShotId) {
            throw new Error(text('select_sim_screenshot'));
        }

        const sourceShot = selectedAppScreenshots.find((shot) => shot.id === simShotId);
        if (!sourceShot) {
            throw new Error(text('select_sim_screenshot'));
        }

        const brandRef = brandScreenshotReferences.find((ref) => ref.id === brandRefId);
        if (!brandRef) {
            throw new Error(text('select_brand_reference'));
        }

        const simulatorImageUrl =
            appScreenshotUrls[sourceShot.id] ??
            (await getSignedUrl(APP_SCREENSHOT_BUCKET, sourceShot.image_path));
        const brandRefImageUrl =
            brandRefUrls[brandRef.id] ??
            (await getSignedUrl(BRAND_BUCKET, brandRef.image_path));

        const existingSlot = generatedScreenshotSlots.find((item) => item.slotIndex === slotIndex) || null;
        if (existingSlot && existingSlot.versions.length >= MAX_SCREENSHOT_VERSIONS) {
            throw new Error(text('version_limit_reached'));
        }

        const nextVersion = existingSlot
            ? Math.max(...existingSlot.versions.map((item) => item.version_index ?? 1)) + 1
            : 1;

        const sizeLabel = (existingSlot?.versions?.[0]?.size_label as '6.5' | '6.9' | null) ?? generationSize;
        const size = SCREENSHOT_SIZES[sizeLabel];

        const basePrompt = [
            // App Store readiness + strict constraints.
            `Create an App Store-ready iOS App Store screenshot (ready to upload to App Store Connect).`,
            `Use image 1 as the exact UI/layout source of truth (preserve the screen content, hierarchy, spacing, and readability).`,
            `Use image 2 only for styling (colors, lighting, background mood, composition), but do not obscure or distort the UI from image 1.`,
            `No device frame, no mockups, no hands, no floating phone, no bezels, no rounded outer corners, no drop-shadow that implies a device.`,
            `Do not add ANY promotional text or typography: no headings, captions, callouts, badges, stickers, labels, watermarks, logos, translations, or extra UI not present in image 1.`,
            `No watermarks, no brand marks, no provider marks.`,
            `If image 1 contains a promotional headline area at the top: remove that promotional text, but keep the layout scale the same and leave that area empty background (do not move/enlarge the UI to fill it).`,
            `Output must be a single full-bleed image at EXACTLY ${size.width}x${size.height} pixels (${sizeLabel}).`,
            `Match the target aspect ratio so the result needs no padding.`,
            `Do not crop away any important UI from image 1. Preserve the UI scale so text stays readable.`,
            `If you must crop slightly, crop only background areas, never the UI.`,
            `Keep the key UI content safely inside the frame (no critical elements touching the edges).`,
            `Keep it sharp and clean (no blur, no artifacts, no heavy grain).`,
        ].join(' ');
        const userPrompt = (promptsByRefId[brandRef.id] ?? '').trim();
        const prompt = userPrompt ? `${basePrompt}\n\n${userPrompt}` : basePrompt;

        const result = await requestGeneratedScreenshot({
            providerId: screenshotProviderId,
            prompt,
            simulatorImageUrl,
            brandRefImageUrl,
            width: size.width,
            height: size.height,
        });

        const blob = base64ToBlob(result.b64, result.mimeType);
        const jpgFile = await renderBlobToJpegAutoFit(blob, size.width, size.height);
        const path = `${session.user.id}/apps/${selectedApp.id}/generated/screenshots/slot-${slotIndex}/v${nextVersion}-${createId()}.jpg`;

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

        const headlineText = (slotHeadlineBySlotIndex[slotIndex] ?? '').trim();
        const headlinePos = slotHeadlinePosBySlotIndex[slotIndex] ?? { x: 50, y: 12 };
        const carryForward = getCarryForwardLayersForSlot(slotIndex);
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
            size_label: sizeLabel,
            width: size.width,
            height: size.height,
            status: 'ready',
            edit_state: { layers },
        });
        if (error) throw error;
        if (data) setGeneratedAssets((prev) => [...prev, data]);
    };

    const enhanceSlotOrThrow = async (payload: {
        slotIndex: number;
        base: { kind: ScreenshotKind; assetId: string };
        enhancePrompt: string;
    }) => {
        if (!session || !selectedBrand || !selectedApp) return;

        const { slotIndex, base, enhancePrompt } = payload;

        const mapping = getSlotMapping(slotIndex);
        const brandRefId = mapping.brandRefId;
        if (!brandRefId) {
            throw new Error(text('select_brand_reference'));
        }

        const brandRef = brandScreenshotReferences.find((ref) => ref.id === brandRefId);
        if (!brandRef) {
            throw new Error(text('select_brand_reference'));
        }

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
        const brandRefImageUrl =
            brandRefUrls[brandRef.id] ??
            (await getSignedUrl(BRAND_BUCKET, brandRef.image_path));

        const enhanceBasePrompt = [
            `Enhance image 1 into an App Store-ready iOS App Store screenshot (ready to upload to App Store Connect).`,
            `Preserve image 1 layout exactly: same UI scale, same composition, same spacing, same content.`,
            `Use image 2 only for styling (colors, lighting, background mood), but do not change the UI from image 1.`,
            `Remove any promotional text/headlines, but do not move/enlarge the UI to fill that space; leave it as empty background.`,
            `No device frame, no mockups, no watermarks, no added text.`,
            `Output must be EXACTLY ${size.width}x${size.height} pixels (${sizeLabel}).`,
            `Keep it sharp and clean (no blur, no artifacts).`,
        ].join(' ');
        const extra = String(enhancePrompt || '').trim();
        const prompt = extra ? `${enhanceBasePrompt}\n\n${extra}` : enhanceBasePrompt;

        const result = await requestGeneratedScreenshot({
            providerId: screenshotProviderId,
            prompt,
            simulatorImageUrl: baseImageUrl,
            brandRefImageUrl,
            width: size.width,
            height: size.height,
        });

        const blob = base64ToBlob(result.b64, result.mimeType);
        const jpgFile = await renderBlobToJpegAutoFit(blob, size.width, size.height);
        const path = `${session.user.id}/apps/${selectedApp.id}/generated/screenshots-enhanced/slot-${slotIndex}/v${nextVersion}-${createId()}.jpg`;

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

        const headlineText = (slotHeadlineBySlotIndex[slotIndex] ?? '').trim();
        const headlinePos = slotHeadlinePosBySlotIndex[slotIndex] ?? { x: 50, y: 12 };
        const carryForward = getCarryForwardLayersForSlot(slotIndex);
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
    };

    const handleGenerateSlot = async (slotIndex: number) => {
        if (!session || !selectedBrand || !selectedApp) return;
        setSlotGenerating(slotIndex);
        const jobId = createJob({
            title: `Generate screenshot ${slotIndex}`,
            kind: 'screenshot_generate',
            providerId: screenshotProviderId,
        });
        try {
            await generateSlotOrThrow(slotIndex);
            finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            reportError(error.message || text('generation_failed'));
            finishJob(jobId, { status: 'error', message: String(error?.message || 'Failed').slice(0, 200) });
        } finally {
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
        });
        try {
            await enhanceSlotOrThrow(payload);
            finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            reportError(error.message || text('generation_failed'));
            finishJob(jobId, { status: 'error', message: String(error?.message || 'Failed').slice(0, 200) });
        } finally {
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

        const failedSlots: number[] = [];
        setScreenshotsGenerating(true);
        try {
            for (let slotIndex = 1; slotIndex <= targetSlotCount; slotIndex++) {
                setJobProgress(jobId, { current: slotIndex - 1, total: targetSlotCount });
                setJobMessage(jobId, `Slot ${slotIndex}/${targetSlotCount}`);
                const existingSlot = generatedScreenshotSlots.find((item) => item.slotIndex === slotIndex) || null;
                if (existingSlot && existingSlot.versions.length >= MAX_SCREENSHOT_VERSIONS) {
                    continue;
                }
                setSlotGenerating(slotIndex);
                try {
                    await generateSlotOrThrow(slotIndex);
                } catch {
                    failedSlots.push(slotIndex);
                }
            }
        } finally {
            setSlotGenerating(null);
            setScreenshotsGenerating(false);
        }

        if (failedSlots.length) {
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

    return {
        generatedAssets,
        generatedUrls,
        generatedPreviewUrls,
        generationJobs,
        hasRunningJobs,
        dismissJob,
        clearFinished,
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
        setGenerationCount,
        generationSize,
        setGenerationSize,
        screenshotProviderId,
        setScreenshotProviderId,
        iconProviderId,
        setIconProviderId,
        iconVariationsCount,
        setIconVariationsCount,
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
        targetSlotCount,
        existingSlotCount,
        slotsToCreate,
        canGenerateIcon,
        canGenerateScreenshots,
    };
};
