import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { AppItem, Brand } from '../types/zefgen';
import type { AppStoreReviewPanelSnapshot } from '../types/appstore-review-panel-snapshot';
import {
    getConnectorExecutionPanelSnapshotSignature,
    type ConnectorExecutionPanelSnapshot,
} from '../types/connector-execution-snapshot';
import type { AppScreenshotPromptsSnapshot } from './use-app-screenshot-prompts';
import type { ConnectorConfigFormSnapshot } from './use-connector-config-form';
import type { GeneratedAssetsAppSnapshot } from './use-generated-assets';
import type { AppWorkspaceSnapshot } from '../types/workspace-snapshot';

type Params = {
    workspaceSnapshotsRef: MutableRefObject<Record<string, AppWorkspaceSnapshot>>;
    selectedBrand: Brand | null;
    selectedApp: AppItem | null;
    connectorLoading: boolean;
    buildConnectorFormSnapshot: (appId: string) => ConnectorConfigFormSnapshot;
    buildMetadataSnapshot: () => GeneratedAssetsAppSnapshot | null;
    buildAppScreenshotPromptsSnapshot: () => AppScreenshotPromptsSnapshot | null;
};

export function useWorkspaceSnapshotCache({
    workspaceSnapshotsRef,
    selectedBrand,
    selectedApp,
    connectorLoading,
    buildConnectorFormSnapshot,
    buildMetadataSnapshot,
    buildAppScreenshotPromptsSnapshot,
}: Params) {
    useEffect(() => {
        if (!selectedBrand?.id || !selectedApp?.id) return;
        if (connectorLoading) return;

        const currentSnapshot = workspaceSnapshotsRef.current[selectedApp.id] ?? null;
        const connectorSnapshot = buildConnectorFormSnapshot(selectedApp.id);
        const generatedSnapshot = buildMetadataSnapshot() ?? currentSnapshot?.generatedAssets ?? null;
        const promptsSnapshot = buildAppScreenshotPromptsSnapshot() ?? currentSnapshot?.screenshotPrompts ?? null;
        if (!generatedSnapshot || !promptsSnapshot) {
            if (!currentSnapshot) return;
            workspaceSnapshotsRef.current[selectedApp.id] = {
                ...currentSnapshot,
                brandId: selectedBrand.id,
                connectorForm: connectorSnapshot,
            };
            return;
        }

        workspaceSnapshotsRef.current[selectedApp.id] = {
            appId: selectedApp.id,
            brandId: selectedBrand.id,
            connectorForm: connectorSnapshot,
            generatedAssets: generatedSnapshot,
            screenshotPrompts: promptsSnapshot,
            appStoreReviewPanel: currentSnapshot?.appStoreReviewPanel ?? null,
            connectorExecution: currentSnapshot?.connectorExecution ?? null,
        };
    }, [
        buildAppScreenshotPromptsSnapshot,
        buildConnectorFormSnapshot,
        buildMetadataSnapshot,
        connectorLoading,
        selectedApp?.id,
        selectedBrand?.id,
        workspaceSnapshotsRef,
    ]);

    const handleAppStoreReviewSnapshotChange = useCallback(
        (snapshot: AppStoreReviewPanelSnapshot | null) => {
            if (!selectedBrand?.id || !selectedApp?.id || !snapshot || snapshot.appId !== selectedApp.id) return;

            const currentSnapshot = workspaceSnapshotsRef.current[selectedApp.id];
            const connectorSnapshot = buildConnectorFormSnapshot(selectedApp.id);
            const generatedSnapshot = buildMetadataSnapshot();
            const promptsSnapshot = buildAppScreenshotPromptsSnapshot();

            if (currentSnapshot) {
            workspaceSnapshotsRef.current[selectedApp.id] = {
                ...currentSnapshot,
                appStoreReviewPanel: snapshot,
            };
            return;
            }

            if (!generatedSnapshot || !promptsSnapshot) return;

            workspaceSnapshotsRef.current[selectedApp.id] = {
                appId: selectedApp.id,
                brandId: selectedBrand.id,
                connectorForm: connectorSnapshot,
                generatedAssets: generatedSnapshot,
                screenshotPrompts: promptsSnapshot,
                appStoreReviewPanel: snapshot,
                connectorExecution: null,
            };
        },
        [
            buildAppScreenshotPromptsSnapshot,
            buildConnectorFormSnapshot,
            buildMetadataSnapshot,
            selectedApp?.id,
            selectedBrand?.id,
            workspaceSnapshotsRef,
        ]
    );

    const handleConnectorExecutionSnapshotChange = useCallback(
        (snapshot: ConnectorExecutionPanelSnapshot | null) => {
            if (!selectedBrand?.id || !selectedApp?.id || !snapshot || snapshot.appId !== selectedApp.id) return;

            const currentSnapshot = workspaceSnapshotsRef.current[selectedApp.id];
            const connectorSnapshot = buildConnectorFormSnapshot(selectedApp.id);
            const generatedSnapshot = buildMetadataSnapshot();
            const promptsSnapshot = buildAppScreenshotPromptsSnapshot();
            const nextSignature = getConnectorExecutionPanelSnapshotSignature(snapshot);

            if (currentSnapshot) {
                const currentSignature = getConnectorExecutionPanelSnapshotSignature(
                    currentSnapshot.connectorExecution ?? null
                );
                if (currentSignature === nextSignature) return;
                workspaceSnapshotsRef.current[selectedApp.id] = {
                    ...currentSnapshot,
                    connectorExecution: snapshot,
                };
                return;
            }

            if (!generatedSnapshot || !promptsSnapshot) return;

            workspaceSnapshotsRef.current[selectedApp.id] = {
                appId: selectedApp.id,
                brandId: selectedBrand.id,
                connectorForm: connectorSnapshot,
                generatedAssets: generatedSnapshot,
                screenshotPrompts: promptsSnapshot,
                appStoreReviewPanel: null,
                connectorExecution: snapshot,
            };
        },
        [
            buildAppScreenshotPromptsSnapshot,
            buildConnectorFormSnapshot,
            buildMetadataSnapshot,
            selectedApp?.id,
            selectedBrand?.id,
            workspaceSnapshotsRef,
        ]
    );

    return {
        handleAppStoreReviewSnapshotChange,
        handleConnectorExecutionSnapshotChange,
    };
}
