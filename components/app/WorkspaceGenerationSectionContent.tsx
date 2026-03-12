import type { ReactNode } from 'react';
import {
    useWorkspaceGenerationViewModel,
    type UseWorkspaceGenerationViewModelParams,
} from '../../hooks/use-workspace-generation-view-model';

type Props = {
    section: 'generation' | 'endSections';
    viewModel: UseWorkspaceGenerationViewModelParams;
};

export function WorkspaceGenerationSectionContent({
    section,
    viewModel,
}: Props): ReactNode {
    const { generationSections } = useWorkspaceGenerationViewModel(viewModel);
    return generationSections[section];
}
