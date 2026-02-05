import { AUTO_GROW_MULTIPLIER } from '../constants/zefgen';

export const syncAutoGrowTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const baseHeight = element.dataset.baseHeight
        ? Number(element.dataset.baseHeight)
        : element.offsetHeight || element.scrollHeight;
    if (!element.dataset.baseHeight) {
        element.dataset.baseHeight = String(baseHeight);
    }
    const maxHeight = baseHeight * AUTO_GROW_MULTIPLIER;
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
