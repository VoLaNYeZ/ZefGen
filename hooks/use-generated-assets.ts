import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { AppItem, AppScreenshot, Brand, BrandReference, EditState, GeneratedAsset, TextLayer } from '../types/zefgen';
import {
    APP_SCREENSHOT_BUCKET,
    BRAND_BUCKET,
    EDIT_FONTS,
    GENERATED_BUCKET,
    MAX_SCREENSHOT_VERSIONS,
    SCREENSHOT_SIZES,
} from '../constants/zefgen';
import { createId } from '../utils/id';
import { renderImageToJpeg } from '../utils/images';
import { triggerDownload } from '../utils/download';
import { useSignedUrlCache } from './use-signed-url-cache';
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

type Params = {
    session: Session | null;
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    selectedAppScreenshots: AppScreenshot[];
    appScreenshotUrls: Record<string, string>;
    brandIconReference: BrandReference | null;
    brandRefUrls: Record<string, string>;
    getSlotMapping: (slotIndex: number) => SlotMapping;
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
    brandRefUrls,
    getSlotMapping,
    text,
    reportError,
    onDataError,
}: Params) => {
    const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
    const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);
    const { getSignedUrl } = useSignedUrlCache();

    const [iconGenerating, setIconGenerating] = useState(false);
    const [screenshotsGenerating, setScreenshotsGenerating] = useState(false);
    const [slotGenerating, setSlotGenerating] = useState<number | null>(null);
    const [generationCount, setGenerationCount] = useState(3);
    const [generationSize, setGenerationSize] = useState<'6.5' | '6.9'>('6.5');
    const [editAssetId, setEditAssetId] = useState<string | null>(null);
    const [editDrafts, setEditDrafts] = useState<Record<string, EditState>>({});
    const [editSaving, setEditSaving] = useState<string | null>(null);

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

    const generatedIcon = useMemo(() => {
        const icons = selectedGeneratedAssets.filter((asset) => asset.kind === 'icon');
        if (!icons.length) return null;
        return [...icons].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
        })[0];
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

    useEffect(() => {
        if (!session?.user.id) {
            setGeneratedUrls({});
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
                            return [asset.id, url] as const;
                        } catch (error: any) {
                            reportError(error.message);
                            return [asset.id, ''] as const;
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
            triggerDownload(url, filename);
        } catch (error: any) {
            reportError(error.message || text('download_failed'));
        }
    };

    const handleDownloadAllScreenshots = async () => {
        if (!generatedScreenshotSlots.length) return;
        for (const slot of generatedScreenshotSlots) {
            const latest = slot.versions.reduce((prev, current) => {
                const prevIndex = prev.version_index ?? 1;
                const currentIndex = current.version_index ?? 1;
                return currentIndex > prevIndex ? current : prev;
            }, slot.versions[0]);
            if (!latest) continue;
            const filename = `${formatSlotIndex(slot.slotIndex)}.jpg`;
            await handleDownloadGeneratedAsset(latest, filename);
            await new Promise((resolve) => setTimeout(resolve, 120));
        }
    };

    const createDefaultLayer = () => ({
        id: createId(),
        text: text('text_layer_default'),
        font: EDIT_FONTS[0],
        size: 72,
        color: '#ffffff',
        x: 50,
        y: 18,
        rotation: 0,
        align: 'center' as const,
        weight: 600,
    });

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
            await removeGeneratedAssets([asset.image_path]);
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
            const jpgFile = await renderImageToJpeg(iconUrl, 1024, 1024, 'contain');
            const path = `${session.user.id}/apps/${selectedApp.id}/generated/icon/${createId()}.jpg`;

            const { error: uploadError } = await uploadGeneratedAsset({
                path,
                file: jpgFile,
                contentType: 'image/jpeg',
            });
            if (uploadError) throw uploadError;

            const existingIcons = selectedGeneratedAssets.filter((asset) => asset.kind === 'icon');
            if (existingIcons.length) {
                await deleteGeneratedAssetsByIds({
                    ids: existingIcons.map((asset) => asset.id),
                    userId: session.user.id,
                });
                await removeGeneratedAssets(existingIcons.map((asset) => asset.image_path));
                setGeneratedAssets((prev) =>
                    prev.filter((asset) => !(asset.app_id === selectedApp.id && asset.kind === 'icon'))
                );
            }

            const { data, error } = await createGeneratedAsset({
                app_id: selectedApp.id,
                brand_id: selectedBrand.id,
                user_id: session.user.id,
                kind: 'icon',
                slot_index: 0,
                version_index: 1,
                image_path: path,
                size_label: '1024',
                width: 1024,
                height: 1024,
                status: 'ready',
                edit_state: null,
            });
            if (error) throw error;
            if (data) setGeneratedAssets((prev) => [...prev, data]);
        } catch (error: any) {
            reportError(error.message || text('generation_failed'));
        } finally {
            setIconGenerating(false);
        }
    };

    const handleGenerateScreenshots = async () => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!selectedAppScreenshots.length) {
            reportError(text('need_simulator_screenshots'));
            return;
        }

        const targetCount = Math.min(Math.max(generationCount, 3), 6);
        if (selectedAppScreenshots.length < targetCount) {
            reportError(text('not_enough_sim_screenshots'));
            return;
        }

        const existingSlots = new Set(generatedScreenshotSlots.map((slot) => slot.slotIndex));
        const slotsToCreate = Array.from({ length: targetCount }, (_, index) => index + 1).filter(
            (slotIndex) => !existingSlots.has(slotIndex)
        );

        if (!slotsToCreate.length) {
            reportError(text('all_slots_ready'));
            return;
        }

        setScreenshotsGenerating(true);

        try {
            for (const slotIndex of slotsToCreate) {
                const mapping = getSlotMapping(slotIndex);
                const sourceShot = selectedAppScreenshots.find((shot) => shot.id === mapping.simShotId)
                    ?? selectedAppScreenshots[slotIndex - 1];
                if (!sourceShot) continue;
                const sourceUrl =
                    appScreenshotUrls[sourceShot.id] ??
                    (await getSignedUrl(APP_SCREENSHOT_BUCKET, sourceShot.image_path));
                const size = SCREENSHOT_SIZES[generationSize];
                const jpgFile = await renderImageToJpeg(sourceUrl, size.width, size.height, 'cover');
                const path = `${session.user.id}/apps/${selectedApp.id}/generated/screenshots/slot-${slotIndex}/v1-${createId()}.jpg`;
                const { error: uploadError } = await uploadGeneratedAsset({
                    path,
                    file: jpgFile,
                    contentType: 'image/jpeg',
                });
                if (uploadError) throw uploadError;

                const { data, error } = await createGeneratedAsset({
                    app_id: selectedApp.id,
                    brand_id: selectedBrand.id,
                    user_id: session.user.id,
                    kind: 'screenshot',
                    slot_index: slotIndex,
                    version_index: 1,
                    image_path: path,
                    size_label: generationSize,
                    width: size.width,
                    height: size.height,
                    status: 'ready',
                    edit_state: null,
                });
                if (error) throw error;
                if (data) setGeneratedAssets((prev) => [...prev, data]);
            }
        } catch (error: any) {
            reportError(error.message || text('generation_failed'));
        } finally {
            setScreenshotsGenerating(false);
        }
    };

    const handleGenerateScreenshotVersion = async (slotIndex: number) => {
        if (!session || !selectedBrand || !selectedApp) return;
        const slot = generatedScreenshotSlots.find((item) => item.slotIndex === slotIndex);
        if (!slot) return;
        if (slot.versions.length >= MAX_SCREENSHOT_VERSIONS) {
            reportError(text('version_limit_reached'));
            return;
        }
        if (selectedAppScreenshots.length < slotIndex) {
            reportError(text('not_enough_sim_screenshots'));
            return;
        }

        setSlotGenerating(slotIndex);

        try {
            const mapping = getSlotMapping(slotIndex);
            const sourceShot = selectedAppScreenshots.find((shot) => shot.id === mapping.simShotId)
                ?? selectedAppScreenshots[slotIndex - 1];
            if (!sourceShot) {
                reportError(text('select_sim_screenshot'));
                return;
            }
            const sourceUrl =
                appScreenshotUrls[sourceShot.id] ??
                (await getSignedUrl(APP_SCREENSHOT_BUCKET, sourceShot.image_path));
            const sizeLabel = (slot.versions[0]?.size_label as '6.5' | '6.9' | null) ?? generationSize;
            const size = SCREENSHOT_SIZES[sizeLabel];
            const nextVersion = Math.max(...slot.versions.map((item) => item.version_index ?? 1)) + 1;
            const jpgFile = await renderImageToJpeg(sourceUrl, size.width, size.height, 'cover');
            const path = `${session.user.id}/apps/${selectedApp.id}/generated/screenshots/slot-${slotIndex}/v${nextVersion}-${createId()}.jpg`;
            const { error: uploadError } = await uploadGeneratedAsset({
                path,
                file: jpgFile,
                contentType: 'image/jpeg',
            });
            if (uploadError) throw uploadError;

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
                edit_state: null,
            });
            if (error) throw error;
            if (data) setGeneratedAssets((prev) => [...prev, data]);
        } catch (error: any) {
            reportError(error.message || text('generation_failed'));
        } finally {
            setSlotGenerating(null);
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
        loading,
        error,
        refresh,
        selectedGeneratedAssets,
        generatedIcon,
        generatedScreenshotSlots,
        iconGenerating,
        screenshotsGenerating,
        slotGenerating,
        generationCount,
        setGenerationCount,
        generationSize,
        setGenerationSize,
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
        handleGenerateScreenshots,
        handleGenerateScreenshotVersion,
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
