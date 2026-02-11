import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const STORAGE_PREFIX = 'zefgen:signedUrl:v1';

const safeJsonParse = (raw: string | null) => {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const useSignedUrlCache = ({ userId }: { userId: string | null }) => {
    const signedUrlCacheRef = useRef<Record<string, { url: string; expiresAt: number }>>({});

    const getSignedUrl = useCallback(async (bucket: string, path: string) => {
        const key = `${bucket}:${path}`;
        const cached = signedUrlCacheRef.current[key];
        const now = Date.now();
        if (cached && cached.expiresAt > now + 60_000) {
            if (cached.url) return cached.url;
            // Negative cache: known-missing object (common for older `*-preview.jpg` variants).
            throw new Error('Signed URL not available.');
        }

        const lsKey = userId ? `${STORAGE_PREFIX}:${userId}:${bucket}:${path}` : null;
        if (lsKey && typeof window !== 'undefined') {
            const parsed = safeJsonParse(window.localStorage.getItem(lsKey)) as any;
            if (parsed && typeof parsed.url === 'string' && typeof parsed.expiresAt === 'number') {
                if (parsed.expiresAt > now + 60_000) {
                    signedUrlCacheRef.current[key] = { url: parsed.url, expiresAt: parsed.expiresAt };
                    return parsed.url;
                }
            }
        }

        const tryCreate = async (expiresInSeconds: number) => {
            const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
            if (error || !data?.signedUrl) {
                const message = String(error?.message || 'Failed to create signed URL.');
                const status = Number((error as any)?.statusCode || (error as any)?.status) || 0;

                // Supabase returns 400 for missing objects when creating signed URLs.
                // Cache "missing" for preview objects to avoid repeated noisy 400s in the console.
                const looksMissing =
                    status === 400 ||
                    /not\s*found/i.test(message) ||
                    /object/i.test(message) && /not\s*found/i.test(message);
                const isPreview = /-preview\.jpg$/i.test(String(path));
                if (looksMissing && isPreview) {
                    const expiresAt = now + 86_400 * 1000; // 24h negative cache
                    signedUrlCacheRef.current[key] = { url: '', expiresAt };
                    if (userId && typeof window !== 'undefined') {
                        const lsKey = `${STORAGE_PREFIX}:${userId}:${bucket}:${path}`;
                        try {
                            window.localStorage.setItem(lsKey, JSON.stringify({ url: '', expiresAt }));
                        } catch {
                            // ignore
                        }
                    }
                }

                throw new Error(message);
            }
            return data.signedUrl as string;
        };

        let signedUrl = '';
        let ttlSeconds = 86_400; // 24 hours
        try {
            signedUrl = await tryCreate(ttlSeconds);
        } catch {
            ttlSeconds = 3_600; // fallback for projects that restrict TTL
            signedUrl = await tryCreate(ttlSeconds);
        }

        const expiresAt = now + ttlSeconds * 1000;
        signedUrlCacheRef.current[key] = { url: signedUrl, expiresAt };
        if (lsKey && typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(lsKey, JSON.stringify({ url: signedUrl, expiresAt }));
            } catch {
                // Ignore quota/blocked storage; in-memory cache still helps within a session.
            }
        }
        return signedUrl;
    }, [userId]);

    return { getSignedUrl };
};
