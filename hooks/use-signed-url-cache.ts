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
            return cached.url;
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
                throw new Error(error?.message || 'Failed to create signed URL.');
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
