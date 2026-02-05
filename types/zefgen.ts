export type Brand = {
    id: string;
    name: string;
    slug: string;
    user_id?: string;
    created_at?: string;
};

export type AppItem = {
    id: string;
    brand_id: string;
    name: string;
    alias: string;
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
};

export type EditState = {
    layers: TextLayer[];
};

export type GeneratedAsset = {
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

export type BrandFormState = {
    name: string;
};

export type AppFormState = {
    name: string;
    alias: string;
};
