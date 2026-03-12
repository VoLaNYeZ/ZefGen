import { useCallback } from 'react';
import type { TranslationKey } from '../i18n';
import type { AppItem, AppScreenshot } from '../types/zefgen';
import { downloadBlob } from '../utils/download';
import type { GenerationJobKind } from './use-generation-jobs';

type QueueJobs = {
    createJob: (payload: { title: string; kind: GenerationJobKind; progressTotal?: number }) => string;
    setJobProgress: (id: string, progress: { current: number; total: number }) => void;
    setJobMessage: (id: string, message: string | undefined) => void;
    finishJob: (id: string, payload: { status: 'success' | 'error' | 'canceled'; message?: string }) => void;
};

type Params = {
    appScreenshotUrls: Record<string, string>;
    queueJobs: QueueJobs;
    reportError: (message: string) => void;
    selectedApp: AppItem | null;
    selectedAppScreenshots: AppScreenshot[];
    text: (key: TranslationKey) => string;
};

const sanitizeFilenamePart = (value: string) =>
    String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9 _.-]+/gi, '')
        .replace(/\s/g, '-')
        .slice(0, 60) || 'screenshots';

const fileExtensionForPath = (path: string) => {
    const normalized = String(path || '').split('?')[0].trim();
    const match = normalized.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || 'jpg';
};

export function useAppScreenshotDownloads({
    appScreenshotUrls,
    queueJobs,
    reportError,
    selectedApp,
    selectedAppScreenshots,
    text,
}: Params) {
    const handleDownloadSimulatorScreenshotsZip = useCallback(async () => {
        if (!selectedApp || !selectedAppScreenshots.length) return;

        const items = selectedAppScreenshots.filter((shot) => Boolean(shot.image_path));
        if (!items.length) return;

        const jobId = queueJobs.createJob({
            title: `${text('download_simulator_screenshots_zip')}`,
            kind: 'download_zip',
            progressTotal: items.length,
        });

        try {
            const { default: JSZip } = await import('jszip');
            const zip = new JSZip();

            for (let index = 0; index < items.length; index += 1) {
                const shot = items[index];
                const downloadUrl = appScreenshotUrls[shot.id];
                if (!downloadUrl) {
                    throw new Error(text('download_failed'));
                }

                queueJobs.setJobProgress(jobId, { current: index, total: items.length });
                queueJobs.setJobMessage(jobId, `${text('download')} ${index + 1}/${items.length}`);

                const response = await fetch(downloadUrl, { cache: 'force-cache' });
                if (!response.ok) {
                    throw new Error(`Failed to download file (${response.status}).`);
                }

                const blob = await response.blob();
                const extension = fileExtensionForPath(shot.image_path);
                const name = `Simulator ${String(index + 1).padStart(2, '0')}.${extension}`;
                zip.file(name, blob);
            }

            queueJobs.setJobProgress(jobId, { current: items.length, total: items.length });
            queueJobs.setJobMessage(jobId, 'Packaging zip');
            const blob = await zip.generateAsync({ type: 'blob' });
            const zipName = `${selectedApp.alias || 'app'}-${sanitizeFilenamePart(text('simulator_screenshots'))}.zip`;
            downloadBlob(blob, zipName);
            queueJobs.finishJob(jobId, { status: 'success' });
        } catch (error: any) {
            queueJobs.finishJob(jobId, {
                status: 'error',
                message: String(error?.message || 'ZIP failed').slice(0, 200),
            });
            reportError(error?.message || text('download_failed'));
        }
    }, [appScreenshotUrls, queueJobs, reportError, selectedApp, selectedAppScreenshots, text]);

    return {
        handleDownloadSimulatorScreenshotsZip,
    };
}
