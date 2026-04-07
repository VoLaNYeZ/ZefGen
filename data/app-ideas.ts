import { supabase } from '../lib/supabase';
import type { AppIdea, IdeaAppAssignment } from '../types/zefgen';

const IDEA_SELECT = [
    'id',
    'user_id',
    'brand_id',
    'category_id',
    'idea_source',
    'status',
    'title',
    'description',
    'client_spec_current',
    'alternate_names',
    'idea_family_id',
    'version_index',
    'spec_revision_index',
    'parent_idea_id',
    'last_generated_output_id',
    'edited_after_generation',
    'memory_fingerprint',
    'updated_at',
    'created_at',
].join(', ');
const CATEGORY_SELECT = 'id, slug, name, order_index, created_at';
const IDEA_ASSIGNMENT_SELECT = 'app_id, idea_id';

export const fetchIdeaCategories = async () =>
    supabase
        .from('app_idea_categories')
        .select(CATEGORY_SELECT)
        .order('order_index', { ascending: true })
        .order('name', { ascending: true });

export const fetchAppIdeas = async (userId: string) =>
    supabase
        .from('app_ideas')
        .select(IDEA_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

export const fetchIdeaAssignments = async (userId: string) =>
    supabase
        .from('connector_app_configs')
        .select(IDEA_ASSIGNMENT_SELECT)
        .eq('user_id', userId)
        .not('idea_id', 'is', null)
        .returns<IdeaAppAssignment[]>();

export const createAppIdea = async (payload: {
    userId: string;
    row: Partial<Omit<AppIdea, 'id' | 'user_id' | 'updated_at' | 'created_at'>>;
}) => {
    const nowIso = new Date().toISOString();
    return supabase
        .from('app_ideas')
        .insert({
            user_id: payload.userId,
            updated_at: nowIso,
            ...payload.row,
        })
        .select(IDEA_SELECT)
        .single();
};

export type UpdateAppIdeaStatus = 'saved' | 'conflict';

export type UpdateAppIdeaResponse = {
    status: UpdateAppIdeaStatus;
    row: AppIdea | null;
};

export const updateAppIdea = async (payload: {
    userId: string;
    id: string;
    patch: Partial<Omit<AppIdea, 'id' | 'user_id' | 'created_at'>>;
    expectedUpdatedAt?: string | null;
}) => {
    const nowIso = new Date().toISOString();
    let query = supabase
        .from('app_ideas')
        .update({ ...payload.patch, updated_at: nowIso })
        .eq('user_id', payload.userId)
        .eq('id', payload.id);

    if (payload.expectedUpdatedAt) {
        query = query.eq('updated_at', payload.expectedUpdatedAt);
    }

    const { data, error } = await query.select(IDEA_SELECT);
    if (error) {
        return {
            data: null as UpdateAppIdeaResponse | null,
            error,
        };
    }

    const savedRow = Array.isArray(data) ? (((data[0] as unknown as AppIdea | undefined) || null)) : null;
    if (savedRow) {
        return {
            data: {
                status: 'saved',
                row: savedRow,
            } satisfies UpdateAppIdeaResponse,
            error: null,
        };
    }

    if (payload.expectedUpdatedAt) {
        const { data: latestRow, error: latestError } = await supabase
            .from('app_ideas')
            .select(IDEA_SELECT)
            .eq('user_id', payload.userId)
            .eq('id', payload.id)
            .limit(1);

        const currentRow = Array.isArray(latestRow) ? (((latestRow[0] as unknown as AppIdea | undefined) || null)) : null;

        return {
            data: {
                status: 'conflict',
                row: currentRow,
            } satisfies UpdateAppIdeaResponse,
            error: latestError,
        };
    }

    return {
        data: {
            status: 'saved',
            row: null,
        } satisfies UpdateAppIdeaResponse,
        error: null,
    };
};

export const deleteAppIdea = async (payload: { userId: string; id: string }) =>
    supabase
        .from('app_ideas')
        .delete()
        .eq('user_id', payload.userId)
        .eq('id', payload.id);
