export const EMAPPSTORE777_OWNER = 'emappstore777';

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

export const toEmappstore777RepoNameFromSourceName = (sourceRepoName: string | null | undefined) => {
    const trimmed = String(sourceRepoName || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/^(-?)ef-(\d+)-/, '$1EF-$2-');
};

export const toEmappstore777RepoFullNameFromSource = (sourceRepoFullName: string | null | undefined) => {
    const trimmed = String(sourceRepoFullName || '').trim();
    if (!trimmed) return '';

    const parts = trimmed.split('/');
    const sourceRepoName = parts.length >= 2 ? String(parts[1] || '').trim() : trimmed;
    const targetRepoName = toEmappstore777RepoNameFromSourceName(sourceRepoName);
    if (!targetRepoName) return '';
    return `${EMAPPSTORE777_OWNER}/${targetRepoName}`;
};
