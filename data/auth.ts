import { supabase } from '../lib/supabase';

export const signOut = async () => supabase.auth.signOut();
