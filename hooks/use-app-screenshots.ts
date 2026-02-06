import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { AppItem, AppScreenshot, Brand } from '../types/zefgen';
import {
    createAppScreenshot,
    deleteAppScreenshot,
    fetchAppScreenshots,
    removeAppScreenshotImage,
    updateAppScreenshotOrder,
    uploadAppScreenshotImage,
} from '../data/app-screenshots';
import { createId } from '../utils/id';
import { isFileTooLarge, isValidImageType, resizeImageToJpeg } from '../utils/images';
import { useSignedUrlCache } from './use-signed-url-cache';
import { APP_SCREENSHOT_BUCKET } from '../constants/zefgen';

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
    const { getSignedUrl } = useSignedUrlCache({ userId: session?.user.id ?? null });
    const sessionUserId = session?.user.id ?? null;

    const refresh = useCallback(async () => {
        if (!session) {
            setAppScreenshots([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        setLoading(true);
        setError(null);
        const { data, error } = await fetchAppScreenshots(session.user.id);
        if (error) {
            setError(error.message);
            onDataError?.(error.message);
        } else {
            setAppScreenshots(data || []);
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [session, onDataError]);

    useEffect(() => {
        if (!session) {
            setAppScreenshots([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id && appScreenshots.length) return;
        refresh();
    }, [session, appScreenshots.length, refresh]);

    const selectedAppScreenshots = useMemo(
        () =>
            appScreenshots
                .filter((shot) => shot.app_id === selectedApp?.id)
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
        [appScreenshots, selectedApp?.id]
    );

    const canUploadAppScreenshots = Boolean(selectedApp && selectedBrand);

    useEffect(() => {
        if (!sessionUserId) {
            setAppScreenshotUrls({});
            return;
        }

        let isMounted = true;
        const loadUrls = async () => {
            const entries = await Promise.all(
                appScreenshots
                    .filter((shot) => shot.image_path)
                    .map(async (shot) => {
                        try {
                            const url = await getSignedUrl(APP_SCREENSHOT_BUCKET, shot.image_path);
                            return [shot.id, url] as const;
                        } catch (error: any) {
                            reportError(error.message);
                            return [shot.id, ''] as const;
                        }
                    })
            );

            if (!isMounted) return;
            setAppScreenshotUrls((prev) => {
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
    }, [sessionUserId, appScreenshots, getSignedUrl, reportError]);

    const normalizeScreenshotFiles = (files: File[]) =>
        [...files].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

    const uploadAppScreenshots = async (files: File[]) => {
        if (!files.length || !session || !selectedBrand || !selectedApp) return;

        setAppScreenshotsUploading(true);

        try {
            const orderedFiles = normalizeScreenshotFiles(files);
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

                const { data, error } = await createAppScreenshot({
                    userId: session.user.id,
                    brandId: selectedBrand.id,
                    appId: selectedApp.id,
                    imagePath: path,
                    orderIndex: selectedAppScreenshots.length + index,
                });
                if (error) throw error;
                if (data) {
                    setAppScreenshots((prev) => [...prev, data]);
                }
            }
        } catch (error: any) {
            reportError(error.message || text('upload_failed'));
        } finally {
            setAppScreenshotsUploading(false);
        }
    };

    const handleAppScreenshotsUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files: File[] = event.target.files ? Array.from(event.target.files) : [];
        event.target.value = '';
        await uploadAppScreenshots(files);
    };

    const handleScreenshotDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsScreenshotDropActive(false);
        if (appScreenshotsUploading) return;
        const files: File[] = Array.from(event.dataTransfer.files);
        await uploadAppScreenshots(files);
    };

    const handleScreenshotDragOver = (event: React.DragEvent<HTMLDivElement>) => {
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
        const { error } = await deleteAppScreenshot({ id: shot.id, userId: session.user.id });
        if (error) {
            reportError(error.message);
            return;
        }

        if (shot.image_path) {
            await removeAppScreenshotImage(shot.image_path);
        }

        const remaining = selectedAppScreenshots.filter((item) => item.id !== shot.id);
        setAppScreenshots((prev) =>
            prev
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
    };

    const handleReorderAppScreenshot = async (fromIndex: number, toIndex: number) => {
        if (!session) return;
        if (toIndex < 0 || toIndex >= selectedAppScreenshots.length) return;

        const next = [...selectedAppScreenshots];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        setAppScreenshots((prev) =>
            prev.map((shot) => {
                const idx = next.findIndex((item) => item.id === shot.id);
                if (idx === -1) return shot;
                return { ...shot, order_index: idx };
            })
        );

        await Promise.all(
            next.map((shot, index) =>
                updateAppScreenshotOrder({
                    id: shot.id,
                    userId: session.user.id,
                    orderIndex: index,
                })
            )
        );
    };

    return {
        appScreenshots,
        loading,
        error,
        refresh,
        selectedAppScreenshots,
        appScreenshotUrls,
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
