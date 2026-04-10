export type Brand = {
    id: string;
    name: string;
    slug: string;
    order_index?: number | null;
    is_no_brand?: boolean | null;
    is_inactive?: boolean | null;
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
    icon_prompt?: string | null;
    github_repo_url?: string | null;
    github_repo_full_name?: string | null;
    github_repo_created_at?: string | null;
    github_repo_updated_at?: string | null;
    client_github_repo_url?: string | null;
    client_github_repo_full_name?: string | null;
    client_github_repo_published_at?: string | null;
    client_github_repo_updated_at?: string | null;
    trusted_main_source_sha?: string | null;
    trusted_main_source_synced_at?: string | null;
    appstore_url?: string | null;
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
    source_kind?: 'upload' | 'runner';
    artifact_id?: string | null;
    imported_from_job_id?: string | null;
    theme?: string | null;
    viewport?: string | null;
    capture_variant?: 'render' | 'simulator' | null;
    target_id?: string | null;
};

export type AppScreenshotImportWarningCode =
    | 'job_app_mismatch'
    | 'source_job_app_mismatch'
    | 'artifact_app_mismatch';

export type AppScreenshotImportWarning = {
    jobId: string;
    code: AppScreenshotImportWarningCode;
    message: string;
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
    slot_mappings?: Record<
        string,
        {
            slotMode?: 'simulator' | 'brand' | null;
            brandRefSource?: 'screenshot_ref' | 'picked_export_icon' | null;
            brandRefId?: string | null;
            simShotId?: string | null;
            styleRefAssetId?: string | null;
        }
    > | null;
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

export type AppstoreAccount = {
    id: string;
    app_id: string | null;
    user_id?: string;
    usability: boolean;
    was_used_before: boolean;
    email: string;
    password: string;
    email_password: string;
    number: string;
    geo: string;
    company_name: string;
    proxy: string;
    notes: string;
    updated_at?: string;
    created_at?: string;
};

export type AppstoreReviewWebhook = {
    app_id: string;
    user_id?: string;
    public_token: string;
    secret: string;
    public_subdomain?: string | null;
    public_page_published_at?: string | null;
    key_mode?: 'team' | 'individual' | null;
    key_id?: string | null;
    issuer_id?: string | null;
    public_webhook_url?: string | null;
    asc_app_id?: string | null;
    asc_app_name?: string | null;
    asc_bundle_id?: string | null;
    apple_webhook_id?: string | null;
    latest_event_type?: string | null;
    latest_review_state?: string | null;
    latest_previous_state?: string | null;
    latest_event_at?: string | null;
    last_snapshot_at?: string | null;
    last_delivery_at?: string | null;
    last_delivery_status: 'idle' | 'received' | 'ignored' | 'invalid_signature' | 'error';
    last_error?: string | null;
    last_sync_at?: string | null;
    last_sync_status?: 'idle' | 'connected' | 'error';
    last_sync_error?: string | null;
    created_at?: string;
    updated_at?: string;
};

export type AppstoreReviewEvent = {
    id: string;
    app_id: string;
    user_id?: string;
    event_type: string;
    payload_type: string;
    state_from?: string | null;
    state_to?: string | null;
    event_at: string;
    delivery_status: 'received' | 'ignored' | 'error' | 'snapshot';
    raw_payload?: Record<string, any> | null;
    created_at?: string;
};

export type AppstoreConnectAppCandidate = {
    id: string;
    name: string;
    bundle_id: string;
    sku: string;
    bundle_match: boolean;
};

export type AppstoreReviewWebhookStatus = {
    webhook: AppstoreReviewWebhook | null;
    events: AppstoreReviewEvent[];
    bundle_id: string | null;
    private_key_configured: boolean;
    effective_public_webhook_url: string;
    effective_public_page_url: string;
    credential_issues: string[];
    webhook_readiness_issues: string[];
};

export type AppIdeaCategory = {
    id: string;
    slug: string;
    name: string;
    order_index: number;
    created_at?: string;
};

export type IdeaSource = 'manual' | 'generated';
export type IdeaStatus = 'generated' | 'used' | 'superseded' | 'removed';
export type IdeaCreativityTier = 'safe' | 'balanced' | 'wild';

export type AppIdea = {
    id: string;
    user_id?: string;
    brand_id: string;
    category_id: string;
    idea_source?: IdeaSource;
    status?: IdeaStatus;
    title: string;
    description: string;
    client_spec_current: string;
    alternate_names?: string[] | null;
    idea_family_id?: string;
    version_index?: number;
    spec_revision_index?: number;
    parent_idea_id?: string | null;
    last_generated_output_id?: string | null;
    edited_after_generation?: boolean | null;
    memory_fingerprint?: string | null;
    updated_at?: string;
    created_at?: string;
};

export type IdeaAppAssignment = {
    app_id: string;
    idea_id: string;
};

export type IdeaGenerationRun = {
    id: string;
    job_id: string;
    user_id?: string;
    brand_id: string;
    requested_count: number;
    creativity_mix: Record<IdeaCreativityTier, number>;
    suggested_categories?: Array<{ id?: string; slug?: string; reason?: string; confidence?: number }> | null;
    confirmed_category_ids?: string[] | null;
    generator_profile_id?: string | null;
    template_mix_version?: string | null;
    context_summary?: Record<string, any> | null;
    created_at?: string;
    updated_at?: string;
};

export type IdeaGenerationOutput = {
    id: string;
    run_id: string;
    job_id: string;
    user_id?: string;
    brand_id: string;
    app_idea_id?: string | null;
    category_id: string;
    idea_family_id: string;
    version_index: number;
    output_index: number;
    parent_idea_id?: string | null;
    creativity_tier: IdeaCreativityTier;
    final_name: string;
    alternate_names?: string[] | null;
    idea_summary: string;
    client_spec_generated: string;
    classification: 'new_family' | 'new_version' | 'too_close_surface_repeat';
    comparison_snapshot?: Record<string, any> | null;
    generator_profile_id?: string | null;
    template_mix_version?: string | null;
    created_at?: string;
};

export type BrandFormState = {
    name: string;
    isInactive: boolean;
};

export type AppFormState = {
    name: string;
    alias: string;
};

export type WorkspaceSessionSnapshot = {
    active_session_count: number;
    active_session_countries: string[];
    locked_brand_ids_by_other_devices: string[];
};

export type BrandLockReason =
    | 'brand_required'
    | 'locked_by_other_device'
    | 'session_id_collision'
    | 'unauthorized'
    | 'disabled'
    | 'unavailable'
    | (string & {});

export type BrandLockResult = {
    ok: boolean;
    reason: BrandLockReason | null;
};

// Client-side generation provider selector (internal; no DB impact).
export type ScreenshotProviderId =
    | 'replicate:nano-banana-2'
    | 'replicate:nano-banana-pro'
    | 'replicate:seedream-4'
    | 'openai:gpt-image-1.5';
