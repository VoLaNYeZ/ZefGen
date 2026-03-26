import { Suspense, type ComponentProps, type FormEvent } from 'react';
import type { TranslationKey } from '../../i18n';
import type { AppItem } from '../../types/zefgen';
import { AppFolder } from './AppFolder';
import { WorkspaceAppSelection } from './WorkspaceAppSelection';
import { WorkspaceCollapsedDeliverables } from './WorkspaceCollapsedDeliverables';
import { WorkspaceNoAppsEmptyState } from './WorkspaceNoAppsEmptyState';
import type { UseWorkspaceGenerationViewModelParams } from '../../hooks/use-workspace-generation-view-model';
import { lazyWithReload } from '../../utils/lazy-with-reload';

type WorkspaceSetupPanelsContentComponent =
    (typeof import('./WorkspaceSetupPanelsContent'))['WorkspaceSetupPanelsContent'];

const LazyWorkspaceSetupPanelsContent = lazyWithReload(async () => {
    const module = await import('./WorkspaceSetupPanelsContent');
    return { default: module.WorkspaceSetupPanelsContent };
});

const LazyWorkspaceGenerationSectionContent = lazyWithReload(async () => {
    const module = await import('./WorkspaceGenerationSectionContent');
    return { default: module.WorkspaceGenerationSectionContent };
});

type AppFolderShellProps = Omit<
    ComponentProps<typeof AppFolder>,
    'collapsedAssets' | 'picker' | 'simulator' | 'generation' | 'endSections'
>;

type WorkspaceAppSelectionProps = ComponentProps<typeof WorkspaceAppSelection>;
type WorkspaceSetupPanelsContentProps = ComponentProps<WorkspaceSetupPanelsContentComponent>;
type WorkspaceSetupPanelsProps = WorkspaceSetupPanelsContentProps['panels'];

type WorkspaceFolderPickerProps = Omit<
    WorkspaceAppSelectionProps,
    | 'isReadOnly'
    | 'onBanApp'
    | 'onBlockedAction'
    | 'onCancelAppForm'
    | 'onDeleteApp'
    | 'onEditLockedAction'
    | 'onOpenCreateApp'
    | 'onOpenEditSelectedApp'
    | 'onReorderBrandApps'
    | 'onSelectApp'
    | 'onSubmitAppForm'
    | 'onUnbanApp'
> & {
    isCurrentBrandReadOnly: boolean;
    onBanApp: (appId: string) => void | Promise<void>;
    onCloseAppForm: () => void;
    onDeleteApp: () => void | Promise<void>;
    onOpenAppForm: (app?: AppItem) => void;
    onReadOnlyBlocked: () => void;
    onReorderBrandApps: (sourceId: string, targetId: string) => void | Promise<void>;
    onReportActionError: (message: string) => void;
    onRequestWorkspaceSelection: (appId: string | null) => void;
    onRunWriteAction: (action: () => void | Promise<void>) => Promise<void>;
    onSubmitAppForm: (event: FormEvent) => void;
    onUnbanApp: (appId: string) => void | Promise<void>;
    text: (key: TranslationKey) => string;
};

type WorkspaceFolderSetupProps = Omit<
    WorkspaceSetupPanelsProps,
    | 'generationModuleProps'
    | 'onCreateRepo'
    | 'onDeleteRepo'
    | 'onNotImplementedAutoRelease'
    | 'onOpenAccountsForApp'
    | 'onReportError'
    | 'onSaveCanonicalUrl'
> & {
    canAddApp: boolean;
    onCreateGithubRepo: () => void | Promise<void>;
    onDeleteGithubRepo: () => void | Promise<void>;
    onOpenAccounts: (appId: string | null) => void;
    onOpenCreateApp: () => void;
    onPatchApp: (appId: string, patch: Partial<AppItem>) => Promise<AppItem | null>;
    onReadOnlyBlocked: () => void;
    onReportActionError: (message: string) => void;
    onRunWriteAction: (action: () => void | Promise<void>) => Promise<void>;
    showNoAppsEmptyState: boolean;
};

export type WorkspaceFolderSurfaceProps = {
    collapsedDeliverables: ComponentProps<typeof WorkspaceCollapsedDeliverables>;
    folder: AppFolderShellProps;
    generationViewModel: UseWorkspaceGenerationViewModelParams;
    picker: WorkspaceFolderPickerProps;
    setup: WorkspaceFolderSetupProps;
};

function WorkspaceDeferredFallback({
    label,
    minHeightClassName,
}: {
    label: string;
    minHeightClassName: string;
}) {
    return (
        <div
            className={`rounded-[28px] border border-white/8 bg-slate-950/30 px-5 py-8 text-center shadow-[0_20px_50px_-40px_rgba(15,23,42,0.8)] ${minHeightClassName}`}
        >
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-indigo-300/25 border-t-indigo-300" />
            <p className="mt-3 text-sm font-medium text-indigo-100/80">{label}</p>
        </div>
    );
}

export function WorkspaceFolderSurface({
    collapsedDeliverables,
    folder,
    generationViewModel,
    picker,
    setup,
}: WorkspaceFolderSurfaceProps) {
    const pickerNode = (
        <WorkspaceAppSelection
            appActivePillRef={picker.appActivePillRef}
            appAliasPreview={picker.appAliasPreview}
            appForm={picker.appForm}
            appFormError={picker.appFormError}
            appFormLoading={picker.appFormLoading}
            appFormOpen={picker.appFormOpen}
            aliasPlaceholder={picker.aliasPlaceholder}
            appPillPanHandlers={picker.appPillPanHandlers}
            appPillPanRef={picker.appPillPanRef}
            appPillRowRef={picker.appPillRowRef}
            appPillScrollRef={picker.appPillScrollRef}
            bannedApps={picker.bannedApps}
            canAddApp={picker.canAddApp}
            draggingAppId={picker.draggingAppId}
            dragOverAppId={picker.dragOverAppId}
            editingAppId={picker.editingAppId}
            hasAnyAppsForBrand={picker.hasAnyAppsForBrand}
            isAppPillPanning={picker.isAppPillPanning}
            isAppReorderMode={picker.isAppReorderMode}
            isBannedView={picker.isBannedView}
            isEditingBanned={picker.isEditingBanned}
            isReadOnly={picker.isCurrentBrandReadOnly}
            lockedAppId={picker.lockedAppId}
            onBanApp={(appId) => {
                void picker.onRunWriteAction(() => picker.onBanApp(appId));
            }}
            onBlockedAction={() => picker.onReportActionError(picker.text('generation_in_progress'))}
            onCancelAppForm={picker.onCloseAppForm}
            onDeleteApp={() => {
                void picker.onRunWriteAction(picker.onDeleteApp);
            }}
            onEditLockedAction={() => picker.onReportActionError(picker.text('finish_editing_app_first'))}
            onOpenCreateApp={() => {
                if (picker.isCurrentBrandReadOnly) {
                    picker.onReadOnlyBlocked();
                    return;
                }
                picker.onOpenAppForm();
            }}
            onOpenEditSelectedApp={() => {
                if (!picker.selectedApp) return;
                if (picker.isCurrentBrandReadOnly) {
                    picker.onReadOnlyBlocked();
                    return;
                }
                picker.onOpenAppForm(picker.selectedApp);
            }}
            onReorderBrandApps={(sourceId, targetId) => {
                void picker.onRunWriteAction(() => picker.onReorderBrandApps(sourceId, targetId));
            }}
            onSelectApp={picker.onRequestWorkspaceSelection}
            onSubmitAppForm={(event) => {
                if (picker.isCurrentBrandReadOnly) {
                    event.preventDefault();
                    picker.onReadOnlyBlocked();
                    return;
                }
                picker.onSubmitAppForm(event);
            }}
            onUnbanApp={(appId) => {
                void picker.onRunWriteAction(() => picker.onUnbanApp(appId));
            }}
            selectedApp={picker.selectedApp}
            selectedAppId={picker.selectedAppId}
            selectedBrandName={picker.selectedBrandName}
            selectedBrandSlug={picker.selectedBrandSlug}
            setAppForm={picker.setAppForm}
            setDraggingAppId={picker.setDraggingAppId}
            setDragOverAppId={picker.setDragOverAppId}
            setIsBannedView={picker.setIsBannedView}
            showBannedToggle={picker.showBannedToggle}
            showNoAppsEmptyState={picker.showNoAppsEmptyState}
            tabButtonHeight={picker.tabButtonHeight}
            tabButtonWidth={picker.tabButtonWidth}
            text={picker.text}
            visibleActiveApps={picker.visibleActiveApps}
            visibleApps={picker.visibleApps}
        />
    );

    const setupNode = setup.showNoAppsEmptyState ? (
        <WorkspaceNoAppsEmptyState
            canAddApp={setup.canAddApp}
            isReadOnly={setup.isCurrentBrandReadOnly}
            onOpenCreateApp={setup.onOpenCreateApp}
            onReadOnlyBlocked={setup.onReadOnlyBlocked}
            text={setup.text}
        />
    ) : (
        <Suspense
            fallback={
                <WorkspaceDeferredFallback
                    label={setup.text('loading')}
                    minHeightClassName="min-h-[320px]"
                />
            }
        >
            <LazyWorkspaceSetupPanelsContent
                generationViewModel={generationViewModel}
                panels={{
                    appIdeaAssignments: setup.appIdeaAssignments,
                    appIdeaCategories: setup.appIdeaCategories,
                    appIdeas: setup.appIdeas,
                    appStoreReviewHydrationSnapshot: setup.appStoreReviewHydrationSnapshot,
                    connectorEnabled: setup.connectorEnabled,
                    connectorForm: setup.connectorForm,
                    connectorRunnerJobs: setup.connectorRunnerJobs,
                    githubRepoUrl: setup.githubRepoUrl,
                    githubStepDone: setup.githubStepDone,
                    iconStepNumber: setup.iconStepNumber,
                    ideaStepNumber: setup.ideaStepNumber,
                    integrationReady: setup.integrationReady,
                    isCreatingGithubRepo: setup.isCreatingGithubRepo,
                    isCurrentBrandReadOnly: setup.isCurrentBrandReadOnly,
                    isDeletingGithubRepo: setup.isDeletingGithubRepo,
                    isNoBrandMode: setup.isNoBrandMode,
                    onAppStoreLinkGuardChange: setup.onAppStoreLinkGuardChange,
                    onAppStoreReviewGuardChange: setup.onAppStoreReviewGuardChange,
                    onAppStoreReviewSnapshotChange: setup.onAppStoreReviewSnapshotChange,
                    selectedApp: setup.selectedApp,
                    selectedAppstoreAccount: setup.selectedAppstoreAccount,
                    selectedBrand: setup.selectedBrand,
                    session: setup.session,
                    setupStepDone: setup.setupStepDone,
                    showManualCopyAction: setup.showManualCopyAction,
                    step1Done: setup.step1Done,
                    step2Done: setup.step2Done,
                    step5Done: setup.step5Done,
                    step6Done: setup.step6Done,
                    step7Done: setup.step7Done,
                    onCreateRepo: () => {
                        void setup.onRunWriteAction(setup.onCreateGithubRepo);
                    },
                    onDeleteRepo: () => {
                        void setup.onRunWriteAction(setup.onDeleteGithubRepo);
                    },
                    onNotImplementedAutoRelease: () => setup.onReportActionError(setup.text('coming_soon')),
                    onOpenAccountsForApp: () => setup.onOpenAccounts(setup.selectedApp?.id || null),
                    onOpenIdeas: setup.onOpenIdeas,
                    onPatchApp: setup.onPatchApp,
                    onPickAccount: setup.onPickAccount,
                    onRefreshIntegrationJobs: setup.onRefreshIntegrationJobs,
                    onReportError: setup.onReportActionError,
                    onSaveCanonicalUrl: async (canonicalUrl) => {
                        if (!setup.selectedApp) return;
                        if (setup.isCurrentBrandReadOnly) {
                            setup.onReadOnlyBlocked();
                            return;
                        }
                        const next = await setup.onPatchApp(setup.selectedApp.id, { appstore_url: canonicalUrl });
                        if (!next) {
                            throw new Error(setup.text('upload_failed'));
                        }
                    },
                    pickedIcon: setup.pickedIcon,
                    text: setup.text,
                    allAccounts: setup.allAccounts,
                }}
            />
        </Suspense>
    );

    const generationNode = setup.showNoAppsEmptyState ? null : (
        <Suspense
            fallback={
                <WorkspaceDeferredFallback
                    label={generationViewModel.text('loading')}
                    minHeightClassName="min-h-[420px]"
                />
            }
        >
            <LazyWorkspaceGenerationSectionContent
                section="generation"
                viewModel={generationViewModel}
            />
        </Suspense>
    );

    const endSectionsNode = setup.showNoAppsEmptyState ? null : (
        <Suspense fallback={null}>
            <LazyWorkspaceGenerationSectionContent
                section="endSections"
                viewModel={generationViewModel}
            />
        </Suspense>
    );

    return (
        <AppFolder
            appFolderLayout={folder.appFolderLayout}
            appFolderTheme={folder.appFolderTheme}
            bodyCornerRadius={folder.bodyCornerRadius}
            isTabMotionDisabled={folder.isTabMotionDisabled}
            appSwitching={folder.appSwitching}
            isFirstApp={folder.isFirstApp}
            gooeyDebug={folder.gooeyDebug}
            appFolderWrapRef={folder.appFolderWrapRef}
            appFolderContentRef={folder.appFolderContentRef}
            appFolderEndRef={folder.appFolderEndRef}
            appPickerRef={folder.appPickerRef}
            appSimulatorRef={folder.appSimulatorRef}
            appGenerationRef={folder.appGenerationRef}
            isAssetsCollapsed={folder.isAssetsCollapsed}
            collapsedAssets={<WorkspaceCollapsedDeliverables {...collapsedDeliverables} />}
            picker={pickerNode}
            simulator={setupNode}
            generation={generationNode}
            endSections={endSectionsNode}
        />
    );
}
