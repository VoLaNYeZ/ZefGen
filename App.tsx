import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Menu,
    DoorOpen,
    Plus,
    Pencil,
    Link2,
    ArrowUpRight,
    GripVertical,
    ImagePlus,
    Download,
    Trash2,
    Loader2,
    AlertTriangle,
    X,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { LoginPage } from './components/LoginPage';
import { Session } from '@supabase/supabase-js';
import { t, TranslationKey } from './i18n';
import {
    BreathingText,
    LetterSwapForward,
    LetterSwapPingPong,
    ScrambleHover,
    VariableFontCursorProximity,
    VariableFontHoverByRandomLetter,
} from './components/fancy/text';

type Brand = {
    id: string;
    name: string;
    slug: string;
    user_id?: string;
    created_at?: string;
};

type AppItem = {
    id: string;
    brand_id: string;
    name: string;
    alias: string;
    user_id?: string;
    created_at?: string;
};

type BrandReference = {
    id: string;
    brand_id: string;
    user_id?: string;
    kind: 'icon' | 'screenshot';
    image_path: string;
    prompt: string | null;
    order_index: number | null;
    created_at?: string;
};

type AppScreenshot = {
    id: string;
    app_id: string;
    brand_id: string;
    user_id?: string;
    image_path: string;
    order_index: number | null;
    created_at?: string;
};

type GeneratedAsset = {
    id: string;
    app_id: string;
    brand_id: string;
    user_id?: string;
    kind: 'icon' | 'screenshot';
    slot_index: number | null;
    version_index: number | null;
    image_path: string;
    size_label: string | null;
    width: number | null;
    height: number | null;
    status: 'ready' | 'pending' | 'failed' | null;
    edit_state: EditState | null;
    created_at?: string;
};

type TextLayer = {
    id: string;
    text: string;
    font: string;
    size: number;
    color: string;
    x: number;
    y: number;
    rotation: number;
    align: 'left' | 'center' | 'right';
    weight: number;
};

type EditState = {
    layers: TextLayer[];
};

type BrandFormState = {
    name: string;
};

type AppFormState = {
    name: string;
    alias: string;
};

const MAX_FILE_MB = 10;
const MAX_SCREENSHOT_REFS = 6;
const MAX_SCREENSHOT_VERSIONS = 3;
const AUTO_GROW_MULTIPLIER = 5;
const BRAND_BUCKET = 'brand-references';
const APP_SCREENSHOT_BUCKET = 'app-screenshots';
const GENERATED_BUCKET = 'generated-assets';

const SCREENSHOT_SIZES = {
    '6.5': { width: 1242, height: 2688 },
    '6.9': { width: 1320, height: 2868 },
} as const;

const EDIT_FONTS = [
    'Manrope',
    'Rubik',
    'PT Sans',
    'PT Serif',
    'Montserrat',
    'Playfair Display',
    'Source Sans 3',
    'Source Serif 4',
];

const slugify = (value: string) => {
    const cleaned = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    return cleaned || 'untitled';
};

const makeUniqueSlug = (base: string, existing: string[]) => {
    if (!existing.includes(base)) return base;

    let suffix = 2;
    let candidate = `${base}-${suffix}`;

    while (existing.includes(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
    }

    return candidate;
};

const buildRoute = (brand?: Brand | null, app?: AppItem | null) => {
    if (!brand) return '/';
    if (!app) return `/${brand.slug}`;
    return `/${brand.slug}/${app.alias}`;
};

const parseRoute = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return {
        brandSlug: parts[0],
        appAlias: parts[1],
    };
};

const createId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isValidImageType = (file: File) => ['image/jpeg', 'image/png'].includes(file.type);

const isFileTooLarge = (file: File) => file.size > MAX_FILE_MB * 1024 * 1024;

const convertToJpg = async (file: File) => {
    if (file.type === 'image/jpeg') return file;

    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');
    context.drawImage(image, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to convert image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            0.92
        );
    });

    return new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' });
};

const loadImageFromFile = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image.'));
        };
        img.src = objectUrl;
    });

const resizeImageToJpeg = async (file: File, maxWidth: number, maxHeight: number) => {
    const image = await loadImageFromFile(file);
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to convert image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            0.9
        );
    });

    return new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' });
};

const syncAutoGrowTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const baseHeight = element.dataset.baseHeight
        ? Number(element.dataset.baseHeight)
        : element.offsetHeight || element.scrollHeight;
    if (!element.dataset.baseHeight) {
        element.dataset.baseHeight = String(baseHeight);
    }
    const maxHeight = baseHeight * AUTO_GROW_MULTIPLIER;
    element.style.minHeight = `${baseHeight}px`;
    element.style.maxHeight = `${maxHeight}px`;
    element.style.height = 'auto';
    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = `${nextHeight}px`;
    if (element.scrollHeight > maxHeight) {
        element.style.resize = 'vertical';
        element.style.overflowY = 'auto';
    } else {
        element.style.resize = 'none';
        element.style.overflowY = 'hidden';
    }
};

const loadImageFromUrl = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image.'));
        };
        img.src = objectUrl;
    });
};

const drawImageFit = (
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
    mode: 'cover' | 'contain'
) => {
    const scale = mode === 'cover'
        ? Math.max(width / image.width, height / image.height)
        : Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const dx = (width - drawWidth) / 2;
    const dy = (height - drawHeight) / 2;
    context.drawImage(image, dx, dy, drawWidth, drawHeight);
};

const renderImageToJpeg = async (
    url: string,
    width: number,
    height: number,
    mode: 'cover' | 'contain'
) => {
    const image = await loadImageFromUrl(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas.');
    context.fillStyle = '#0b1020';
    context.fillRect(0, 0, width, height);
    drawImageFit(context, image, width, height, mode);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (result) => {
                if (!result) {
                    reject(new Error('Failed to render image.'));
                    return;
                }
                resolve(result);
            },
            'image/jpeg',
            0.92
        );
    });

    return new File([blob], `generated-${Date.now()}.jpg`, { type: 'image/jpeg' });
};

function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lang, setLang] = useState<'en' | 'ru'>('en');
    const text = (key: TranslationKey) => t(lang, key);

    const [brands, setBrands] = useState<Brand[]>([]);
    const [apps, setApps] = useState<AppItem[]>([]);
    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);
    const [hasParsedRoute, setHasParsedRoute] = useState(false);

    const [brandFormOpen, setBrandFormOpen] = useState(false);
    const [brandForm, setBrandForm] = useState<BrandFormState>({ name: '' });
    const [brandFormError, setBrandFormError] = useState<string | null>(null);
    const [brandFormLoading, setBrandFormLoading] = useState(false);
    const [editingBrandId, setEditingBrandId] = useState<string | null>(null);

    const [appFormOpen, setAppFormOpen] = useState(false);
    const [appForm, setAppForm] = useState<AppFormState>({ name: '', alias: '' });
    const [appFormError, setAppFormError] = useState<string | null>(null);
    const [appFormLoading, setAppFormLoading] = useState(false);
    const [editingAppId, setEditingAppId] = useState<string | null>(null);
    const [brandReferences, setBrandReferences] = useState<BrandReference[]>([]);
    const [appScreenshots, setAppScreenshots] = useState<AppScreenshot[]>([]);
    const [brandRefUrls, setBrandRefUrls] = useState<Record<string, string>>({});
    const [brandIconUrls, setBrandIconUrls] = useState<Record<string, string>>({});
    const [appScreenshotUrls, setAppScreenshotUrls] = useState<Record<string, string>>({});
    const [brandIconUploading, setBrandIconUploading] = useState(false);
    const [brandScreenshotsUploading, setBrandScreenshotsUploading] = useState(false);
    const [appScreenshotsUploading, setAppScreenshotsUploading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [logoVariantIndex, setLogoVariantIndex] = useState(() => Math.floor(Math.random() * 6));
    const logoWord = 'ZEFGEN';
    const logoContainerRef = useRef<HTMLDivElement>(null);
    const [logoFontReady, setLogoFontReady] = useState(false);
    const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
    const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({});
    const [iconGenerating, setIconGenerating] = useState(false);
    const [screenshotsGenerating, setScreenshotsGenerating] = useState(false);
    const [slotGenerating, setSlotGenerating] = useState<number | null>(null);
    const [generationCount, setGenerationCount] = useState(3);
    const [generationSize, setGenerationSize] = useState<'6.5' | '6.9'>('6.5');
    const [editAssetId, setEditAssetId] = useState<string | null>(null);
    const [editDrafts, setEditDrafts] = useState<Record<string, EditState>>({});
    const [editSaving, setEditSaving] = useState<string | null>(null);
    const [isScreenshotDropActive, setIsScreenshotDropActive] = useState(false);
    const [draggingShotId, setDraggingShotId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const ready = () => {
            if (active) setLogoFontReady(true);
        };
        if (document?.fonts?.ready) {
            document.fonts.ready.then(ready).catch(ready);
        } else {
            ready();
        }
        return () => {
            active = false;
        };
    }, []);
    const [dragOverShotId, setDragOverShotId] = useState<string | null>(null);
    const [isBrandRefDropActive, setIsBrandRefDropActive] = useState(false);
    const [draggingBrandRefId, setDraggingBrandRefId] = useState<string | null>(null);
    const [dragOverBrandRefId, setDragOverBrandRefId] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
    const signedUrlCacheRef = useRef<Record<string, { url: string; expiresAt: number }>>({});
    const lastFetchedUserIdRef = useRef<string | null>(null);
    const [slotMappings, setSlotMappings] = useState<Record<number, { brandRefId: string | null; simShotId: string | null }>>({});
    const sessionUserId = session?.user.id ?? null;

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    const fetchData = async (activeSession: Session) => {
        setDataLoading(true);
        setDataError(null);

        const { data: brandRows, error: brandError } = await supabase
            .from('brands')
            .select('*')
            .eq('user_id', activeSession.user.id)
            .order('created_at', { ascending: true });

        if (brandError) {
            setDataError(brandError.message);
            setDataLoading(false);
            return;
        }

        const { data: appRows, error: appError } = await supabase
            .from('apps')
            .select('*')
            .eq('user_id', activeSession.user.id)
            .order('created_at', { ascending: true });

        if (appError) {
            setDataError(appError.message);
        }

        const { data: brandRefRows, error: brandRefError } = await supabase
            .from('brand_references')
            .select('*')
            .eq('user_id', activeSession.user.id)
            .order('order_index', { ascending: true });

        if (brandRefError) {
            setDataError(brandRefError.message);
        }

        const { data: screenshotRows, error: screenshotError } = await supabase
            .from('app_screenshots')
            .select('*')
            .eq('user_id', activeSession.user.id)
            .order('order_index', { ascending: true });

        if (screenshotError) {
            setDataError(screenshotError.message);
        }

        const { data: generatedRows, error: generatedError } = await supabase
            .from('app_generated_assets')
            .select('*')
            .eq('user_id', activeSession.user.id)
            .order('created_at', { ascending: true });

        if (generatedError) {
            if (generatedError.message?.includes('app_generated_assets')) {
                setGeneratedAssets([]);
            } else {
                setDataError(generatedError.message);
            }
        }

        setBrands(brandRows || []);
        setApps(appRows || []);
        setBrandReferences(brandRefRows || []);
        setAppScreenshots(screenshotRows || []);
        setGeneratedAssets(generatedRows || []);
        setDataLoading(false);
    };

    useEffect(() => {
        if (!session) return;
        if (lastFetchedUserIdRef.current === session.user.id && brands.length) return;
        (async () => {
            await fetchData(session);
            lastFetchedUserIdRef.current = session.user.id;
        })();
    }, [session, brands.length]);
    const selectedBrand = useMemo(
        () => brands.find((brand) => brand.id === selectedBrandId) || null,
        [brands, selectedBrandId]
    );

    const selectedBrandApps = useMemo(
        () => apps.filter((app) => app.brand_id === selectedBrandId),
        [apps, selectedBrandId]
    );

    const selectedApp = useMemo(
        () => apps.find((app) => app.id === selectedAppId) || null,
        [apps, selectedAppId]
    );

    const selectedBrandReferences = useMemo(
        () => brandReferences.filter((ref) => ref.brand_id === selectedBrandId),
        [brandReferences, selectedBrandId]
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

    const selectedAppScreenshots = useMemo(
        () =>
            appScreenshots
                .filter((shot) => shot.app_id === selectedAppId)
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
        [appScreenshots, selectedAppId]
    );

    const selectedGeneratedAssets = useMemo(
        () => generatedAssets.filter((asset) => asset.app_id === selectedAppId),
        [generatedAssets, selectedAppId]
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
        if (dataLoading || hasParsedRoute) return;
        if (!brands.length) {
            setHasParsedRoute(true);
            return;
        }

        const { brandSlug, appAlias } = parseRoute();
        let nextBrand = brandSlug
            ? brands.find((brand) => brand.slug === brandSlug) || null
            : brands[0];

        if (!nextBrand) nextBrand = brands[0];

        setSelectedBrandId(nextBrand?.id ?? null);

        if (nextBrand && appAlias) {
            const nextApp = apps.find(
                (app) => app.brand_id === nextBrand?.id && app.alias === appAlias
            );
            setSelectedAppId(nextApp?.id ?? null);
        } else {
            const firstApp = apps.find((app) => app.brand_id === nextBrand?.id);
            setSelectedAppId(firstApp?.id ?? null);
        }

        setHasParsedRoute(true);
    }, [dataLoading, hasParsedRoute, brands, apps]);

    useEffect(() => {
        if (!hasParsedRoute || dataLoading) return;

        if (!selectedBrand) {
            window.history.replaceState({}, '', '/');
            return;
        }

        const currentApp = selectedApp && selectedApp.brand_id === selectedBrand.id ? selectedApp : null;
        const nextRoute = buildRoute(selectedBrand, currentApp);

        if (window.location.pathname !== nextRoute) {
            window.history.replaceState({}, '', nextRoute);
        }
    }, [hasParsedRoute, dataLoading, selectedBrand, selectedApp]);

    useEffect(() => {
        if (!selectedBrandId) {
            setSelectedAppId(null);
            return;
        }

        const hasSelected = selectedBrandApps.some((app) => app.id === selectedAppId);
        if (!hasSelected) {
            setSelectedAppId(selectedBrandApps[0]?.id ?? null);
        }
    }, [selectedBrandId, selectedBrandApps, selectedAppId]);

    useEffect(() => {
        if (!hasParsedRoute) return;

        const handlePopState = () => {
            if (dataLoading) return;
            const { brandSlug, appAlias } = parseRoute();
            const brandMatch = brands.find((brand) => brand.slug === brandSlug);
            const appMatch = brands.length && brandMatch && appAlias
                ? apps.find((app) => app.brand_id === brandMatch.id && app.alias === appAlias)
                : null;

            setSelectedBrandId(brandMatch?.id ?? null);
            setSelectedAppId(appMatch?.id ?? null);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [brands, apps, dataLoading, hasParsedRoute]);

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
                            setActionError(error.message);
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
    }, [sessionUserId, brandReferences]);

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
                        setActionError(error.message);
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
    }, [sessionUserId, brandReferences]);

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
                            setActionError(error.message);
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
    }, [sessionUserId, appScreenshots]);

    useEffect(() => {
        if (!sessionUserId) {
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
                            setActionError(error.message);
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
    }, [sessionUserId, generatedAssets]);

    useEffect(() => {
        const elements = document.querySelectorAll<HTMLTextAreaElement>('.auto-grow');
        elements.forEach((element) => syncAutoGrowTextarea(element));
    }, [brandIconReference?.prompt, brandScreenshotReferences]);

    useEffect(() => {
        if (!selectedAppId) {
            setSlotMappings({});
            return;
        }
        const stored = window.localStorage.getItem(`zefgen.slotMappings.${selectedAppId}`);
        if (stored) {
            try {
                setSlotMappings(JSON.parse(stored));
            } catch {
                setSlotMappings({});
            }
        } else {
            setSlotMappings({});
        }
    }, [selectedAppId]);

    useEffect(() => {
        if (!selectedAppId) return;
        window.localStorage.setItem(`zefgen.slotMappings.${selectedAppId}`, JSON.stringify(slotMappings));
    }, [selectedAppId, slotMappings]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const reportActionError = (message: string) => {
        setActionError(message);
        setTimeout(() => {
            setActionError((prev) => (prev === message ? null : prev));
        }, 6000);
    };

    const openLightbox = (src: string, alt: string) => {
        setLightbox({ src, alt });
    };

    const closeLightbox = () => {
        setLightbox(null);
    };

    const triggerDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const resolveGeneratedUrl = async (asset: GeneratedAsset) =>
        generatedUrls[asset.id] ?? (await getSignedUrl(GENERATED_BUCKET, asset.image_path));

    const formatSlotIndex = (value: number) => String(value).padStart(2, '0');

    const handleDownloadGeneratedAsset = async (asset: GeneratedAsset, filename: string) => {
        try {
            const url = await resolveGeneratedUrl(asset);
            triggerDownload(url, filename);
        } catch (error: any) {
            reportActionError(error.message || text('download_failed'));
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

    const handleAutoGrowInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
        syncAutoGrowTextarea(event.currentTarget);
    };

    const getSignedUrl = async (bucket: string, path: string) => {
        const key = `${bucket}:${path}`;
        const cached = signedUrlCacheRef.current[key];
        const now = Date.now();
        if (cached && cached.expiresAt > now + 60_000) {
            return cached.url;
        }

        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) {
            throw new Error(error?.message || 'Failed to create signed URL.');
        }
        const expiresAt = now + 60 * 60 * 1000;
        signedUrlCacheRef.current[key] = { url: data.signedUrl, expiresAt };
        return data.signedUrl;
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
        const { data, error } = await supabase
            .from('app_generated_assets')
            .update({ edit_state: draft })
            .eq('id', assetId)
            .eq('user_id', session.user.id)
            .select()
            .single();
        if (error) {
            reportActionError(error.message);
        } else {
            setGeneratedAssets((prev) => prev.map((asset) => (asset.id === data.id ? data : asset)));
            setEditAssetId(null);
        }
        setEditSaving(null);
    };

    const handleDeleteGeneratedAsset = async (asset: GeneratedAsset) => {
        if (!session) return;
        setActionError(null);
        const { error } = await supabase
            .from('app_generated_assets')
            .delete()
            .eq('id', asset.id)
            .eq('user_id', session.user.id);
        if (error) {
            reportActionError(error.message);
            return;
        }
        if (asset.image_path) {
            await supabase.storage.from(GENERATED_BUCKET).remove([asset.image_path]);
        }
        setGeneratedAssets((prev) => prev.filter((item) => item.id !== asset.id));
        if (editAssetId === asset.id) {
            setEditAssetId(null);
        }
    };

    const handleGenerateIcon = async () => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!brandIconReference) {
            reportActionError(text('need_icon_reference'));
            return;
        }

        setIconGenerating(true);
        setActionError(null);

        try {
            const iconUrl =
                brandRefUrls[brandIconReference.id] ??
                (await getSignedUrl(BRAND_BUCKET, brandIconReference.image_path));
            const jpgFile = await renderImageToJpeg(iconUrl, 1024, 1024, 'contain');
            const path = `${session.user.id}/apps/${selectedApp.id}/generated/icon/${createId()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from(GENERATED_BUCKET)
                .upload(path, jpgFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
            if (uploadError) throw uploadError;

            const existingIcons = selectedGeneratedAssets.filter((asset) => asset.kind === 'icon');
            if (existingIcons.length) {
                await supabase
                    .from('app_generated_assets')
                    .delete()
                    .in('id', existingIcons.map((asset) => asset.id))
                    .eq('user_id', session.user.id);
                await supabase.storage
                    .from(GENERATED_BUCKET)
                    .remove(existingIcons.map((asset) => asset.image_path));
                setGeneratedAssets((prev) =>
                    prev.filter((asset) => !(asset.app_id === selectedApp.id && asset.kind === 'icon'))
                );
            }

            const { data, error } = await supabase
                .from('app_generated_assets')
                .insert({
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
                })
                .select()
                .single();
            if (error) throw error;
            setGeneratedAssets((prev) => [...prev, data]);
        } catch (error: any) {
            reportActionError(error.message || text('generation_failed'));
        } finally {
            setIconGenerating(false);
        }
    };

    const handleGenerateScreenshots = async () => {
        if (!session || !selectedBrand || !selectedApp) return;
        if (!selectedAppScreenshots.length) {
            reportActionError(text('need_simulator_screenshots'));
            return;
        }

        const targetCount = Math.min(Math.max(generationCount, 3), 6);
        if (selectedAppScreenshots.length < targetCount) {
            reportActionError(text('not_enough_sim_screenshots'));
            return;
        }

        const existingSlots = new Set(generatedScreenshotSlots.map((slot) => slot.slotIndex));
        const slotsToCreate = Array.from({ length: targetCount }, (_, index) => index + 1).filter(
            (slotIndex) => !existingSlots.has(slotIndex)
        );

        if (!slotsToCreate.length) {
            reportActionError(text('all_slots_ready'));
            return;
        }

        setScreenshotsGenerating(true);
        setActionError(null);

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
                const { error: uploadError } = await supabase.storage
                    .from(GENERATED_BUCKET)
                    .upload(path, jpgFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
                if (uploadError) throw uploadError;

                const { data, error } = await supabase
                    .from('app_generated_assets')
                    .insert({
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
                    })
                    .select()
                    .single();
                if (error) throw error;
                setGeneratedAssets((prev) => [...prev, data]);
            }
        } catch (error: any) {
            reportActionError(error.message || text('generation_failed'));
        } finally {
            setScreenshotsGenerating(false);
        }
    };

    const handleGenerateScreenshotVersion = async (slotIndex: number) => {
        if (!session || !selectedBrand || !selectedApp) return;
        const slot = generatedScreenshotSlots.find((item) => item.slotIndex === slotIndex);
        if (!slot) return;
        if (slot.versions.length >= MAX_SCREENSHOT_VERSIONS) {
            reportActionError(text('version_limit_reached'));
            return;
        }
        if (selectedAppScreenshots.length < slotIndex) {
            reportActionError(text('not_enough_sim_screenshots'));
            return;
        }

        setSlotGenerating(slotIndex);
        setActionError(null);

        try {
            const mapping = getSlotMapping(slotIndex);
            const sourceShot = selectedAppScreenshots.find((shot) => shot.id === mapping.simShotId)
                ?? selectedAppScreenshots[slotIndex - 1];
            if (!sourceShot) {
                reportActionError(text('select_sim_screenshot'));
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
            const { error: uploadError } = await supabase.storage
                .from(GENERATED_BUCKET)
                .upload(path, jpgFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
            if (uploadError) throw uploadError;

            const { data, error } = await supabase
                .from('app_generated_assets')
                .insert({
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
                })
                .select()
                .single();
            if (error) throw error;
            setGeneratedAssets((prev) => [...prev, data]);
        } catch (error: any) {
            reportActionError(error.message || text('generation_failed'));
        } finally {
            setSlotGenerating(null);
        }
    };

    const handleBrandIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !session || !selectedBrand) return;

        if (!isValidImageType(file)) {
            reportActionError(text('invalid_file_type'));
            return;
        }
        if (isFileTooLarge(file)) {
            reportActionError(text('file_too_large'));
            return;
        }

        setBrandIconUploading(true);
        setActionError(null);

        try {
            const jpgFile = await convertToJpg(file);
            const path = `${session.user.id}/brands/${selectedBrand.id}/icon/${createId()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from(BRAND_BUCKET)
                .upload(path, jpgFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });

            if (uploadError) throw uploadError;

            if (brandIconReference?.image_path) {
                await supabase.storage.from(BRAND_BUCKET).remove([brandIconReference.image_path]);
            }

            if (brandIconReference) {
                const { data, error } = await supabase
                    .from('brand_references')
                    .update({ image_path: path })
                    .eq('id', brandIconReference.id)
                    .eq('user_id', session.user.id)
                    .select()
                    .single();

                if (error) throw error;
                setBrandReferences((prev) => prev.map((ref) => (ref.id === data.id ? data : ref)));
            } else {
                const { data, error } = await supabase
                    .from('brand_references')
                    .insert({
                        brand_id: selectedBrand.id,
                        user_id: session.user.id,
                        kind: 'icon',
                        image_path: path,
                        prompt: '',
                        order_index: 0,
                    })
                    .select()
                    .single();

                if (error) throw error;
                setBrandReferences((prev) => [...prev, data]);
            }
        } catch (error: any) {
            reportActionError(error.message || text('upload_failed'));
        } finally {
            setBrandIconUploading(false);
        }
    };

    const uploadBrandScreenshotReferences = async (files: File[]) => {
        if (!files.length || !session || !selectedBrand) return;

        if (brandScreenshotReferences.length >= MAX_SCREENSHOT_REFS) {
            reportActionError(text('max_screenshot_refs'));
            return;
        }

        const remainingSlots = MAX_SCREENSHOT_REFS - brandScreenshotReferences.length;
        const uploadFiles = normalizeScreenshotFiles(files).slice(0, remainingSlots);

        setBrandScreenshotsUploading(true);
        setActionError(null);

        try {
            for (let index = 0; index < uploadFiles.length; index += 1) {
                const file = uploadFiles[index];
                if (!isValidImageType(file)) {
                    reportActionError(text('invalid_file_type'));
                    continue;
                }
                if (isFileTooLarge(file)) {
                    reportActionError(text('file_too_large'));
                    continue;
                }

                const jpgFile = await resizeImageToJpeg(file, 1320, 2868);
                const path = `${session.user.id}/brands/${selectedBrand.id}/screenshots/${createId()}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from(BRAND_BUCKET)
                    .upload(path, jpgFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
                if (uploadError) throw uploadError;

                const { data, error } = await supabase
                    .from('brand_references')
                    .insert({
                        brand_id: selectedBrand.id,
                        user_id: session.user.id,
                        kind: 'screenshot',
                        image_path: path,
                        prompt: '',
                        order_index: brandScreenshotReferences.length + index,
                    })
                    .select()
                    .single();
                if (error) throw error;

                setBrandReferences((prev) => [...prev, data]);
            }
        } catch (error: any) {
            reportActionError(error.message || text('upload_failed'));
        } finally {
            setBrandScreenshotsUploading(false);
        }
    };

    const handleBrandScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        await uploadBrandScreenshotReferences(files);
    };

    const handleBrandReferenceDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsBrandRefDropActive(false);
        if (brandScreenshotsUploading) return;
        const files = Array.from(event.dataTransfer.files || []);
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
        const { error } = await supabase
            .from('brand_references')
            .update({ prompt: value })
            .eq('id', refId)
            .eq('user_id', session.user.id);
        if (error) reportActionError(error.message);
    };

    const handleDeleteBrandReference = async (ref: BrandReference) => {
        if (!session) return;
        setActionError(null);

        const { error } = await supabase
            .from('brand_references')
            .delete()
            .eq('id', ref.id)
            .eq('user_id', session.user.id);

        if (error) {
            reportActionError(error.message);
            return;
        }

        if (ref.image_path) {
            await supabase.storage.from(BRAND_BUCKET).remove([ref.image_path]);
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
                    supabase
                        .from('brand_references')
                        .update({ order_index: index })
                        .eq('id', item.id)
                        .eq('user_id', session.user.id)
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
                supabase
                    .from('brand_references')
                    .update({ order_index: index })
                    .eq('id', ref.id)
                    .eq('user_id', session.user.id)
            )
        );
    };

    const normalizeScreenshotFiles = (files: File[]) =>
        [...files].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

    const uploadAppScreenshots = async (files: File[]) => {
        if (!files.length || !session || !selectedBrand || !selectedApp) return;

        setAppScreenshotsUploading(true);
        setActionError(null);

        try {
            const orderedFiles = normalizeScreenshotFiles(files);
            for (let index = 0; index < orderedFiles.length; index += 1) {
                const file = orderedFiles[index];
                if (!isValidImageType(file)) {
                    reportActionError(text('invalid_file_type'));
                    continue;
                }
                if (isFileTooLarge(file)) {
                    reportActionError(text('file_too_large'));
                    continue;
                }

                const jpgFile = await resizeImageToJpeg(file, 1320, 2868);
                const path = `${session.user.id}/apps/${selectedApp.id}/simulator/${createId()}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from(APP_SCREENSHOT_BUCKET)
                    .upload(path, jpgFile, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
                if (uploadError) throw uploadError;

                const { data, error } = await supabase
                    .from('app_screenshots')
                    .insert({
                        app_id: selectedApp.id,
                        brand_id: selectedBrand.id,
                        user_id: session.user.id,
                        image_path: path,
                        order_index: selectedAppScreenshots.length + index,
                    })
                    .select()
                    .single();
                if (error) throw error;

                setAppScreenshots((prev) => [...prev, data]);
            }
        } catch (error: any) {
            reportActionError(error.message || text('upload_failed'));
        } finally {
            setAppScreenshotsUploading(false);
        }
    };

    const handleAppScreenshotsUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        await uploadAppScreenshots(files);
    };

    const handleScreenshotDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsScreenshotDropActive(false);
        if (!canUploadAppScreenshots || appScreenshotsUploading) return;
        const files = Array.from(event.dataTransfer.files || []);
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
        setActionError(null);
        const { error } = await supabase
            .from('app_screenshots')
            .delete()
            .eq('id', shot.id)
            .eq('user_id', session.user.id);

        if (error) {
            reportActionError(error.message);
            return;
        }

        if (shot.image_path) {
            await supabase.storage.from(APP_SCREENSHOT_BUCKET).remove([shot.image_path]);
        }

        const remaining = selectedAppScreenshots.filter((item) => item.id !== shot.id);
        setAppScreenshots((prev) =>
            prev
                .filter((item) => item.id !== shot.id)
                .map((item) => {
                    const idx = remaining.findIndex((ref) => ref.id === item.id);
                    if (idx === -1) return item;
                    return { ...item, order_index: idx };
                })
        );
        await Promise.all(
            remaining.map((item, index) =>
                supabase
                    .from('app_screenshots')
                    .update({ order_index: index })
                    .eq('id', item.id)
                    .eq('user_id', session.user.id)
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
                supabase
                    .from('app_screenshots')
                    .update({ order_index: index })
                    .eq('id', shot.id)
                    .eq('user_id', session.user.id)
            )
        );
    };
    const openBrandForm = (brand?: Brand) => {
        if (brand) {
            setEditingBrandId(brand.id);
            setBrandForm({ name: brand.name });
        } else {
            setEditingBrandId(null);
            setBrandForm({ name: '' });
        }
        setBrandFormError(null);
        setBrandFormOpen(true);
    };

    const submitBrandForm = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!session) return;

        const name = brandForm.name.trim();
        if (!name) {
            setBrandFormError(text('brand_name_required'));
            return;
        }

        setBrandFormLoading(true);
        setBrandFormError(null);

        const baseSlug = slugify(name);
        const existingSlugs = brands
            .filter((brand) => brand.id !== editingBrandId)
            .map((brand) => brand.slug);
        const slug = makeUniqueSlug(baseSlug, existingSlugs);

        if (editingBrandId) {
            const { data, error } = await supabase
                .from('brands')
                .update({ name, slug })
                .eq('id', editingBrandId)
                .eq('user_id', session.user.id)
                .select()
                .single();

            if (error) {
                setBrandFormError(error.message);
                setBrandFormLoading(false);
                return;
            }

            setBrands((prev) => prev.map((brand) => (brand.id === editingBrandId ? data : brand)));
        } else {
            const { data, error } = await supabase
                .from('brands')
                .insert({ name, slug, user_id: session.user.id })
                .select()
                .single();

            if (error) {
                setBrandFormError(error.message);
                setBrandFormLoading(false);
                return;
            }

            setBrands((prev) => [...prev, data]);
            setSelectedBrandId(data.id);
        }

        setBrandFormLoading(false);
        setBrandFormOpen(false);
    };

    const openAppForm = (app?: AppItem) => {
        if (app) {
            setEditingAppId(app.id);
            setAppForm({ name: app.name, alias: app.alias });
            setSelectedAppId(app.id);
        } else {
            setEditingAppId(null);
            setAppForm({ name: '', alias: '' });
        }
        setAppFormError(null);
        setAppFormOpen(true);
    };

    const submitAppForm = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!session || !selectedBrand) return;

        const name = appForm.name.trim();
        if (!name) {
            setAppFormError(text('app_name_required'));
            return;
        }

        const baseAlias = slugify(appForm.alias || name);
        const existingAliases = apps
            .filter((app) => app.brand_id === selectedBrand.id && app.id !== editingAppId)
            .map((app) => app.alias);
        const alias = makeUniqueSlug(baseAlias, existingAliases);

        setAppFormLoading(true);
        setAppFormError(null);

        if (editingAppId) {
            const { data, error } = await supabase
                .from('apps')
                .update({ name, alias })
                .eq('id', editingAppId)
                .eq('user_id', session.user.id)
                .select()
                .single();

            if (error) {
                setAppFormError(error.message);
                setAppFormLoading(false);
                return;
            }

            setApps((prev) => prev.map((app) => (app.id === editingAppId ? data : app)));
            setSelectedAppId(data.id);
        } else {
            const { data, error } = await supabase
                .from('apps')
                .insert({
                    name,
                    alias,
                    brand_id: selectedBrand.id,
                    user_id: session.user.id,
                })
                .select()
                .single();

            if (error) {
                setAppFormError(error.message);
                setAppFormLoading(false);
                return;
            }

            setApps((prev) => [...prev, data]);
            setSelectedAppId(data.id);
        }

        setAppFormLoading(false);
        setAppFormOpen(false);
    };

    const brandSlugPreview = slugify(brandForm.name || '');
    const appAliasPreview = slugify(appForm.alias || appForm.name || '');
    const canUploadAppScreenshots = Boolean(selectedApp && selectedBrand);
    const targetSlotCount = Math.min(Math.max(generationCount, 3), 6);
    const existingSlotCount = generatedScreenshotSlots.length;
    const slotsToCreate = Array.from({ length: targetSlotCount }, (_, index) => index + 1).filter(
        (slotIndex) => !generatedScreenshotSlots.some((slot) => slot.slotIndex === slotIndex)
    );
    const canGenerateIcon = Boolean(selectedApp && selectedBrand && brandIconReference);
    const canGenerateScreenshots = Boolean(selectedApp && selectedBrand);
    const isBrandEditing = Boolean(selectedBrand && brandFormOpen && editingBrandId === selectedBrand.id);
    const hasBrandIcon = Boolean(brandIconReference && brandRefUrls[brandIconReference.id]);
    const getSlotMapping = (slotIndex: number) => {
        const stored = slotMappings[slotIndex] || {};
        return {
            brandRefId: stored.brandRefId ?? brandScreenshotReferences[slotIndex - 1]?.id ?? null,
            simShotId: stored.simShotId ?? selectedAppScreenshots[slotIndex - 1]?.id ?? null,
        };
    };
    const updateSlotMapping = (
        slotIndex: number,
        patch: { brandRefId?: string | null; simShotId?: string | null }
    ) => {
        setSlotMappings((prev) => {
            const current = prev[slotIndex] ?? { brandRefId: null, simShotId: null };
            return {
                ...prev,
                [slotIndex]: {
                    ...current,
                    ...patch,
                },
            };
        });
    };

    const appFormFields = (
        <>
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('app_name')}</label>
                    <input
                        value={appForm.name}
                        onChange={(event) => setAppForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        placeholder="HW200"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('alias')}</label>
                    <input
                        value={appForm.alias}
                        onChange={(event) => setAppForm((prev) => ({ ...prev, alias: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        placeholder="hw200"
                    />
                </div>
            </div>
            <div className="text-xs text-indigo-200/70">
                {text('url_preview')}: /{selectedBrand?.slug ?? 'brand'}/{appAliasPreview || 'app'}
            </div>
            {appFormError && (
                <p className="text-xs text-rose-300">{appFormError}</p>
            )}
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={appFormLoading}
                    className="flex-1 rounded-xl bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30"
                >
                    {appFormLoading ? text('saving') : editingAppId ? text('update_app') : text('create_app')}
                </button>
                <button
                    type="button"
                    onClick={() => setAppFormOpen(false)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                >
                    {text('cancel')}
                </button>
            </div>
        </>
    );

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
            </div>
        );
    }

    if (!session) {
        return <LoginPage />;
    }
    return (
        <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-['Manrope']">
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-full shadow-lg md:hidden"
                >
                    <Menu size={18} />
                </button>
            )}

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside
                className={`
                    fixed top-0 left-0 h-[100dvh] z-50 w-72 bg-slate-900 text-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col border-r border-indigo-900/40
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:h-screen md:z-40
                `}
            >
                <div className="relative p-6 border-b border-indigo-900/30">
                    <div ref={logoContainerRef} className="relative w-full select-none">
                        <button
                            type="button"
                            onClick={() =>
                                setLogoVariantIndex((prev) => {
                                    let next = prev;
                                    while (next === prev) {
                                        next = Math.floor(Math.random() * 6);
                                    }
                                    return next;
                                })
                            }
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-xl bg-slate-900/30 flex items-center justify-center overflow-hidden"
                            aria-label="Change logo variant"
                        >
                            <img src="/genlogo.png" alt="ZefGen" className="h-full w-full object-contain" />
                        </button>
                        <div
                            className={`logo-wrap w-full text-center pl-16 pr-8 translate-y-px transition-opacity duration-300 ${
                                logoFontReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
                            }`}
                            style={{ fontFamily: '"Roboto Flex Variable", "Roboto Flex", sans-serif' }}
                        >
                            {(() => {
                                const variants = [
                                    <LetterSwapForward key="v1" label={logoWord} className="text-4xl leading-none font-light text-white font-roboto-flex tracking-[0.08em]" />,
                                    <LetterSwapPingPong key="v2" label={logoWord} staggerFrom="center" className="text-4xl leading-none font-light text-white font-roboto-flex tracking-[0.08em]" />,
                                    <VariableFontHoverByRandomLetter
                                        key="v3"
                                        label={logoWord}
                                        className="text-4xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                                        fromFontVariationSettings="'wght' 300, 'slnt' 0"
                                        toFontVariationSettings="'wght' 900, 'slnt' 0"
                                    />,
                                    <VariableFontCursorProximity
                                        key="v4"
                                        label={logoWord}
                                        className="text-4xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                                        fromFontVariationSettings="'wght' 300, 'slnt' 0"
                                        toFontVariationSettings="'wght' 900, 'slnt' -10"
                                        radius={180}
                                        falloff="gaussian"
                                        containerRef={logoContainerRef}
                                    />,
                                    <BreathingText
                                        key="v5"
                                        className="text-4xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                                        fromFontVariationSettings="'wght' 260, 'slnt' 0"
                                        toFontVariationSettings="'wght' 820, 'slnt' -8"
                                    >
                                        {logoWord}
                                    </BreathingText>,
                                    <ScrambleHover key="v6" text={logoWord} className="text-4xl leading-none font-light text-white font-roboto-flex tracking-[0.08em]" scrambleSpeed={45} maxIterations={8} />,
                                ];

                                return variants[logoVariantIndex] ?? variants[0];
                            })()}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="md:hidden absolute right-4 top-4"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brands')}</p>
                        <p className="text-sm text-indigo-100/80">{text('select_or_create')}</p>
                    </div>
                    <button
                        onClick={() => openBrandForm()}
                        className="inline-flex items-center gap-2 rounded-full bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 border border-indigo-400/30 hover:bg-indigo-400/20"
                    >
                        <Plus size={14} />
                        {text('new')}
                    </button>
                </div>

                <div className="px-4 pb-4">
                    {brandFormOpen && (
                        <form
                            onSubmit={submitBrandForm}
                            className="animate-shelf rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3"
                        >
                            <div>
                                <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_name')}</label>
                                <input
                                    value={brandForm.name}
                                    onChange={(event) => setBrandForm({ name: event.target.value })}
                                    className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                    placeholder="Adidas"
                                />
                            </div>
                            <div className="text-xs text-indigo-200/70">
                                {text('url_preview')}: /{brandSlugPreview || 'brand'}
                            </div>
                            {brandFormError && (
                                <p className="text-xs text-rose-300">{brandFormError}</p>
                            )}
                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    disabled={brandFormLoading}
                                    className="flex-1 rounded-xl bg-indigo-400/20 px-3 py-2 text-xs font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-400/30"
                                >
                                    {brandFormLoading ? text('saving') : editingBrandId ? text('update_brand') : text('create_brand')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBrandFormOpen(false)}
                                    className="rounded-xl border border-indigo-900/60 px-3 py-2 text-xs text-indigo-200/70 hover:text-white"
                                >
                                    {text('cancel')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-3 pt-2 pb-6 space-y-2 scrollbar-thin scrollbar-thumb-indigo-900/40">
                    {dataLoading && (
                        <div className="flex items-center gap-2 text-xs text-indigo-200/60 px-3">
                            <Loader2 className="animate-spin" size={14} />
                            {text('loading_brands')}
                        </div>
                    )}
                    {!dataLoading && !brands.length && (
                        <div className="rounded-2xl border border-dashed border-indigo-900/60 p-4 text-sm text-indigo-200/70">
                            {text('no_brands_yet')}
                        </div>
                    )}
                    {brands.map((brand) => {
                        const isActive = brand.id === selectedBrandId;
                        const iconUrl = brandIconUrls[brand.id];
                        return (
                            <button
                                key={brand.id}
                                onClick={() => {
                                    setSelectedBrandId(brand.id);
                                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                                }}
                                className={`w-full rounded-2xl px-4 py-3 text-left transition ring-1 ${
                                    isActive
                                        ? 'ring-indigo-400/40 bg-slate-900/80 shadow-[0_14px_30px_-25px_rgba(99,102,241,0.6)]'
                                        : 'ring-white/5 bg-slate-950/30 hover:bg-slate-900/70'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`h-9 w-9 overflow-hidden rounded-[12px] bg-slate-800/35 flex items-center justify-center text-[11px] text-indigo-200/70 ${
                                                iconUrl ? 'border border-transparent' : 'border border-indigo-400/20'
                                            }`}
                                        >
                                            {iconUrl ? (
                                                <img
                                                    src={iconUrl}
                                                    alt={text('icon_reference')}
                                                    className="h-full w-full object-cover rounded-[12px] cursor-zoom-in"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openLightbox(iconUrl, text('icon_reference'));
                                                    }}
                                                />
                                            ) : (
                                                <span>{brand.name.slice(0, 1).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{brand.name}</p>
                                            <p className="text-xs text-indigo-200/60">/{brand.slug}</p>
                                        </div>
                                    </div>
                                    {isActive && <ArrowUpRight size={16} className="text-indigo-200" />}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="bg-slate-900 border-t border-slate-800/60 px-5 py-4 text-xs text-indigo-200/60 flex items-center justify-between gap-3">
                    <span className="truncate">{session.user.email}</span>
                    <div className="flex items-center gap-2">
                        <div className="relative flex items-center rounded-full border border-indigo-900/50 bg-slate-900/70 p-1 w-[86px]">
                            <span
                                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-indigo-500/30 transition-transform duration-200 ${
                                    lang === 'ru' ? 'translate-x-full' : ''
                                }`}
                            />
                            <button
                                onClick={() => setLang('en')}
                                className={`relative z-10 w-1/2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                                    lang === 'en'
                                        ? 'text-indigo-100'
                                        : 'text-indigo-200/60 hover:text-indigo-100'
                                }`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLang('ru')}
                                className={`relative z-10 w-1/2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                                    lang === 'ru'
                                        ? 'text-indigo-100'
                                        : 'text-indigo-200/60 hover:text-indigo-100'
                                }`}
                            >
                                RU
                            </button>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center justify-center rounded-full border border-indigo-400/30 p-2 text-indigo-200/80 hover:text-white"
                            aria-label={text('sign_out')}
                            title={text('sign_out')}
                        >
                            <DoorOpen size={12} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <div className="min-h-full px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-6xl space-y-8">
                            <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 bg-slate-950/90 backdrop-blur border-b border-indigo-900/30 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex flex-col items-center gap-2">
                                        {isBrandEditing ? (
                                            <label
                                                htmlFor="brand-icon-upload"
                                                className={`flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] text-xs text-indigo-200/70 hover:border-indigo-400/50 cursor-pointer ${
                                                    hasBrandIcon ? 'border border-transparent bg-slate-900/20' : 'border border-indigo-400/30 bg-slate-800/35'
                                                }`}
                                                title={brandIconReference ? text('replace_icon') : text('upload_icon')}
                                            >
                                                {brandIconReference && brandRefUrls[brandIconReference.id] ? (
                                                    <img
                                                        src={brandRefUrls[brandIconReference.id]}
                                                        alt={text('icon_reference')}
                                                        className="h-full w-full object-cover rounded-[18px] cursor-zoom-in"
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            openLightbox(brandRefUrls[brandIconReference.id], text('icon_reference'));
                                                        }}
                                                    />
                                                ) : (
                                                    <Plus size={16} />
                                                )}
                                            </label>
                                        ) : (
                                            <div
                                                className={`flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] text-xs text-indigo-200/60 ${
                                                    hasBrandIcon ? 'border border-transparent bg-slate-900/20' : 'border border-indigo-400/20 bg-slate-800/35'
                                                }`}
                                            >
                                                {brandIconReference && brandRefUrls[brandIconReference.id] ? (
                                                    <img
                                                        src={brandRefUrls[brandIconReference.id]}
                                                        alt={text('icon_reference')}
                                                        className="h-full w-full object-cover rounded-[18px] cursor-zoom-in"
                                                        onClick={() => openLightbox(brandRefUrls[brandIconReference.id], text('icon_reference'))}
                                                    />
                                                ) : (
                                                    <Plus size={16} />
                                                )}
                                            </div>
                                        )}
                                        {isBrandEditing && (
                                            <div className="flex items-center gap-2">
                                                <label
                                                    htmlFor="brand-icon-upload"
                                                    className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 px-2.5 py-1 text-[10px] font-semibold text-indigo-100 hover:bg-indigo-400/10 cursor-pointer"
                                                >
                                                    {brandIconUploading ? text('uploading') : brandIconReference ? text('replace_icon') : text('upload_icon')}
                                                </label>
                                                {brandIconReference && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteBrandReference(brandIconReference)}
                                                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                        aria-label={text('delete')}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <input
                                            id="brand-icon-upload"
                                            type="file"
                                            accept="image/png,image/jpeg"
                                            className="hidden"
                                            onChange={handleBrandIconUpload}
                                            disabled={!selectedBrand || !isBrandEditing || brandIconUploading}
                                        />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_label')}</p>
                                        <h2 className="text-3xl font-semibold text-white">
                                            {selectedBrand ? selectedBrand.name : text('no_brand_selected')}
                                        </h2>
                                        <p className="text-sm text-indigo-200/60">
                                            {selectedBrand ? `/${selectedBrand.slug}` : text('create_or_select_brand')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedBrand && (
                                        <button
                                            onClick={() => openBrandForm(selectedBrand)}
                                            className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/10"
                                        >
                                            <Pencil size={14} />
                                            {text('edit_brand')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {dataError && (
                                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 flex items-start gap-3">
                                    <AlertTriangle size={18} />
                                    <div>
                                        <p className="font-semibold">{text('data_load_error_title')}</p>
                                        <p className="text-xs text-rose-200/70">{dataError}</p>
                                        <button
                                            onClick={() => session && fetchData(session)}
                                            className="mt-3 rounded-full border border-rose-300/40 px-3 py-1 text-xs font-semibold text-rose-100"
                                        >
                                            {text('retry')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {actionError && (
                                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 flex items-start gap-3">
                                    <AlertTriangle size={18} />
                                    <div>
                                        <p className="font-semibold">{text('action_error_title')}</p>
                                        <p className="text-xs text-amber-100/70">{actionError}</p>
                                    </div>
                                </div>
                            )}

                            {!dataLoading && !brands.length && (
                                <div className="rounded-[32px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.8)] p-10 text-center">
                                    <p className="text-lg font-semibold text-white">{text('create_first_brand')}</p>
                                    <p className="mt-2 text-sm text-indigo-200/70">
                                        {text('brands_hold_references')}
                                    </p>
                                    <button
                                        onClick={() => openBrandForm()}
                                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-400/20 px-5 py-2 text-sm font-semibold text-indigo-100 border border-indigo-400/40"
                                    >
                                        <Plus size={16} />
                                        {text('new_brand')}
                                    </button>
                                </div>
                            )}

                            {selectedBrand && (
                                <div className="space-y-6">
                                    <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 shadow-[0_26px_70px_-60px_rgba(15,23,42,0.9)] p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_references')}</p>
                                                <h3 className="text-xl font-semibold text-white">{text('reference_library')}</h3>
                                            </div>
                                            <div className="text-[11px] text-indigo-200/60">
                                                {brandScreenshotReferences.length}/{MAX_SCREENSHOT_REFS}
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_references')}</p>
                                                    <span className="text-[10px] text-indigo-200/60">
                                                        {brandScreenshotReferences.length}/{MAX_SCREENSHOT_REFS}
                                                    </span>
                                                </div>

                                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                                    <div>
                                                        {brandScreenshotReferences.length === 0 ? (
                                                            <div className="rounded-2xl border border-dashed border-indigo-900/40 p-4 text-xs text-indigo-200/60">
                                                                {text('no_screenshot_refs')}
                                                            </div>
                                                        ) : (
                                                            <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-6">
                                                                {brandScreenshotReferences.map((ref, index) => {
                                                                    const isDragTarget = dragOverBrandRefId === ref.id && draggingBrandRefId !== ref.id;
                                                                    return (
                                                                        <div
                                                                            key={ref.id}
                                                                            draggable
                                                                            onDragStart={(event) => {
                                                                                event.dataTransfer.effectAllowed = 'move';
                                                                                event.dataTransfer.setData('text/plain', ref.id);
                                                                                setDraggingBrandRefId(ref.id);
                                                                            }}
                                                                            onDragEnd={() => {
                                                                                setDraggingBrandRefId(null);
                                                                                setDragOverBrandRefId(null);
                                                                            }}
                                                                            onDragOver={(event) => {
                                                                                event.preventDefault();
                                                                                setDragOverBrandRefId(ref.id);
                                                                            }}
                                                                            onDrop={(event) => {
                                                                                event.preventDefault();
                                                                                const draggedId = event.dataTransfer.getData('text/plain');
                                                                                const fromIndex = brandScreenshotReferences.findIndex((item) => item.id === draggedId);
                                                                                const toIndex = brandScreenshotReferences.findIndex((item) => item.id === ref.id);
                                                                                if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                                                                                    handleReorderBrandReference(fromIndex, toIndex);
                                                                                }
                                                                                setDraggingBrandRefId(null);
                                                                                setDragOverBrandRefId(null);
                                                                            }}
                                                                            className={`mx-auto w-full max-w-[110px] rounded-2xl bg-slate-900/35 ring-1 ring-white/5 p-1.5 space-y-1.5 cursor-grab active:cursor-grabbing ${
                                                                                isDragTarget ? 'ring-indigo-400/60 bg-indigo-500/10' : ''
                                                                            }`}
                                                                        >
                                                                            <div className="relative overflow-hidden rounded-xl border border-dashed border-indigo-900/40 bg-slate-900/30 aspect-[9/19]">
                                                                                {brandRefUrls[ref.id] ? (
                                                                                    <img
                                                                                        src={brandRefUrls[ref.id]}
                                                                                        alt={text('screenshot_references')}
                                                                                        className="h-full w-full object-cover cursor-zoom-in"
                                                                                        loading="lazy"
                                                                                        decoding="async"
                                                                                        onClick={() => openLightbox(brandRefUrls[ref.id], text('screenshot_references'))}
                                                                                    />
                                                                                ) : (
                                                                                    <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">{text('loading')}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-between text-[10px] text-indigo-200/50">
                                                                                <div className="inline-flex items-center gap-1">
                                                                                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">
                                                                                        {index + 1}
                                                                                    </span>
                                                                                    <GripVertical size={12} />
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDeleteBrandReference(ref)}
                                                                                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                    aria-label={text('delete')}
                                                                                >
                                                                                    <Trash2 size={12} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div
                                                            onDragOver={handleBrandReferenceDragOver}
                                                            onDragLeave={handleBrandReferenceDragLeave}
                                                            onDrop={handleBrandReferenceDrop}
                                                            className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-4 text-center transition ${
                                                                isBrandRefDropActive
                                                                    ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-100'
                                                                    : 'border-indigo-900/50 bg-slate-900/30 text-indigo-200/70'
                                                            } ${brandScreenshotReferences.length >= MAX_SCREENSHOT_REFS ? 'opacity-60 pointer-events-none' : ''}`}
                                                        >
                                                            <ImagePlus size={22} />
                                                            <div className="text-xs font-semibold">{text('drop_references_title')}</div>
                                                            <div className="text-[10px] text-indigo-200/60">{text('reference_limit_short')}</div>
                                                            <label
                                                                htmlFor="brand-screenshot-upload"
                                                                className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30 cursor-pointer"
                                                            >
                                                                {brandScreenshotsUploading ? text('uploading') : text('upload_references')}
                                                            </label>
                                                            <input
                                                                id="brand-screenshot-upload"
                                                                type="file"
                                                                accept="image/png,image/jpeg"
                                                                multiple
                                                                className="hidden"
                                                                onChange={handleBrandScreenshotUpload}
                                                                disabled={brandScreenshotReferences.length >= MAX_SCREENSHOT_REFS || brandScreenshotsUploading}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="space-y-5">
                                        <section className="rounded-[22px] bg-slate-800/45 ring-1 ring-indigo-400/20 p-3">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('apps')}</p>
                                                    <p className="text-xs text-indigo-200/60">{text('switch_fast_between_products')}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {selectedApp && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAppForm(selectedApp)}
                                                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                        >
                                                            <Pencil size={11} />
                                                            {text('edit')}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openAppForm()}
                                                        className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30"
                                                    >
                                                        <Plus size={12} />
                                                        {text('add_app')}
                                                    </button>
                                                </div>
                                            </div>

                                            {!selectedBrandApps.length ? (
                                                <p className="mt-3 text-sm text-indigo-200/60">{text('no_apps_yet')}</p>
                                            ) : (
                                                <div className="mt-3 rounded-2xl border border-white/5 bg-slate-900/30 p-2">
                                                    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={text('apps')}>
                                                        {selectedBrandApps.map((app) => {
                                                            const isActive = app.id === selectedAppId;
                                                            return (
                                                                <button
                                                                    key={app.id}
                                                                    role="tab"
                                                                    aria-selected={isActive}
                                                                    onClick={() => setSelectedAppId(app.id)}
                                                                    className={`shrink-0 min-w-[170px] rounded-2xl border px-3 py-2 text-left transition ${
                                                                        isActive
                                                                            ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                                                                            : 'border-white/10 bg-slate-950/30 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-indigo-200/60">
                                                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] ${
                                                                            isActive ? 'bg-indigo-400/30 text-indigo-100' : 'bg-slate-900/50 text-indigo-200/70'
                                                                        }`}>
                                                                            {app.alias.toUpperCase()}
                                                                        </span>
                                                                        {isActive && (
                                                                            <span className="text-[10px] font-semibold text-indigo-100">{text('active')}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="mt-1 text-sm font-semibold text-white">{app.name}</div>
                                                                    <div className="text-[10px] text-indigo-200/50">/{selectedBrand?.slug}/{app.alias}</div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {appFormOpen && (
                                                <form
                                                    onSubmit={submitAppForm}
                                                    className="mt-4 rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3 animate-shelf"
                                                >
                                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">
                                                        {editingAppId ? text('update_app') : text('create_app')}
                                                    </p>
                                                    {appFormFields}
                                                </form>
                                            )}

                                            {!selectedApp && (
                                                <p className="mt-2 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
                                            )}
                                        </section>

                                        <section className="rounded-[26px] bg-slate-800/45 ring-1 ring-white/5 p-5">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('simulator_screenshots')}</p>
                                                    <p className="text-xs text-indigo-200/60">{text('simulator_screenshots_subtitle')}</p>
                                                </div>
                                                <span className="text-[11px] text-indigo-200/60">{text('drag_to_reorder')}</span>
                                            </div>

                                            {!selectedApp ? (
                                                <p className="mt-4 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
                                            ) : (
                                                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                                                    <div>
                                                        {selectedAppScreenshots.length === 0 ? (
                                                            <div className="rounded-2xl border border-dashed border-indigo-900/40 p-4 text-sm text-indigo-200/60">
                                                                {text('no_screenshots_yet')}
                                                            </div>
                                                        ) : (
                                                            <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                                                {selectedAppScreenshots.map((shot, index) => {
                                                                    const isDragTarget = dragOverShotId === shot.id && draggingShotId !== shot.id;
                                                                    return (
                                                                        <div
                                                                            key={shot.id}
                                                                            draggable
                                                                            onDragStart={(event) => {
                                                                                event.dataTransfer.effectAllowed = 'move';
                                                                                event.dataTransfer.setData('text/plain', shot.id);
                                                                                setDraggingShotId(shot.id);
                                                                            }}
                                                                            onDragEnd={() => {
                                                                                setDraggingShotId(null);
                                                                                setDragOverShotId(null);
                                                                            }}
                                                                            onDragOver={(event) => {
                                                                                event.preventDefault();
                                                                                setDragOverShotId(shot.id);
                                                                            }}
                                                                            onDrop={(event) => {
                                                                                event.preventDefault();
                                                                                const draggedId = event.dataTransfer.getData('text/plain');
                                                                                const fromIndex = selectedAppScreenshots.findIndex((item) => item.id === draggedId);
                                                                                const toIndex = selectedAppScreenshots.findIndex((item) => item.id === shot.id);
                                                                                if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                                                                                    handleReorderAppScreenshot(fromIndex, toIndex);
                                                                                }
                                                                                setDraggingShotId(null);
                                                                                setDragOverShotId(null);
                                                                            }}
                                                                            className={`mx-auto w-full max-w-[110px] rounded-2xl bg-slate-900/35 ring-1 ring-white/5 p-1.5 space-y-1.5 cursor-grab active:cursor-grabbing ${
                                                                                isDragTarget ? 'ring-indigo-400/60 bg-indigo-500/10' : ''
                                                                            }`}
                                                                        >
                                                                            <div className="relative overflow-hidden rounded-xl border border-dashed border-indigo-900/40 bg-slate-900/30 aspect-[9/19]">
                                                                                {appScreenshotUrls[shot.id] ? (
                                                                                    <img
                                                                                        src={appScreenshotUrls[shot.id]}
                                                                                        alt={`${text('screenshot')} ${index + 1}`}
                                                                                        className="h-full w-full object-cover cursor-zoom-in"
                                                                                        loading="lazy"
                                                                                        decoding="async"
                                                                                        onClick={() => openLightbox(appScreenshotUrls[shot.id], `${text('screenshot')} ${index + 1}`)}
                                                                                    />
                                                                                ) : (
                                                                                    <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">{text('loading')}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-between text-[10px] text-indigo-200/50">
                                                                                <div className="inline-flex items-center gap-1">
                                                                                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold">
                                                                                        {index + 1}
                                                                                    </span>
                                                                                    <GripVertical size={12} />
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleDeleteAppScreenshot(shot)}
                                                                                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-1 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                    aria-label={text('delete')}
                                                                                >
                                                                                    <Trash2 size={10} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div
                                                            onDragOver={handleScreenshotDragOver}
                                                            onDragLeave={handleScreenshotDragLeave}
                                                            onDrop={handleScreenshotDrop}
                                                            className={`flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-5 text-center transition ${
                                                                isScreenshotDropActive
                                                                    ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-100'
                                                                    : 'border-indigo-900/50 bg-slate-900/30 text-indigo-200/70'
                                                            } ${canUploadAppScreenshots ? '' : 'opacity-60 pointer-events-none'}`}
                                                        >
                                                            <ImagePlus size={24} />
                                                            <div className="text-sm font-semibold">{text('drop_screenshots_title')}</div>
                                                            <label
                                                                htmlFor="app-screenshots-upload"
                                                                className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30 cursor-pointer"
                                                            >
                                                                {appScreenshotsUploading ? text('uploading') : text('upload_screenshots')}
                                                            </label>
                                                            <input
                                                                id="app-screenshots-upload"
                                                                type="file"
                                                                accept="image/png,image/jpeg"
                                                                multiple
                                                                className="hidden"
                                                                onChange={handleAppScreenshotsUpload}
                                                                disabled={!canUploadAppScreenshots || appScreenshotsUploading}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <p className="mt-3 text-[11px] text-indigo-200/60">{text('upload_rules_note')}</p>
                                        </section>

                                        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('generation')}</p>
                                                    <p className="text-sm text-indigo-200/60">{text('generation_subtitle')}</p>
                                                </div>
                                                <div className="text-[11px] text-indigo-200/60">{text('versions_limit_note')}</div>
                                            </div>

                                            <div className="mt-5 space-y-4">
                                                <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-white">{text('generate_icon')}</p>
                                                            <p className="text-xs text-indigo-200/60">{text('generate_icon_subtitle')}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleGenerateIcon}
                                                            disabled={!canGenerateIcon || iconGenerating}
                                                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                                                canGenerateIcon
                                                                    ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                                    : 'border-white/10 text-indigo-200/40'
                                                            }`}
                                                        >
                                                            {iconGenerating
                                                                ? text('generating')
                                                                : generatedIcon
                                                                    ? text('regenerate_icon')
                                                                    : text('generate_icon')}
                                                        </button>
                                                    </div>
                                                    <div className="max-w-[240px] space-y-3">
                                                        <div className="rounded-xl bg-slate-900/35 border border-indigo-400/20 p-2.5">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('generated_icon')}</p>
                                                                {generatedIcon && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownloadGeneratedAsset(
                                                                            generatedIcon,
                                                                            `${selectedApp?.alias ?? 'app'}-icon-1024.jpg`
                                                                        )}
                                                                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                        aria-label={text('download')}
                                                                    >
                                                                        <Download size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 mx-auto flex w-full items-center justify-center text-center aspect-square rounded-xl bg-slate-800/35 ring-1 ring-indigo-400/25">
                                                                {generatedIcon && generatedUrls[generatedIcon.id] ? (
                                                                    <img
                                                                        src={generatedUrls[generatedIcon.id]}
                                                                        alt={text('generated_icon')}
                                                                        className="max-h-[90%] max-w-[90%] object-contain cursor-zoom-in"
                                                                        onClick={() => openLightbox(generatedUrls[generatedIcon.id], text('generated_icon'))}
                                                                    />
                                                                ) : (
                                                                    <span className="text-xs text-indigo-200/60">{text('no_generated_icon')}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">{text('icon_prompt_label')}</label>
                                                            <textarea
                                                                value={brandIconReference?.prompt ?? ''}
                                                                onChange={(event) => brandIconReference && handleBrandPromptChange(brandIconReference.id, event.target.value)}
                                                                onInput={handleAutoGrowInput}
                                                                onBlur={(event) => brandIconReference && handleBrandPromptSave(brandIconReference.id, event.target.value)}
                                                                placeholder={brandIconReference ? text('prompt_placeholder') : text('upload_icon_to_add_prompt')}
                                                                rows={3}
                                                                disabled={!brandIconReference}
                                                                className="auto-grow w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-white">{text('generate_screenshots')}</p>
                                                            <p className="text-xs text-indigo-200/60">{text('generate_screenshots_subtitle')}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleGenerateScreenshots}
                                                            disabled={!canGenerateScreenshots || screenshotsGenerating}
                                                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                                                canGenerateScreenshots
                                                                    ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                                    : 'border-white/10 text-indigo-200/40'
                                                            }`}
                                                        >
                                                            {screenshotsGenerating
                                                                ? text('generating')
                                                                : existingSlotCount
                                                                    ? text('add_slots')
                                                                    : text('create_slots')}
                                                        </button>
                                                    </div>

                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        <div>
                                                            <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_count')}</label>
                                                            <select
                                                                value={generationCount}
                                                                onChange={(event) => setGenerationCount(Number(event.target.value))}
                                                                className="mt-2 w-full rounded-xl border border-indigo-500/20 bg-slate-950/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                            >
                                                                {[3, 4, 5, 6].map((count) => (
                                                                    <option key={count} value={count}>
                                                                        {count}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_size')}</label>
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                {(['6.5', '6.9'] as const).map((sizeKey) => (
                                                                    <button
                                                                        key={sizeKey}
                                                                        type="button"
                                                                        onClick={() => setGenerationSize(sizeKey)}
                                                                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                                                            generationSize === sizeKey
                                                                                ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100'
                                                                                : 'border-white/10 text-indigo-200/60 hover:border-indigo-400/40 hover:text-white'
                                                                        }`}
                                                                    >
                                                                        {sizeKey === '6.5' ? text('size_65') : text('size_69')}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-xl border border-indigo-900/40 bg-slate-900/30 p-3 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('slot_sources')}</p>
                                                            <span className="text-[10px] text-indigo-200/50">{text('slot_sources_hint')}</span>
                                                        </div>
                                                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                                            {Array.from({ length: targetSlotCount }, (_, index) => {
                                                                const slotIndex = index + 1;
                                                                const mapping = getSlotMapping(slotIndex);
                                                                return (
                                                                    <div
                                                                        key={slotIndex}
                                                                        className="rounded-xl border border-indigo-900/40 bg-slate-900/35 p-2 space-y-2"
                                                                    >
                                                                        <div className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/70">
                                                                            {text('slot')} {slotIndex}
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[10px] text-indigo-200/60">{text('brand_reference_label')}</label>
                                                                            <select
                                                                                value={mapping.brandRefId ?? ''}
                                                                                onChange={(event) => updateSlotMapping(slotIndex, { brandRefId: event.target.value || null })}
                                                                                disabled={!brandScreenshotReferences.length}
                                                                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                                                            >
                                                                                {!brandScreenshotReferences.length ? (
                                                                                    <option value="">{text('no_screenshot_refs')}</option>
                                                                                ) : (
                                                                                    brandScreenshotReferences.map((ref, refIndex) => (
                                                                                        <option key={ref.id} value={ref.id}>
                                                                                            {text('reference_short')} {refIndex + 1}
                                                                                        </option>
                                                                                    ))
                                                                                )}
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[10px] text-indigo-200/60">{text('simulator_shot_label')}</label>
                                                                            <select
                                                                                value={mapping.simShotId ?? ''}
                                                                                onChange={(event) => updateSlotMapping(slotIndex, { simShotId: event.target.value || null })}
                                                                                disabled={!selectedAppScreenshots.length}
                                                                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60"
                                                                            >
                                                                                {!selectedAppScreenshots.length ? (
                                                                                    <option value="">{text('no_screenshots_yet')}</option>
                                                                                ) : (
                                                                                    selectedAppScreenshots.map((shot, shotIndex) => (
                                                                                        <option key={shot.id} value={shot.id}>
                                                                                            {text('simulator_short')} {shotIndex + 1}
                                                                                        </option>
                                                                                    ))
                                                                                )}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className="text-xs text-indigo-200/60">
                                                        {slotsToCreate.length ? (
                                                            <span>{text('slots_to_create')}: {slotsToCreate.length}</span>
                                                        ) : (
                                                            <span>{text('all_slots_ready')}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-indigo-200/40">{text('generation_notice')}</p>
                                                    <div className="rounded-xl border border-indigo-900/40 bg-slate-900/30 p-3 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('screenshot_prompt_label')}</p>
                                                            <span className="text-[11px] text-indigo-200/50">
                                                                {brandScreenshotReferences.length}/{MAX_SCREENSHOT_REFS}
                                                            </span>
                                                        </div>
                                                        {brandScreenshotReferences.length === 0 ? (
                                                            <p className="text-xs text-indigo-200/60">{text('screenshot_prompt_empty')}</p>
                                                        ) : (
                                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                                {brandScreenshotReferences.map((ref, index) => (
                                                                    <div
                                                                        key={ref.id}
                                                                        className="rounded-xl border border-indigo-900/40 bg-slate-900/30 p-2 space-y-2"
                                                                    >
                                                                        <div className="text-[10px] font-semibold tracking-[0.12em] text-indigo-200/60">
                                                                            {text('reference_short')} {index + 1}
                                                                        </div>
                                                                        <textarea
                                                                            value={ref.prompt ?? ''}
                                                                            onChange={(event) => handleBrandPromptChange(ref.id, event.target.value)}
                                                                            onInput={handleAutoGrowInput}
                                                                            onBlur={(event) => handleBrandPromptSave(ref.id, event.target.value)}
                                                                            placeholder={text('prompt_placeholder')}
                                                                            rows={2}
                                                                            className="auto-grow w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('generated_screenshots')}</p>
                                                    <p className="text-sm text-indigo-200/60">{text('generated_screenshots_subtitle')}</p>
                                                </div>
                                                {generatedScreenshotSlots.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleDownloadAllScreenshots}
                                                        className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-400/10"
                                                    >
                                                        <Download size={12} />
                                                        {text('download_all')}
                                                    </button>
                                                )}
                                            </div>

                                            {!selectedApp ? (
                                                <p className="mt-4 text-sm text-indigo-200/60">{text('select_app_to_view')}</p>
                                            ) : generatedScreenshotSlots.length === 0 ? (
                                                <div className="mt-4 rounded-2xl border border-dashed border-indigo-900/40 p-4 text-sm text-indigo-200/60">
                                                    {text('no_generated_screenshots')}
                                                </div>
                                            ) : (
                                                <div className="mt-4 space-y-4">
                                                    {generatedScreenshotSlots.map((slot) => (
                                                        <div
                                                            key={slot.slotIndex}
                                                            className="rounded-2xl bg-slate-900/30 ring-1 ring-white/5 p-4 space-y-3"
                                                        >
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-white">{text('slot')} {slot.slotIndex}</p>
                                                                    <p className="text-xs text-indigo-200/60">{text('versions_limit_note')}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleGenerateScreenshotVersion(slot.slotIndex)}
                                                                    disabled={slot.versions.length >= MAX_SCREENSHOT_VERSIONS || slotGenerating === slot.slotIndex}
                                                                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold border ${
                                                                        slot.versions.length >= MAX_SCREENSHOT_VERSIONS
                                                                            ? 'border-white/10 text-indigo-200/40'
                                                                            : 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40 hover:bg-indigo-500/30'
                                                                    }`}
                                                                >
                                                                    {slotGenerating === slot.slotIndex ? text('generating') : text('new_version')}
                                                                </button>
                                                            </div>
                                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                                {slot.versions.map((asset) => {
                                                                    const overlayState = editDrafts[asset.id] ?? asset.edit_state;
                                                                    const layers = overlayState?.layers ?? [];
                                                                    return (
                                                                        <div
                                                                            key={asset.id}
                                                                            className="rounded-2xl bg-slate-950/60 ring-1 ring-white/5 p-3 space-y-3"
                                                                        >
                                                                            <div className="relative overflow-hidden rounded-xl border border-indigo-900/40 bg-slate-800/45 aspect-[9/19]">
                                                                                {generatedUrls[asset.id] ? (
                                                                                    <>
                                                                                        <img
                                                                                            src={generatedUrls[asset.id]}
                                                                                            alt={`${text('slot')} ${slot.slotIndex}`}
                                                                                            className="h-full w-full object-cover cursor-zoom-in"
                                                                                            onClick={() => openLightbox(generatedUrls[asset.id], `${text('slot')} ${slot.slotIndex}`)}
                                                                                        />
                                                                                        {layers.map((layer) => (
                                                                                            <div
                                                                                                key={layer.id}
                                                                                                className="absolute max-w-[90%] whitespace-pre-wrap"
                                                                                                style={{
                                                                                                    left: `${layer.x}%`,
                                                                                                    top: `${layer.y}%`,
                                                                                                    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                                                                                                    fontFamily: layer.font,
                                                                                                    fontSize: `${layer.size}px`,
                                                                                                    fontWeight: layer.weight,
                                                                                                    color: layer.color,
                                                                                                    textAlign: layer.align,
                                                                                                    lineHeight: 1.1,
                                                                                                }}
                                                                                            >
                                                                                                {layer.text}
                                                                                            </div>
                                                                                        ))}
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="flex h-full w-full items-center justify-center text-xs text-indigo-200/60">
                                                                                        {text('loading')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-between text-xs text-indigo-200/70">
                                                                                <span>{text('version')} {asset.version_index ?? 1}</span>
                                                                                <div className="flex items-center gap-2">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => beginEditAsset(asset)}
                                                                                        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                    >
                                                                                        {text('edit')}
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleDownloadGeneratedAsset(
                                                                                            asset,
                                                                                            `${formatSlotIndex(slot.slotIndex)}-v${asset.version_index ?? 1}.jpg`
                                                                                        )}
                                                                                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                        aria-label={text('download')}
                                                                                    >
                                                                                        <Download size={12} />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleDeleteGeneratedAsset(asset)}
                                                                                        className="inline-flex items-center justify-center rounded-full border border-white/10 p-1.5 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                        aria-label={text('delete')}
                                                                                    >
                                                                                        <Trash2 size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            {editAssetId === asset.id && (
                                                                                <div className="rounded-2xl bg-slate-950/70 ring-1 ring-white/5 p-3 space-y-3">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <p className="text-xs font-semibold text-indigo-200/70">{text('edit_layers')}</p>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => addLayer(asset.id)}
                                                                                            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                        >
                                                                                            <Plus size={12} />
                                                                                            {text('add_text_layer')}
                                                                                        </button>
                                                                                    </div>
                                                                                    {(editDrafts[asset.id]?.layers ?? []).map((layer, index) => (
                                                                                        <div
                                                                                            key={layer.id}
                                                                                            className="rounded-xl border border-indigo-900/40 bg-slate-900/30 p-3 space-y-2"
                                                                                        >
                                                                                            <div className="flex items-center justify-between">
                                                                                                <p className="text-[11px] font-semibold text-indigo-200/70">{text('layer')} {index + 1}</p>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => removeLayer(asset.id, layer.id)}
                                                                                                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-1 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                                    aria-label={text('delete')}
                                                                                                >
                                                                                                    <Trash2 size={10} />
                                                                                                </button>
                                                                                            </div>
                                                                                            <div>
                                                                                                <label className="text-[10px] text-indigo-200/60">{text('text')}</label>
                                                                                                <input
                                                                                                    value={layer.text}
                                                                                                    onChange={(event) => updateLayer(asset.id, layer.id, { text: event.target.value })}
                                                                                                    className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                                                                />
                                                                                            </div>
                                                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('font')}</label>
                                                                                                    <select
                                                                                                        value={layer.font}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { font: event.target.value })}
                                                                                                        className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                                                                    >
                                                                                                        {EDIT_FONTS.map((font) => (
                                                                                                            <option key={font} value={font}>
                                                                                                                {font}
                                                                                                            </option>
                                                                                                        ))}
                                                                                                    </select>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('align')}</label>
                                                                                                    <select
                                                                                                        value={layer.align}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { align: event.target.value as TextLayer['align'] })}
                                                                                                        className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                                                                    >
                                                                                                        <option value="left">{text('align_left')}</option>
                                                                                                        <option value="center">{text('align_center')}</option>
                                                                                                        <option value="right">{text('align_right')}</option>
                                                                                                    </select>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="grid gap-2 sm:grid-cols-3">
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('size')}</label>
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        min={12}
                                                                                                        max={160}
                                                                                                        value={layer.size}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { size: Number(event.target.value) })}
                                                                                                        className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                                                                    />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('weight')}</label>
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        min={200}
                                                                                                        max={900}
                                                                                                        step={100}
                                                                                                        value={layer.weight}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { weight: Number(event.target.value) })}
                                                                                                        className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                                                                                                    />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('color')}</label>
                                                                                                    <input
                                                                                                        type="color"
                                                                                                        value={layer.color}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { color: event.target.value })}
                                                                                                        className="mt-1 h-8 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1"
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="grid gap-2 sm:grid-cols-3">
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('position_x')}</label>
                                                                                                    <input
                                                                                                        type="range"
                                                                                                        min={0}
                                                                                                        max={100}
                                                                                                        value={layer.x}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { x: Number(event.target.value) })}
                                                                                                        className="mt-1 w-full"
                                                                                                    />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('position_y')}</label>
                                                                                                    <input
                                                                                                        type="range"
                                                                                                        min={0}
                                                                                                        max={100}
                                                                                                        value={layer.y}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { y: Number(event.target.value) })}
                                                                                                        className="mt-1 w-full"
                                                                                                    />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <label className="text-[10px] text-indigo-200/60">{text('rotation')}</label>
                                                                                                    <input
                                                                                                        type="range"
                                                                                                        min={-45}
                                                                                                        max={45}
                                                                                                        value={layer.rotation}
                                                                                                        onChange={(event) => updateLayer(asset.id, layer.id, { rotation: Number(event.target.value) })}
                                                                                                        className="mt-1 w-full"
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                    <div className="flex items-center gap-2">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleSaveEdit(asset.id)}
                                                                                            disabled={editSaving === asset.id}
                                                                                            className="flex-1 rounded-xl bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30"
                                                                                        >
                                                                                            {editSaving === asset.id ? text('saving') : text('save_edits')}
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => resetEditDraft(asset)}
                                                                                            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                                                                                        >
                                                                                            {text('cancel_edit')}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </section>

                                        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6">
                                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('app_data_placeholder')}</p>
                                            <div className="mt-3 space-y-2 text-xs text-indigo-200/70">
                                                {[
                                                    'AppId',
                                                    'BundleID',
                                                    'Company Name',
                                                    'id_purchases',
                                                    'Apphud API URL',
                                                    'Privacy Policy',
                                                    'Term of Use',
                                                    'Support Form',
                                                    'Domain',
                                                    'Appstore Description',
                                                ].map((item) => (
                                                    <div key={item} className="flex items-center justify-between border-b border-indigo-900/30 pb-2">
                                                        <span>{item}</span>
                                                        <span className="text-indigo-200/40">{text('placeholder')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section className="rounded-[28px] bg-slate-800/45 ring-1 ring-white/5 p-6">
                                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('dev_files_placeholder')}</p>
                                            <p className="mt-3 text-sm text-indigo-200/60">{text('dev_files_subtitle')}</p>
                                        </section>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            {lightbox && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
                    onClick={closeLightbox}
                >
                    <div
                        className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-indigo-400/30 bg-slate-950/70 p-3"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={closeLightbox}
                            className="absolute right-2 top-2 rounded-full border border-white/10 bg-slate-950/80 p-2 text-indigo-200/70 hover:text-white"
                            aria-label={text('close')}
                        >
                            <X size={14} />
                        </button>
                        <img
                            src={lightbox.src}
                            alt={lightbox.alt}
                            className="max-h-[85vh] w-auto max-w-[85vw] rounded-xl object-contain"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

