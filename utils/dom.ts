import { AUTO_GROW_MULTIPLIER } from '../constants/zefgen';

export const syncAutoGrowTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const requestedBaseHeight = Number(element.dataset.autoGrowBase || 0);
    const cachedBaseHeight = Number(element.dataset.baseHeight || 0);
    const measuredBaseHeight = element.offsetHeight || element.scrollHeight;
    const baseHeight = cachedBaseHeight || Math.max(requestedBaseHeight, measuredBaseHeight);
    if (!element.dataset.baseHeight) {
        element.dataset.baseHeight = String(baseHeight);
    }
    const requestedMultiplier = Number(element.dataset.autoGrowMultiplier || 0);
    const maxHeight = baseHeight * (requestedMultiplier > 0 ? requestedMultiplier : AUTO_GROW_MULTIPLIER);
    element.style.minHeight = `${baseHeight}px`;
    element.style.maxHeight = `${maxHeight}px`;
    element.style.height = 'auto';
    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = `${nextHeight}px`;
    if (element.scrollHeight > maxHeight) {
        element.style.resize = 'vertical';
        element.style.overflowY = 'auto';
    } else {
        element.style.resize = 'none';
        element.style.overflowY = 'hidden';
    }
};
