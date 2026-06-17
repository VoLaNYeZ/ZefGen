export const CLIENT_GITHUB_PUBLISH_OWNER_ENV_KEY = 'VITE_CLIENT_GITHUB_PUBLISH_OWNER';

export const getClientGithubPublishOwner = () => {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return String(env?.[CLIENT_GITHUB_PUBLISH_OWNER_ENV_KEY] || '').trim();
};

export const toGithubRepoFullNameFromUrl = (url: string | null | undefined) => {
    let value = String(url || '').trim();
    if (!value) return '';
    value = value.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/\/+$/g, '');
    const match = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
    if (!match) return '';
    const owner = String(match[1] || '').trim();
    const repo = String(match[2] || '').trim().replace(/\.git$/i, '');
    if (!owner || !repo) return '';
    return `${owner}/${repo}`;
};

export const toClientGithubRepoNameFromSourceName = (sourceRepoName: string | null | undefined) => {
    const trimmed = String(sourceRepoName || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/^(-?)ef-(\d+)-/, '$1EF-$2-');
};

export const toClientGithubRepoFullNameFromSource = (
    sourceRepoFullName: string | null | undefined,
    targetOwner = getClientGithubPublishOwner()
) => {
    const trimmed = String(sourceRepoFullName || '').trim();
    if (!trimmed) return '';
    const owner = String(targetOwner || '').trim();
    if (!owner) return '';

    const parts = trimmed.split('/');
    const sourceRepoName = parts.length >= 2 ? String(parts[1] || '').trim() : trimmed;
    const targetRepoName = toClientGithubRepoNameFromSourceName(sourceRepoName);
    if (!targetRepoName) return '';
    return `${owner}/${targetRepoName}`;
};
