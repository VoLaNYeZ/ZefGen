import type { AppStoreReviewPanelSnapshot } from './appstore-review-panel-snapshot';
import type { AppScreenshotPromptsSnapshot } from '../hooks/use-app-screenshot-prompts';
import type { ConnectorConfigFormSnapshot } from '../hooks/use-connector-config-form';
import type { GeneratedAssetsAppSnapshot } from '../hooks/use-generated-assets';

export type AppWorkspaceSnapshot = {
    appId: string;
    brandId: string;
    connectorForm: ConnectorConfigFormSnapshot;
    generatedAssets: GeneratedAssetsAppSnapshot;
    screenshotPrompts: AppScreenshotPromptsSnapshot;
    appStoreReviewPanel: AppStoreReviewPanelSnapshot | null;
};
