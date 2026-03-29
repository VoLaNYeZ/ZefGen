import React from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TranslationKey } from '../../i18n';
import type { ConnectorJob } from '../../data/connector-jobs';
import { useConnectorConfigForm } from '../../hooks/use-connector-config-form';
import type {
    AppIdea,
    AppIdeaCategory,
    AppItem,
    AppstoreAccount,
    Brand,
    IdeaAppAssignment,
} from '../../types/zefgen';
import { buildManualIntegrationCopyText } from '../../utils/manual-integration-copy';
import { AppStoreLinkRow } from './AppStoreLinkRow';
import { AppStoreReviewWebhookRow } from './AppStoreReviewWebhookRow';
import { AutoReleaseModulePanel } from './AutoReleaseModulePanel';
import { ConnectorClientSpecPanel } from './ConnectorClientSpecPanel';
import { ConnectorRunnerPanel } from './ConnectorRunnerPanel';
import { ConnectorVariablesSecretsPanel } from './ConnectorVariablesSecretsPanel';
import { DevFilesPanel } from './DevFilesPanel';
import { IconGenerationModule } from './AppGenerationSection';
import { IntegrationModulePanel } from './IntegrationModulePanel';
import { StepBlock } from './StepBlock';

type WorkspaceSetupPanelsProps = {
    appIdeaAssignments: IdeaAppAssignment[];
    appIdeaCategories: AppIdeaCategory[];
    appIdeas: AppIdea[];
    brands: Brand[];
    appStoreReviewHydrationSnapshot: React.ComponentProps<typeof AppStoreReviewWebhookRow>['hydrationSnapshot'];
    connectorEnabled: boolean;
    connectorForm: ReturnType<typeof useConnectorConfigForm>;
    connectorRunnerJobs: ConnectorJob[];
    generationModuleProps: React.ComponentProps<typeof IconGenerationModule>;
    githubRepoUrl?: string | null;
    githubStepDone: boolean;
    iconStepNumber: number;
    ideaStepNumber: number;
    integrationReady: boolean;
    isCreatingGithubRepo: boolean;
    isCurrentBrandReadOnly: boolean;
    isDeletingGithubRepo: boolean;
    isNoBrandMode: boolean;
    onAppStoreLinkGuardChange: React.ComponentProps<typeof AppStoreLinkRow>['onSwitchGuardChange'];
    onAppStoreReviewGuardChange: React.ComponentProps<typeof AppStoreReviewWebhookRow>['onSwitchGuardChange'];
    onAppStoreReviewSnapshotChange: React.ComponentProps<typeof AppStoreReviewWebhookRow>['onSnapshotChange'];
    onCreateRepo: () => void;
    onDeleteRepo: () => void;
    onNotImplementedAutoRelease: () => void;
    onOpenAccountsForApp: () => void;
    onOpenIdeas: () => void;
    onPatchApp: (appId: string, patch: Partial<AppItem>) => Promise<AppItem | null>;
    onPickAccount: (modeOrId: null | string) => Promise<void>;
    onRefreshIntegrationJobs?: () => Promise<void>;
    onReportError: (msg: string) => void;
    onSaveCanonicalUrl: (canonicalUrl: string) => Promise<void>;
    pickedIcon: boolean;
    selectedApp: AppItem | null;
    selectedAppstoreAccount: AppstoreAccount | null;
    selectedBrand: Brand | null;
    session: Session | null;
    setupStepDone: boolean;
    showManualCopyAction: boolean;
    step1Done: boolean;
    step2Done: boolean;
    step5Done: boolean;
    step6Done: boolean;
    step7Done: boolean;
    text: (key: TranslationKey) => string;
    allAccounts: AppstoreAccount[];
};

export function WorkspaceSetupPanels({
    appIdeaAssignments,
    appIdeaCategories,
    appIdeas,
    brands,
    appStoreReviewHydrationSnapshot,
    connectorEnabled,
    connectorForm,
    connectorRunnerJobs,
    generationModuleProps,
    githubRepoUrl,
    githubStepDone,
    iconStepNumber,
    ideaStepNumber,
    integrationReady,
    isCreatingGithubRepo,
    isCurrentBrandReadOnly,
    isDeletingGithubRepo,
    isNoBrandMode,
    onAppStoreLinkGuardChange,
    onAppStoreReviewGuardChange,
    onAppStoreReviewSnapshotChange,
    onCreateRepo,
    onDeleteRepo,
    onNotImplementedAutoRelease,
    onOpenAccountsForApp,
    onOpenIdeas,
    onPatchApp,
    onPickAccount,
    onRefreshIntegrationJobs,
    onReportError,
    onSaveCanonicalUrl,
    pickedIcon,
    selectedApp,
    selectedAppstoreAccount,
    selectedBrand,
    session,
    setupStepDone,
    showManualCopyAction,
    step1Done,
    step2Done,
    step5Done,
    step6Done,
    step7Done,
    text,
    allAccounts,
}: WorkspaceSetupPanelsProps) {
    const clientSpecPanel = (
        <div data-testid="workspace-panel-client-spec">
            <ConnectorClientSpecPanel
                connectorForm={connectorForm}
                isEnabled={connectorEnabled && !isCurrentBrandReadOnly}
                ideas={appIdeas}
                ideaCategories={appIdeaCategories}
                ideaAssignments={appIdeaAssignments}
                selectedAppId={selectedApp?.id || null}
                selectedBrandId={selectedBrand?.id || null}
                brands={brands}
                onPatchApp={onPatchApp}
                onOpenIdeas={onOpenIdeas}
                reportError={onReportError}
                text={text}
            />
        </div>
    );

    const manualCopyText = React.useMemo(
        () =>
            buildManualIntegrationCopyText({
                selectedApp,
                variables: connectorForm.variables,
            }),
        [connectorForm.variables, selectedApp]
    );

    return (
        <div className="space-y-0">
            {selectedApp ? (
                <>
                    <div data-testid="workspace-panel-appstore-link">
                        <AppStoreLinkRow
                            selectedApp={selectedApp}
                            targetCountries={isNoBrandMode ? [] : (selectedBrand?.target_countries || [])}
                            onSaveCanonicalUrl={onSaveCanonicalUrl}
                            text={text}
                            reportError={onReportError}
                            isReadOnly={isCurrentBrandReadOnly}
                            onSwitchGuardChange={onAppStoreLinkGuardChange}
                        />
                    </div>
                    <div data-testid="workspace-panel-app-review-webhook" className="mt-4">
                        <AppStoreReviewWebhookRow
                            selectedApp={selectedApp}
                            session={session}
                            text={text}
                            reportError={onReportError}
                            isReadOnly={isCurrentBrandReadOnly}
                            hydrationSnapshot={appStoreReviewHydrationSnapshot}
                            onSwitchGuardChange={onAppStoreReviewGuardChange}
                            onSnapshotChange={onAppStoreReviewSnapshotChange}
                        />
                    </div>
                    <div className="my-4 h-px bg-indigo-900/30" aria-hidden="true" />
                </>
            ) : null}

            {isNoBrandMode ? (
                <StepBlock step={ideaStepNumber} done={step2Done}>
                    {clientSpecPanel}
                </StepBlock>
            ) : null}

            <StepBlock step={iconStepNumber} done={step1Done}>
                <div data-testid="workspace-panel-icon">
                    <IconGenerationModule {...generationModuleProps} />
                </div>
            </StepBlock>

            {!isNoBrandMode ? (
                <StepBlock step={ideaStepNumber} done={step2Done}>
                    {clientSpecPanel}
                </StepBlock>
            ) : null}

            <StepBlock step={3} done={setupStepDone}>
                <div data-testid="workspace-panel-variables-secrets">
                    <ConnectorVariablesSecretsPanel
                        connectorForm={connectorForm}
                        isEnabled={connectorEnabled}
                        isReadOnly={isCurrentBrandReadOnly}
                        selectedApp={selectedApp}
                        account={selectedAppstoreAccount}
                        allAccounts={allAccounts}
                        onPickAccount={onPickAccount}
                        onOpenAccountsForApp={onOpenAccountsForApp}
                        text={text}
                    />
                </div>
            </StepBlock>

            <StepBlock step={4} done={githubStepDone}>
                <div data-testid="workspace-panel-dev-files">
                    <DevFilesPanel
                        selectedApp={selectedApp}
                        githubRepoUrl={githubRepoUrl}
                        isCreatingRepo={isCreatingGithubRepo}
                        isDeletingRepo={isDeletingGithubRepo}
                        onCreateRepo={onCreateRepo}
                        onDeleteRepo={onDeleteRepo}
                        text={text}
                        isReadOnly={isCurrentBrandReadOnly}
                    />
                </div>
            </StepBlock>

            <StepBlock step={5} done={step5Done}>
                <div data-testid="workspace-panel-runner">
                    <ConnectorRunnerPanel
                        session={session}
                        selectedApp={selectedApp}
                        githubRepoUrl={githubRepoUrl}
                        connectorForm={connectorForm}
                        pickedIcon={pickedIcon}
                        text={text}
                        reportError={onReportError}
                        isReadOnly={isCurrentBrandReadOnly}
                    />
                </div>
            </StepBlock>

            <StepBlock step={6} done={step6Done}>
                <div data-testid="workspace-panel-integration">
                    <IntegrationModulePanel
                        session={session}
                        selectedApp={selectedApp}
                        githubRepoUrl={githubRepoUrl}
                        connectorForm={connectorForm}
                        connectorJobs={connectorRunnerJobs}
                        isEnabled={connectorEnabled}
                        text={text}
                        refreshJobs={onRefreshIntegrationJobs}
                        reportError={onReportError}
                        isReadOnly={isCurrentBrandReadOnly}
                    />
                </div>
            </StepBlock>

            <StepBlock step={7} done={step7Done} isLast>
                <div data-testid="workspace-panel-auto-release">
                    <AutoReleaseModulePanel
                        isEnabled={connectorEnabled}
                        integrationReady={integrationReady}
                        manualCopyText={manualCopyText}
                        onNotImplemented={onNotImplementedAutoRelease}
                        showManualCopyAction={showManualCopyAction}
                        text={text}
                    />
                </div>
            </StepBlock>
        </div>
    );
}
