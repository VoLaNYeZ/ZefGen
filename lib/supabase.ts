import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
        '- If you just edited env files: restart the dev server.\n' +
        '- If this is production: set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in the build environment and rebuild.\n' +
        '- Local dev file: .env.local (repo root).'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
