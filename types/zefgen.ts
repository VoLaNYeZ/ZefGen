export type Brand = {
    id: string;
    name: string;
    slug: string;
    order_index?: number | null;
    target_countries?: string[] | null;
    keywords?: string | null;
    release_strategy_notes?: string | null;
    release_strategy_updated_at?: string | null;
    user_id?: string;
    created_at?: string;
};

export type AppItem = {
    id: string;
    brand_id: string;
    name: string;
    alias: string;
    github_repo_url?: string | null;
    github_repo_full_name?: string | null;
    github_repo_created_at?: string | null;
    github_repo_updated_at?: string | null;
    order_index?: number | null;
    is_banned?: boolean | null;
    user_id?: string;
    created_at?: string;
};

export type BrandReference = {
    id: string;
    brand_id: string;
    user_id?: string;
    kind: 'icon' | 'screenshot';
    image_path: string;
    prompt: string | null;
    order_index: number | null;
    created_at?: string;
};

export type AppScreenshotPrompt = {
    id: string;
    user_id?: string;
    brand_id: string;
    app_id: string;
    brand_reference_id: string;
    prompt: string;
    updated_at?: string;
};

export type AppScreenshot = {
    id: string;
    app_id: string;
    brand_id: string;
    user_id?: string;
    image_path: string;
    order_index: number | null;
    created_at?: string;
};

export type TextLayer = {
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
    shadow?: {
        enabled: boolean;
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
    };
    outline?: {
        enabled: boolean;
        color: string;
        width: number;
    };
};

export type EditState = {
    layers: TextLayer[];
};

export type GeneratedAsset = {
    id: string;
    app_id: string;
    brand_id: string;
    user_id?: string;
    kind: 'icon' | 'icon_enhanced' | 'screenshot' | 'screenshot_enhanced';
    slot_index: number | null;
    version_index: number | null;
    image_path: string;
    screenshot_set_id?: string | null;
    size_label: string | null;
    width: number | null;
    height: number | null;
    status: 'ready' | 'pending' | 'failed' | null;
    edit_state: EditState | null;
    created_at?: string;
};

export type AppScreenshotSet = {
    id: string;
    user_id?: string;
    brand_id: string;
    app_id: string;
    name: string;
    size_label: '6.5' | '6.9';
    slot_count: number;
    order_index: number;
    created_at?: string;
};

export type AssetPick = {
    id: string;
    user_id?: string;
    brand_id: string;
    app_id: string;
    kind: 'icon' | 'screenshot';
    screenshot_set_id: string | null;
    slot_index: number | null;
    generated_asset_id: string;
    created_at?: string;
};

export type AppExportStatus = {
    app_id: string;
    user_id?: string;
    brand_id: string;
    is_completed: boolean;
    completed_at: string | null;
    updated_at?: string;
};

export type BrandFormState = {
    name: string;
};

export type AppFormState = {
    name: string;
    alias: string;
};

// Client-side generation provider selector (internal; no DB impact).
export type ScreenshotProviderId =
    | 'replicate:nano-banana-pro'
    | 'replicate:seedream-4'
    | 'openai:gpt-image-1.5';
