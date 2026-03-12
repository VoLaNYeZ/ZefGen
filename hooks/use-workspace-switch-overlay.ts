import { useEffect, useRef, useState, type MutableRefObject } from 'react';

const WORKSPACE_SWITCH_DIM_DELAY_MS = 180;
const WORKSPACE_SWITCH_LOADER_DELAY_MS = 700;
const WORKSPACE_SWITCH_LOADER_MIN_VISIBLE_MS = 320;

export type WorkspaceSwitchOverlayStage = 'hidden' | 'shield' | 'dim' | 'loader';

export function useWorkspaceSwitchOverlay(isPending: boolean) {
    const [stage, setStage] = useState<WorkspaceSwitchOverlayStage>('hidden');
    const stageRef = useRef<WorkspaceSwitchOverlayStage>('hidden');
    const dimTimerRef = useRef<number | null>(null);
    const loaderTimerRef = useRef<number | null>(null);
    const hideTimerRef = useRef<number | null>(null);
    const loaderVisibleAtRef = useRef<number | null>(null);

    useEffect(() => {
        stageRef.current = stage;
    }, [stage]);

    useEffect(() => {
        const clearTimer = (timerRef: MutableRefObject<number | null>) => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        clearTimer(dimTimerRef);
        clearTimer(loaderTimerRef);

        if (isPending) {
            clearTimer(hideTimerRef);
            setStage((previous) => (previous === 'loader' ? 'loader' : 'shield'));

            dimTimerRef.current = window.setTimeout(() => {
                setStage((previous) => (previous === 'loader' ? 'loader' : 'dim'));
            }, WORKSPACE_SWITCH_DIM_DELAY_MS);

            loaderTimerRef.current = window.setTimeout(() => {
                loaderVisibleAtRef.current = performance.now();
                setStage('loader');
            }, WORKSPACE_SWITCH_LOADER_DELAY_MS);

            return () => {
                clearTimer(dimTimerRef);
                clearTimer(loaderTimerRef);
            };
        }

        if (stageRef.current === 'loader' && loaderVisibleAtRef.current) {
            const elapsed = performance.now() - loaderVisibleAtRef.current;
            const remaining = Math.max(0, WORKSPACE_SWITCH_LOADER_MIN_VISIBLE_MS - elapsed);
            if (remaining > 0) {
                hideTimerRef.current = window.setTimeout(() => {
                    loaderVisibleAtRef.current = null;
                    setStage('hidden');
                }, remaining);
                return () => clearTimer(hideTimerRef);
            }
        }

        loaderVisibleAtRef.current = null;
        clearTimer(hideTimerRef);
        setStage('hidden');

        return () => {
            clearTimer(hideTimerRef);
        };
    }, [isPending]);

    return {
        stage,
        showOverlay: stage !== 'hidden',
        showLoader: stage === 'loader',
    };
}
