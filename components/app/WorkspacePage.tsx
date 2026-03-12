import React from 'react';
import type { TranslationKey } from '../../i18n';
import type { Brand, BrandReference } from '../../types/zefgen';
import { MAX_SCREENSHOT_REFS } from '../../constants/zefgen';
import { BrandReleaseInfoPanel } from './BrandReleaseInfoPanel';
import { BrandReferencesPanel } from './BrandReferencesPanel';
import { WorkspaceFolderSurface, type WorkspaceFolderSurfaceProps } from './WorkspaceFolderSurface';
import { WorkspaceSwitchOverlay } from './WorkspaceSwitchOverlay';

type WorkspacePageProps = {
    brandRefUrls: Record<string, string>;
    brandScreenshotReferences: BrandReference[];
    brandScreenshotsUploading: boolean;
    handleBrandReferenceDragLeave: () => void;
    handleBrandReferenceDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    handleBrandReferenceDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    handleBrandScreenshotUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteBrandReference: (ref: BrandReference) => void;
    handleReorderBrandReference: (fromIndex: number, toIndex: number) => void;
    isBrandRefDropActive: boolean;
    isCurrentBrandReadOnly: boolean;
    isNoBrandMode: boolean;
    loadingLabel: string;
    onBrandReleaseInfoGuardChange: React.ComponentProps<typeof BrandReleaseInfoPanel>['onSwitchGuardChange'];
    onPatchBrand: (brandId: string, patch: Partial<Brand>) => Promise<void>;
    onReadOnlyBlocked: () => void;
    onReportError: (message: string) => void;
    onRunWriteAction: (action: () => void | Promise<void>) => Promise<void>;
    openLightbox: React.ComponentProps<typeof BrandReferencesPanel>['openLightbox'];
    selectedBrand: Brand;
    showWorkspaceSwitchOverlay: boolean;
    text: (key: TranslationKey) => string;
    workspaceFolder: WorkspaceFolderSurfaceProps;
    workspaceSwitchLabel: string;
    workspaceSwitchStage: React.ComponentProps<typeof WorkspaceSwitchOverlay>['stage'];
    workspaceSwitchShowLoader: boolean;
};

export function WorkspacePage({
    brandRefUrls,
    brandScreenshotReferences,
    brandScreenshotsUploading,
    handleBrandReferenceDragLeave,
    handleBrandReferenceDragOver,
    handleBrandReferenceDrop,
    handleBrandScreenshotUpload,
    handleDeleteBrandReference,
    handleReorderBrandReference,
    isBrandRefDropActive,
    isCurrentBrandReadOnly,
    isNoBrandMode,
    loadingLabel,
    onBrandReleaseInfoGuardChange,
    onPatchBrand,
    onReadOnlyBlocked,
    onReportError,
    onRunWriteAction,
    openLightbox,
    selectedBrand,
    showWorkspaceSwitchOverlay,
    text,
    workspaceFolder,
    workspaceSwitchLabel,
    workspaceSwitchShowLoader,
    workspaceSwitchStage,
}: WorkspacePageProps) {
    return (
        <>
            <div data-testid="workspace-page-root" className="relative">
                <div className="space-y-6">
                    {!isNoBrandMode ? (
                        <>
                            <BrandReleaseInfoPanel
                                selectedBrand={selectedBrand}
                                patchBrand={async (brandId, patch) => {
                                    if (isCurrentBrandReadOnly) {
                                        onReadOnlyBlocked();
                                        return;
                                    }
                                    await onPatchBrand(brandId, patch);
                                }}
                                reportError={onReportError}
                                text={text}
                                isReadOnly={isCurrentBrandReadOnly}
                                onSwitchGuardChange={onBrandReleaseInfoGuardChange}
                            />
                            <BrandReferencesPanel
                                brandId={selectedBrand.id}
                                brandScreenshotReferences={brandScreenshotReferences}
                                brandRefUrls={brandRefUrls}
                                handleReorderBrandReference={(fromIndex, toIndex) => {
                                    void onRunWriteAction(() => handleReorderBrandReference(fromIndex, toIndex));
                                }}
                                handleDeleteBrandReference={(ref) => {
                                    void onRunWriteAction(() => handleDeleteBrandReference(ref));
                                }}
                                handleBrandReferenceDragOver={handleBrandReferenceDragOver}
                                handleBrandReferenceDragLeave={handleBrandReferenceDragLeave}
                                handleBrandReferenceDrop={(event) => {
                                    void onRunWriteAction(() => handleBrandReferenceDrop(event));
                                }}
                                handleBrandScreenshotUpload={(event) => {
                                    void onRunWriteAction(() => handleBrandScreenshotUpload(event));
                                }}
                                isBrandRefDropActive={isBrandRefDropActive}
                                brandScreenshotsUploading={brandScreenshotsUploading}
                                maxScreenshotRefs={MAX_SCREENSHOT_REFS}
                                openLightbox={openLightbox}
                                text={text}
                                isReadOnly={isCurrentBrandReadOnly}
                            />
                        </>
                    ) : null}

                    <div className="space-y-6">
                        <WorkspaceFolderSurface {...workspaceFolder} />
                    </div>
                </div>
                <WorkspaceSwitchOverlay
                    isVisible={showWorkspaceSwitchOverlay}
                    showLoader={workspaceSwitchShowLoader}
                    stage={workspaceSwitchStage}
                    label={workspaceSwitchLabel}
                    loadingLabel={loadingLabel}
                />
            </div>
        </>
    );
}
