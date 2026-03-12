import type { ComponentProps } from 'react';
import {
    useWorkspaceGenerationViewModel,
    type UseWorkspaceGenerationViewModelParams,
} from '../../hooks/use-workspace-generation-view-model';
import { WorkspaceSetupPanels } from './WorkspaceSetupPanels';

type WorkspaceSetupPanelsProps = ComponentProps<typeof WorkspaceSetupPanels>;

type Props = {
    generationViewModel: UseWorkspaceGenerationViewModelParams;
    panels: Omit<WorkspaceSetupPanelsProps, 'generationModuleProps'>;
};

export function WorkspaceSetupPanelsContent({ generationViewModel, panels }: Props) {
    const { generationModuleProps } = useWorkspaceGenerationViewModel(generationViewModel);
    const workspaceSetupPanelsProps: WorkspaceSetupPanelsProps = {
        ...panels,
        generationModuleProps,
    };

    return <WorkspaceSetupPanels {...workspaceSetupPanelsProps} />;
}
