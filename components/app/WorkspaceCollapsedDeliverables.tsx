import React from 'react';
import type { TranslationKey } from '../../i18n';
import type { AppItem, AppScreenshotSet, GeneratedAsset } from '../../types/zefgen';
import { DeliverablesPanel } from './DeliverablesPanel';

type WorkspaceCollapsedDeliverablesProps = {
    isCompleted: boolean;
    onDownloadIcon: () => void;
    onDownloadSimulatorScreenshotsZip?: () => void;
    onDownloadSetZip: (setId: string) => void;
    onShowWorkspace: () => void;
    pickedIconAsset: GeneratedAsset | null;
    pickedIconPreviewUrl: string | null;
    screenshotSets: AppScreenshotSet[];
    simulatorScreenshotCount: number;
    selectedApp: AppItem | null;
    text: (key: TranslationKey) => string;
};

export function WorkspaceCollapsedDeliverables({
    isCompleted,
    onDownloadIcon,
    onDownloadSimulatorScreenshotsZip,
    onDownloadSetZip,
    onShowWorkspace,
    pickedIconAsset,
    pickedIconPreviewUrl,
    screenshotSets,
    simulatorScreenshotCount,
    selectedApp,
    text,
}: WorkspaceCollapsedDeliverablesProps) {
    return (
        <DeliverablesPanel
            isCompleted={isCompleted}
            pickedIconAsset={pickedIconAsset}
            pickedIconPreviewUrl={pickedIconPreviewUrl}
            screenshotSets={screenshotSets}
            simulatorScreenshotCount={simulatorScreenshotCount}
            onDownloadIcon={() => {
                if (!pickedIconAsset || !selectedApp) return;
                onDownloadIcon();
            }}
            onDownloadSimulatorScreenshotsZip={onDownloadSimulatorScreenshotsZip}
            onDownloadSetZip={onDownloadSetZip}
            onShowWorkspace={onShowWorkspace}
            text={text}
        />
    );
}
