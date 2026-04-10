import { useMemo } from 'react';
import type { ConnectorJob } from '../data/connector-jobs';
import type { ConnectorSecretMeta } from '../data/connector-secrets';
import type { AppExportStatus, AppItem, AppScreenshot, AppstoreAccount, BrandReference } from '../types/zefgen';
import type { ConnectorLegalLinksState } from './use-connector-config-form';
import {
    findLatestSuccessfulIntegrationForBranch,
    getIntegrationReadiness,
    hasSuccessfulGenerateJob,
} from '../utils/connector-runner-state.js';

const MAIN_BRANCH = 'main';

type Params = {
    brandScreenshotReferences: BrandReference[];
    connectorEnabled: boolean;
    enhancedScreenshotSlots: unknown[];
    exportStatus: AppExportStatus | null;
    generatedScreenshotSlots: unknown[];
    githubRepoUrl: string | null;
    isNoBrandMode: boolean;
    pickedIconAssetId: string | null;
    projectBrief: string;
    promptsByRefId: Record<string, string>;
    secretMetas: ConnectorSecretMeta[];
    selectedApp: AppItem | null;
    selectedAppScreenshots: AppScreenshot[];
    selectedAppstoreAccount: AppstoreAccount | null;
    simulatorRequiredSlotCount: number;
    slotPromptBySlotIndex: Record<number, string>;
    targetSlotCount: number;
    legalLinks: ConnectorLegalLinksState;
    variables: Record<string, any>;
    connectorRunnerJobs: ConnectorJob[];
};

const toRepoFullNameFromUrl = (url: string | null | undefined) => {
    let value = String(url || '').trim();
    if (!value) return '';
    value = value.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/\/+$/g, '');
    const match = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
    if (!match) return '';
    return `${match[1]}/${match[2]}`;
};

export function useWorkspaceStepReadiness({
    brandScreenshotReferences,
    connectorEnabled,
    enhancedScreenshotSlots,
    exportStatus,
    generatedScreenshotSlots,
    githubRepoUrl,
    isNoBrandMode,
    pickedIconAssetId,
    projectBrief,
    promptsByRefId,
    secretMetas,
    selectedApp,
    selectedAppScreenshots,
    selectedAppstoreAccount,
    simulatorRequiredSlotCount,
    slotPromptBySlotIndex,
    targetSlotCount,
    legalLinks,
    variables,
    connectorRunnerJobs,
}: Params) {
    const step1Done = connectorEnabled && Boolean(pickedIconAssetId);
    const step2Done = connectorEnabled && String(projectBrief || '').trim().length > 0;

    const githubStepDone = useMemo(() => {
        if (!connectorEnabled) return false;
        const direct = String(selectedApp?.github_repo_full_name || '').trim();
        if (direct) return true;

        const fromRowUrl = toRepoFullNameFromUrl(selectedApp?.github_repo_url);
        if (fromRowUrl) return true;

        const fromStateUrl = toRepoFullNameFromUrl(githubRepoUrl);
        if (fromStateUrl) return true;

        return false;
    }, [connectorEnabled, githubRepoUrl, selectedApp]);

    const setupCompanyName = String(selectedAppstoreAccount?.company_name || '').trim();
    const setupStepDone =
        connectorEnabled &&
        String((variables as any)?.bundle_id || '').trim().length > 0 &&
        setupCompanyName.length > 0 &&
        String((variables as any)?.home_screen_name || '').trim().length > 0;

    const step5Done = useMemo(
        () => connectorEnabled && hasSuccessfulGenerateJob(connectorRunnerJobs),
        [connectorEnabled, connectorRunnerJobs]
    );

    const integrationReady = useMemo(() => {
        if (!connectorEnabled) return false;
        return getIntegrationReadiness({
            variables,
            legalLinks,
            secretMetas,
        });
    }, [connectorEnabled, legalLinks, secretMetas, variables]);

    const latestSuccessfulIntegrationForBranch = useMemo(
        () => findLatestSuccessfulIntegrationForBranch(connectorRunnerJobs, MAIN_BRANCH),
        [connectorRunnerJobs]
    );

    const step6Done = connectorEnabled && Boolean(latestSuccessfulIntegrationForBranch);
    const step7Done = step6Done;
    const step8Done =
        connectorEnabled && targetSlotCount > 0 && selectedAppScreenshots.length >= simulatorRequiredSlotCount;

    const step9HasPrompt = useMemo(() => {
        if (!connectorEnabled) return false;
        const hasSlotPrompt = Object.values(slotPromptBySlotIndex || {}).some(
            (value) => String(value || '').trim().length > 0
        );
        if (isNoBrandMode) {
            return hasSlotPrompt;
        }
        return hasSlotPrompt || brandScreenshotReferences.some((ref) => String(promptsByRefId?.[ref.id] || '').trim().length > 0);
    }, [brandScreenshotReferences, connectorEnabled, isNoBrandMode, promptsByRefId, slotPromptBySlotIndex]);

    const step9HasAnyGenerated =
        connectorEnabled && (generatedScreenshotSlots.length > 0 || enhancedScreenshotSlots.length > 0);
    const step9Done = step9HasPrompt || step9HasAnyGenerated;
    const step10Done = connectorEnabled && Boolean(exportStatus?.is_completed);
    const iconStepNumber = isNoBrandMode ? 2 : 1;
    const ideaStepNumber = isNoBrandMode ? 1 : 2;

    return {
        githubStepDone,
        iconStepNumber,
        ideaStepNumber,
        integrationReady,
        latestSuccessfulIntegrationForBranch,
        setupStepDone,
        step1Done,
        step2Done,
        step5Done,
        step6Done,
        step7Done,
        step8Done,
        step9Done,
        step10Done,
    };
}
