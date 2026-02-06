import React from 'react';
import GooeySvgFilter from '../fancy/filter/GooeySvgFilter';
import type { AppFolderLayout } from '../../hooks/use-app-folder-layout';

type AppFolderProps = {
    appFolderLayout: AppFolderLayout;
    appFolderTheme: string;
    bodyCornerRadius: string;
    isTabMotionDisabled: boolean;
    appSwitching: boolean;
    isFirstApp: boolean;
    gooeyDebug: boolean;
    appFolderWrapRef: React.RefObject<HTMLDivElement>;
    appFolderContentRef: React.RefObject<HTMLDivElement>;
    appFolderEndRef: React.RefObject<HTMLDivElement>;
    appPickerRef: React.RefObject<HTMLElement>;
    appSimulatorRef: React.RefObject<HTMLElement>;
    appGenerationRef: React.RefObject<HTMLElement>;
    picker: React.ReactNode;
    simulator: React.ReactNode;
    generation: React.ReactNode;
    endSections: React.ReactNode;
};

export const AppFolder = ({
    appFolderLayout,
    appFolderTheme,
    bodyCornerRadius,
    isTabMotionDisabled,
    appSwitching,
    isFirstApp,
    gooeyDebug,
    appFolderWrapRef,
    appFolderContentRef,
    appFolderEndRef,
    appPickerRef,
    appSimulatorRef,
    appGenerationRef,
    picker,
    simulator,
    generation,
    endSections,
}: AppFolderProps) => {
    return (
        <div ref={appFolderWrapRef} className="relative mt-[5px]">
            <GooeySvgFilter id="app-gooey-filter" strength={6} />
            <div
                className="app-folder-layer"
                style={{
                    filter: gooeyDebug ? 'none' : 'url(#app-gooey-filter)',
                    opacity: appFolderLayout.bodyHeight ? 1 : 0,
                }}
                aria-hidden="true"
            >
                <div className="app-folder-curtain" style={{ clipPath: appFolderLayout.clipPath }}>
                    <div
                        className={`app-folder-body ${gooeyDebug ? 'gooey-debug-outline' : ''} ${isTabMotionDisabled ? 'is-static' : ''}`}
                        style={{
                            top: appFolderLayout.bodyTop,
                            height: appFolderLayout.bodyHeight,
                            background: appFolderTheme,
                            borderRadius: bodyCornerRadius,
                        }}
                    />
                    <div
                        className={`app-folder-tab ${appSwitching ? 'is-active' : ''} ${isFirstApp ? 'is-left' : ''} ${gooeyDebug ? 'gooey-debug-outline tab' : ''} ${isTabMotionDisabled ? 'is-static' : ''}`}
                        style={{
                            top: appFolderLayout.tabTop,
                            left: appFolderLayout.tabLeft,
                            width: appFolderLayout.tabWidth,
                            height: appFolderLayout.tabHeight,
                            background: appFolderTheme,
                        }}
                    />
                </div>
            </div>
            <div className="relative z-10 space-y-5">
                <section ref={appPickerRef} className="app-folder-section px-3 pt-1 pb-2">
                    {picker}
                </section>

                <div
                    ref={appFolderContentRef}
                    className="app-folder-content space-y-5"
                    style={{ borderRadius: bodyCornerRadius, overflow: 'hidden' }}
                >
                    <section ref={appSimulatorRef} className="app-folder-section p-5">
                        {simulator}
                    </section>

                    <section
                        ref={appGenerationRef}
                        className="app-folder-section p-6 before:content-[''] before:absolute before:top-0 before:left-5 before:right-5 before:h-px before:bg-indigo-900/30 before:pointer-events-none"
                    >
                        {generation}
                    </section>
                </div>

                <div className="space-y-6 mt-6" ref={appFolderEndRef}>
                    {endSections}
                </div>
            </div>
        </div>
    );
};
