export type GithubMainHead = {
    branch: 'main';
    repoFullName: string;
    sha: string;
};

export const fetchGithubMainHead = async (payload: { accessToken: string; appId: string }) => {
    const resp = await fetch('/api/github-main-head', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${payload.accessToken}`,
        },
        body: JSON.stringify({ appId: payload.appId }),
    });

    const raw = await resp.text();
    let parsed: any = null;
    try {
        parsed = raw ? JSON.parse(raw) : null;
    } catch {
        parsed = raw;
    }

    if (!resp.ok) {
        throw new Error(String(parsed?.message || 'Failed to load GitHub main HEAD.'));
    }

    return {
        branch: 'main',
        repoFullName: String(parsed?.repoFullName || '').trim(),
        sha: String(parsed?.sha || '').trim(),
    } as GithubMainHead;
};
