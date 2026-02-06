import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../i18n';
import type { Brand, BrandReference } from '../types/zefgen';
import {
    createBrandReference,
    deleteBrandReference,
    fetchBrandReferences,
    removeBrandReferenceImage,
    updateBrandReference,
    updateBrandReferenceOrder,
    uploadBrandReferenceImage,
} from '../data/brand-references';
import { BRAND_BUCKET, MAX_SCREENSHOT_REFS } from '../constants/zefgen';
import { createId } from '../utils/id';
import { isFileTooLarge, isValidImageType, resizeImageToJpeg } from '../utils/images';
import { useSignedUrlCache } from './use-signed-url-cache';

type Params = {
    session: Session | null;
    selectedBrand: Brand | null;
    text: (key: TranslationKey) => string;
    reportError: (message: string) => void;
    onDataError?: (message: string) => void;
};

export const useBrandReferences = ({
    session,
    selectedBrand,
    text,
    reportError,
    onDataError,
}: Params) => {
    const [brandReferences, setBrandReferences] = useState<BrandReference[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastUserIdRef = useRef<string | null>(null);

    const [brandRefUrls, setBrandRefUrls] = useState<Record<string, string>>({});
    const [brandIconUrls, setBrandIconUrls] = useState<Record<string, string>>({});
    const [brandIconUploading, setBrandIconUploading] = useState(false);
    const [brandScreenshotsUploading, setBrandScreenshotsUploading] = useState(false);
    const [isBrandRefDropActive, setIsBrandRefDropActive] = useState(false);
    const { getSignedUrl } = useSignedUrlCache({ userId: session?.user.id ?? null });

    const sessionUserId = session?.user.id ?? null;

    const refresh = useCallback(async () => {
        if (!session) {
            setBrandReferences([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        setLoading(true);
        setError(null);
        const { data, error } = await fetchBrandReferences(session.user.id);
        if (error) {
            setError(error.message);
            onDataError?.(error.message);
        } else {
            setBrandReferences(data || []);
            lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
    }, [session, onDataError]);

    useEffect(() => {
        if (!session) {
            setBrandReferences([]);
            setLoading(false);
            setError(null);
            lastUserIdRef.current = null;
            return;
        }
        if (lastUserIdRef.current === session.user.id && brandReferences.length) return;
        refresh();
    }, [session, brandReferences.length, refresh]);

    const selectedBrandReferences = useMemo(
        () => brandReferences.filter((ref) => ref.brand_id === selectedBrand?.id),
        [brandReferences, selectedBrand?.id]
    );

    const brandIconReference = useMemo(
        () => selectedBrandReferences.find((ref) => ref.kind === 'icon') || null,
        [selectedBrandReferences]
    );

    const brandScreenshotReferences = useMemo(
        () =>
            selectedBrandReferences
                .filter((ref) => ref.kind === 'screenshot')
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
        [selectedBrandReferences]
    );

    useEffect(() => {
        if (!sessionUserId) {
            setBrandRefUrls({});
            return;
        }

        let isMounted = true;
        const loadUrls = async () => {
            const entries = await Promise.all(
                brandReferences
                    .filter((ref) => ref.image_path)
                    .map(async (ref) => {
                        try {
                            const url = await getSignedUrl(BRAND_BUCKET, ref.image_path);
                            return [ref.id, url] as const;
                        } catch (error: any) {
                            reportError(error.message);
                            return [ref.id, ''] as const;
                        }
                    })
            );

            if (!isMounted) return;
            setBrandRefUrls((prev) => {
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
    }, [sessionUserId, brandReferences, getSignedUrl, reportError]);

    useEffect(() => {
        if (!sessionUserId) {
            setBrandIconUrls({});
            return;
        }

        let isMounted = true;
        const loadIconUrls = async () => {
            const iconRefs = brandReferences.filter((ref) => ref.kind === 'icon' && ref.image_path);
            const entries = await Promise.all(
                iconRefs.map(async (ref) => {
                    try {
                        const url = await getSignedUrl(BRAND_BUCKET, ref.image_path);
                        return [ref.brand_id, url] as const;
                    } catch (error: any) {
                        reportError(error.message);
                        return [ref.brand_id, ''] as const;
                    }
                })
            );

            if (!isMounted) return;
            const nextUrls: Record<string, string> = {};
            entries.forEach(([brandId, url]) => {
                if (url) nextUrls[brandId] = url;
            });
            setBrandIconUrls(nextUrls);
        };

        loadIconUrls();
        return () => {
            isMounted = false;
        };
    }, [sessionUserId, brandReferences, getSignedUrl, reportError]);

    const normalizeScreenshotFiles = (files: File[]) =>
        [...files].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

    const handleBrandIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !session || !selectedBrand) return;

        if (!isValidImageType(file)) {
            reportError(text('invalid_file_type'));
            return;
        }
        if (isFileTooLarge(file)) {
            reportError(text('file_too_large'));
            return;
        }

        setBrandIconUploading(true);

        try {
            // Keep icon references light and predictable for provider uploads (no upscaling).
            const jpgFile = await resizeImageToJpeg(file, 1024, 1024);
            const path = `${session.user.id}/brands/${selectedBrand.id}/icon/${createId()}.jpg`;
            const { error: uploadError } = await uploadBrandReferenceImage({
                path,
                file: jpgFile,
                contentType: 'image/jpeg',
            });

            if (uploadError) throw uploadError;

            if (brandIconReference?.image_path) {
                await removeBrandReferenceImage(brandIconReference.image_path);
            }

            if (brandIconReference) {
                const { data, error } = await updateBrandReference({
                    id: brandIconReference.id,
                    userId: session.user.id,
                    patch: { image_path: path },
                });
                if (error) throw error;
                if (data) {
                    setBrandReferences((prev) => prev.map((ref) => (ref.id === data.id ? data : ref)));
                }
            } else {
                const { data, error } = await createBrandReference({
                    userId: session.user.id,
                    brandId: selectedBrand.id,
                    kind: 'icon',
                    imagePath: path,
                    prompt: '',
                    orderIndex: 0,
                });
                if (error) throw error;
                if (data) {
                    setBrandReferences((prev) => [...prev, data]);
                }
            }
        } catch (error: any) {
            reportError(error.message || text('upload_failed'));
        } finally {
            setBrandIconUploading(false);
        }
    };

    const uploadBrandScreenshotReferences = async (files: File[]) => {
        if (!files.length || !session || !selectedBrand) return;

        if (brandScreenshotReferences.length >= MAX_SCREENSHOT_REFS) {
            reportError(text('max_screenshot_refs'));
            return;
        }

        const remainingSlots = MAX_SCREENSHOT_REFS - brandScreenshotReferences.length;
        const uploadFiles = normalizeScreenshotFiles(files).slice(0, remainingSlots);

        setBrandScreenshotsUploading(true);

        try {
            for (let index = 0; index < uploadFiles.length; index += 1) {
                const file = uploadFiles[index];
                if (!isValidImageType(file)) {
                    reportError(text('invalid_file_type'));
                    continue;
                }
                if (isFileTooLarge(file)) {
                    reportError(text('file_too_large'));
                    continue;
                }

                const jpgFile = await resizeImageToJpeg(file, 1320, 2868);
                const path = `${session.user.id}/brands/${selectedBrand.id}/screenshots/${createId()}.jpg`;
                const { error: uploadError } = await uploadBrandReferenceImage({
                    path,
                    file: jpgFile,
                    contentType: 'image/jpeg',
                });
                if (uploadError) throw uploadError;

                const { data, error } = await createBrandReference({
                    userId: session.user.id,
                    brandId: selectedBrand.id,
                    kind: 'screenshot',
                    imagePath: path,
                    prompt: '',
                    orderIndex: brandScreenshotReferences.length + index,
                });
                if (error) throw error;
                if (data) {
                    setBrandReferences((prev) => [...prev, data]);
                }
            }
        } catch (error: any) {
            reportError(error.message || text('upload_failed'));
        } finally {
            setBrandScreenshotsUploading(false);
        }
    };

    const handleBrandScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files: File[] = event.target.files ? Array.from(event.target.files) : [];
        event.target.value = '';
        await uploadBrandScreenshotReferences(files);
    };

    const handleBrandReferenceDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsBrandRefDropActive(false);
        if (brandScreenshotsUploading) return;
        const files: File[] = Array.from(event.dataTransfer.files);
        await uploadBrandScreenshotReferences(files);
    };

    const handleBrandReferenceDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!isBrandRefDropActive) {
            setIsBrandRefDropActive(true);
        }
    };

    const handleBrandReferenceDragLeave = () => {
        setIsBrandRefDropActive(false);
    };

    const handleBrandPromptChange = (refId: string, value: string) => {
        setBrandReferences((prev) =>
            prev.map((ref) => (ref.id === refId ? { ...ref, prompt: value } : ref))
        );
    };

    const handleBrandPromptSave = async (refId: string, value: string) => {
        if (!session) return;
        const { error } = await updateBrandReference({
            id: refId,
            userId: session.user.id,
            patch: { prompt: value },
        });
        if (error) reportError(error.message);
    };

    const handleDeleteBrandReference = async (ref: BrandReference) => {
        if (!session) return;
        const { error } = await deleteBrandReference({
            id: ref.id,
            userId: session.user.id,
        });
        if (error) {
            reportError(error.message);
            return;
        }

        if (ref.image_path) {
            await removeBrandReferenceImage(ref.image_path);
        }

        if (ref.kind === 'screenshot') {
            const remaining = brandScreenshotReferences.filter((item) => item.id !== ref.id);
            setBrandReferences((prev) =>
                prev
                    .filter((item) => item.id !== ref.id)
                    .map((item) => {
                        const idx = remaining.findIndex((shot) => shot.id === item.id);
                        if (idx === -1) return item;
                        return { ...item, order_index: idx };
                    })
            );
            await Promise.all(
                remaining.map((item, index) =>
                    updateBrandReferenceOrder({
                        id: item.id,
                        userId: session.user.id,
                        orderIndex: index,
                    })
                )
            );
        } else {
            setBrandReferences((prev) => prev.filter((item) => item.id !== ref.id));
        }
    };

    const handleReorderBrandReference = async (fromIndex: number, toIndex: number) => {
        if (!session) return;
        if (toIndex < 0 || toIndex >= brandScreenshotReferences.length) return;

        const next = [...brandScreenshotReferences];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        setBrandReferences((prev) =>
            prev.map((ref) => {
                if (ref.kind !== 'screenshot') return ref;
                const idx = next.findIndex((item) => item.id === ref.id);
                if (idx === -1) return ref;
                return { ...ref, order_index: idx };
            })
        );

        await Promise.all(
            next.map((ref, index) =>
                updateBrandReferenceOrder({
                    id: ref.id,
                    userId: session.user.id,
                    orderIndex: index,
                })
            )
        );
    };

    return {
        brandReferences,
        loading,
        error,
        refresh,
        brandRefUrls,
        brandIconUrls,
        brandIconReference,
        brandScreenshotReferences,
        brandIconUploading,
        brandScreenshotsUploading,
        isBrandRefDropActive,
        handleBrandIconUpload,
        handleBrandScreenshotUpload,
        handleBrandReferenceDrop,
        handleBrandReferenceDragOver,
        handleBrandReferenceDragLeave,
        handleReorderBrandReference,
        handleDeleteBrandReference,
        handleBrandPromptChange,
        handleBrandPromptSave,
        setIsBrandRefDropActive,
    };
};
