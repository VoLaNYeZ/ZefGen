import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useSignedUrlCache = () => {
    const signedUrlCacheRef = useRef<Record<string, { url: string; expiresAt: number }>>({});

    const getSignedUrl = useCallback(async (bucket: string, path: string) => {
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
    }, []);

    return { getSignedUrl };
};
