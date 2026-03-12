import { useMemo } from 'react';
import type { AppItem, AppScreenshotSet, AssetPick, GeneratedAsset } from '../types/zefgen';

type GenerationJobSummary = {
    kind: string;
    status: string | null;
};

type UseAppShellDerivedStateParams = {
    appScreenshotsLoading: boolean;
    appsLoading: boolean;
    assetPicks: AssetPick[];
    brandReferencesLoading: boolean;
    brandsLoading: boolean;
    draggingAppId: string | null;
    generatedAssetsLoading: boolean;
    generationJobs: GenerationJobSummary[];
    isAppPillPanning: boolean;
    isAppReorderMode: boolean;
    pickedIconAssetId: string | null;
    screenshotSets: AppScreenshotSet[];
    selectedApp: AppItem | null;
    selectedGeneratedAssets: GeneratedAsset[];
};

export function useAppShellDerivedState({
    appScreenshotsLoading,
    appsLoading,
    assetPicks,
    brandReferencesLoading,
    brandsLoading,
    draggingAppId,
    generatedAssetsLoading,
    generationJobs,
    isAppPillPanning,
    isAppReorderMode,
    pickedIconAssetId,
    screenshotSets,
    selectedApp,
    selectedGeneratedAssets,
}: UseAppShellDerivedStateParams) {
    const routeLoading = brandsLoading || appsLoading;
    const dataLoading =
        brandsLoading ||
        appsLoading ||
        brandReferencesLoading ||
        appScreenshotsLoading ||
        generatedAssetsLoading;

    const pickedIconAsset = useMemo(() => {
        if (!pickedIconAssetId) return null;
        return selectedGeneratedAssets.find((asset) => asset.id === pickedIconAssetId) ?? null;
    }, [pickedIconAssetId, selectedGeneratedAssets]);

    const unpickedCount = useMemo(() => {
        const pickedAssetIds = new Set(assetPicks.map((pick) => pick.generated_asset_id));
        return selectedGeneratedAssets.filter((asset) => !pickedAssetIds.has(asset.id)).length;
    }, [assetPicks, selectedGeneratedAssets]);

    const isCreatingGithubRepo = useMemo(
        () =>
            generationJobs.some(
                (job) =>
                    job.kind === 'github_repo_create' &&
                    (job.status === 'running' || job.status === 'queued')
            ),
        [generationJobs]
    );

    const isDeletingGithubRepo = useMemo(
        () =>
            generationJobs.some(
                (job) =>
                    job.kind === 'github_repo_delete' &&
                    (job.status === 'running' || job.status === 'queued')
            ),
        [generationJobs]
    );

    const setReadiness = useMemo(
        () =>
            screenshotSets.map((set) => {
                const requiredCount = Math.min(6, Math.max(3, Number(set.slot_count) || 3));
                const pickedCount = assetPicks.filter(
                    (pick) =>
                        pick.kind === 'screenshot' &&
                        pick.screenshot_set_id === set.id &&
                        typeof pick.slot_index === 'number' &&
                        pick.slot_index >= 1 &&
                        pick.slot_index <= requiredCount
                ).length;
                return { set, pickedCount, requiredCount };
            }),
        [assetPicks, screenshotSets]
    );

    return {
        connectorEnabled: Boolean(selectedApp),
        dataLoading,
        isCreatingGithubRepo,
        isDeletingGithubRepo,
        isTabMotionDisabled: isAppReorderMode || isAppPillPanning || Boolean(draggingAppId),
        pickedIconAsset,
        routeLoading,
        setReadiness,
        unpickedCount,
    };
}
