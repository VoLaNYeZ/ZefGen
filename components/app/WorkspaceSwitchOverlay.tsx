import { BreathingText } from '../fancy/text';
import type { WorkspaceSwitchOverlayStage } from '../../hooks/use-workspace-switch-overlay';

type WorkspaceSwitchOverlayProps = {
    isVisible: boolean;
    showLoader: boolean;
    stage: WorkspaceSwitchOverlayStage;
    label: string;
    loadingLabel: string;
};

export function WorkspaceSwitchOverlay({
    isVisible,
    showLoader,
    stage,
    label,
    loadingLabel,
}: WorkspaceSwitchOverlayProps) {
    if (!isVisible) return null;

    return (
        <div
            className={`absolute inset-0 z-20 rounded-[36px] transition-all duration-150 ${
                stage === 'shield'
                    ? 'bg-transparent'
                    : stage === 'dim'
                      ? 'bg-slate-950/20 backdrop-blur-[2px]'
                      : 'bg-slate-950/55 backdrop-blur-sm ring-1 ring-white/10'
            }`}
        >
            <div className="flex h-full items-center justify-center">
                {showLoader ? (
                    <div className="pointer-events-none select-none text-center">
                        <BreathingText
                            className="text-5xl leading-none text-white font-roboto-flex tracking-[0.08em]"
                            fromFontVariationSettings="'wght' 260, 'slnt' 0"
                            toFontVariationSettings="'wght' 820, 'slnt' -8"
                        >
                            ZEFGEN
                        </BreathingText>
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-200/45">
                            {loadingLabel}
                        </div>
                        <div className="mt-1 text-xs font-medium text-indigo-100/65">{label}</div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
