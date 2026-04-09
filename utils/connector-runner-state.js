const CODE_PRODUCING_JOB_KINDS = new Set(['generate', 'fix', 'integration', 'visual_qa']);
const ACTIVE_CONNECTOR_JOB_STATUSES = new Set(['queued', 'running', 'waiting_for_user']);

const normalizeList = (value) => (Array.isArray(value) ? value : []);

export const isFilledConnectorValue = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    return raw !== 'https://google.com';
};

export const normalizeCommitSha = (value) =>
    String(value ?? '')
        .trim()
        .toLowerCase();

export const getSecretMetaKeySet = (secretMetas) =>
    new Set(
        normalizeList(secretMetas)
            .map((item) => String(item?.key ?? '').trim())
            .filter(Boolean)
    );

export const buildIntegrationRequirements = ({ variables, legalLinks, secretMetas }) => {
    const vars = variables && typeof variables === 'object' ? variables : {};
    const links = legalLinks && typeof legalLinks === 'object' ? legalLinks : {};

    return [
        { key: 'apphud_api_key', source: 'variable', ok: isFilledConnectorValue(vars.apphud_api_key) },
        { key: 'domain', source: 'variable', ok: isFilledConnectorValue(vars.domain) },
        { key: 'bundle_id', source: 'variable', ok: isFilledConnectorValue(vars.bundle_id) },
        { key: 'privacy_policy_url', source: 'legal_link', ok: isFilledConnectorValue(links.privacy_policy_url) },
        { key: 'terms_of_use_url', source: 'legal_link', ok: isFilledConnectorValue(links.terms_of_use_url) },
        { key: 'support_form_url', source: 'legal_link', ok: isFilledConnectorValue(links.support_form_url) },
        { key: 'firebase_plist_snippet', source: 'variable', ok: isFilledConnectorValue(vars.firebase_plist_snippet) },
        { key: 'id_purchases', source: 'variable', ok: isFilledConnectorValue(vars.id_purchases), optional: true },
    ];
};

export const getIntegrationReadiness = ({ variables, legalLinks, secretMetas }) =>
    buildIntegrationRequirements({ variables, legalLinks, secretMetas }).every((item) => item.optional || item.ok);

export const findLatestSuccessfulJob = (jobs, predicate) =>
    normalizeList(jobs).find((job) => String(job?.status ?? '') === 'succeeded' && predicate(job)) || null;

export const findLatestSuccessfulGenerateJob = (jobs) =>
    findLatestSuccessfulJob(jobs, (job) => String(job?.kind ?? '') === 'generate');

export const hasSuccessfulGenerateJob = (jobs) => Boolean(findLatestSuccessfulGenerateJob(jobs));

export const isActiveConnectorJob = (job) =>
    ACTIVE_CONNECTOR_JOB_STATUSES.has(String(job?.status ?? '').trim());

export const isCancelRequestedConnectorJob = (job) =>
    isActiveConnectorJob(job) && Boolean(job?.cancel_requested_at);

export const findLatestActiveConnectorJob = (jobs) =>
    normalizeList(jobs).find((job) => isActiveConnectorJob(job)) || null;

export const deriveConnectorJobState = (jobs, options = {}) => {
    const list = normalizeList(jobs);
    const latestJob = list[0] || null;
    const latestSuccessfulGenerateJob = findLatestSuccessfulGenerateJob(list);
    const latestSuccessfulCodeJob = findLatestSuccessfulJob(list, (job) => CODE_PRODUCING_JOB_KINDS.has(String(job?.kind ?? '')));
    const latestSuccessfulQaJob = findLatestSuccessfulJob(list, (job) => String(job?.kind ?? '') === 'visual_qa');
    const latestSuccessfulIntegrationJob = findLatestSuccessfulJob(list, (job) => String(job?.kind ?? '') === 'integration');
    const latestActiveJob = findLatestActiveConnectorJob(list);

    const liveMainSha = normalizeCommitSha(options?.liveMainSha);
    const trustedMainSourceSha = normalizeCommitSha(options?.trustedMainSourceSha);
    const latestCodeSha = normalizeCommitSha(latestSuccessfulCodeJob?.result_commit_sha);
    const latestQaSha = normalizeCommitSha(latestSuccessfulQaJob?.result_commit_sha);
    const effectiveCurrentSourceSha = liveMainSha
        ? trustedMainSourceSha && trustedMainSourceSha === liveMainSha
            ? trustedMainSourceSha
            : latestCodeSha && latestCodeSha === liveMainSha
              ? latestCodeSha
              : ''
        : '';
    const latestSuccessfulCodeJobForCurrentSource = effectiveCurrentSourceSha
        ? findLatestSuccessfulJob(
              list,
              (job) =>
                  CODE_PRODUCING_JOB_KINDS.has(String(job?.kind ?? '')) &&
                  normalizeCommitSha(job?.result_commit_sha) === effectiveCurrentSourceSha
          )
        : null;
    const latestSuccessfulQaJobForCurrentSource = effectiveCurrentSourceSha
        ? findLatestSuccessfulJob(
              list,
              (job) =>
                  String(job?.kind ?? '') === 'visual_qa' &&
                  normalizeCommitSha(job?.result_commit_sha) === effectiveCurrentSourceSha
          )
        : null;
    const latestPassedQaJobForCurrentSource = effectiveCurrentSourceSha
        ? findLatestSuccessfulJob(
              list,
              (job) =>
                  String(job?.kind ?? '') === 'visual_qa' &&
                  String(job?.verify_status ?? '') === 'pass' &&
                  normalizeCommitSha(job?.result_commit_sha) === effectiveCurrentSourceSha
          )
        : null;

    let qaDisabledReason = '';
    if (!liveMainSha) qaDisabledReason = 'main_lookup_failed';
    else if (!effectiveCurrentSourceSha) {
        if (trustedMainSourceSha && trustedMainSourceSha !== liveMainSha) qaDisabledReason = 'stale_main';
        else if (latestSuccessfulCodeJob && latestCodeSha && latestCodeSha !== liveMainSha) qaDisabledReason = 'stale_main';
        else if (latestSuccessfulCodeJob && !latestCodeSha) qaDisabledReason = 'missing_code_sha';
        else qaDisabledReason = 'missing_code_job';
    }

    let screenshotsDisabledReason = '';
    if (!liveMainSha) screenshotsDisabledReason = 'main_lookup_failed';
    else if (!effectiveCurrentSourceSha) {
        if (trustedMainSourceSha && trustedMainSourceSha !== liveMainSha) screenshotsDisabledReason = 'stale_main';
        else if (latestSuccessfulCodeJob && latestCodeSha && latestCodeSha !== liveMainSha) screenshotsDisabledReason = 'stale_main';
        else if (latestSuccessfulCodeJob && !latestCodeSha) screenshotsDisabledReason = 'missing_code_sha';
        else screenshotsDisabledReason = 'missing_code_job';
    }

    const screenshotsSourceJob =
        latestSuccessfulQaJobForCurrentSource ||
        (effectiveCurrentSourceSha && latestSuccessfulCodeJobForCurrentSource ? latestSuccessfulCodeJobForCurrentSource : null);

    if (!screenshotsDisabledReason && !screenshotsSourceJob) screenshotsDisabledReason = 'missing_screenshots_source_job';

    let screenshotsAdvisoryReason = '';
    if (!screenshotsDisabledReason) {
        if (!latestSuccessfulQaJob) screenshotsAdvisoryReason = 'missing_qa_job';
        else if (!latestQaSha) screenshotsAdvisoryReason = 'missing_qa_sha';
        else if (!latestSuccessfulQaJobForCurrentSource) screenshotsAdvisoryReason = 'stale_qa';
        else if (String(latestSuccessfulQaJobForCurrentSource?.verify_status ?? '') !== 'pass')
            screenshotsAdvisoryReason = 'qa_not_passed';
    }

    return {
        latestJob,
        latestSuccessfulGenerateJob,
        hasSuccessfulGenerateJob: Boolean(latestSuccessfulGenerateJob),
        latestSuccessfulCodeJob,
        latestSuccessfulCodeJobForCurrentSource,
        latestSuccessfulQaJob,
        latestSuccessfulQaJobForCurrentSource,
        latestPassedQaJobForCurrentSource,
        latestSuccessfulIntegrationJob,
        latestActiveJob,
        activeJobCancelRequested: isCancelRequestedConnectorJob(latestActiveJob),
        liveMainSha: liveMainSha || null,
        trustedMainSourceSha: trustedMainSourceSha || null,
        latestSuccessfulCodeSha: latestCodeSha || null,
        latestSuccessfulQaSha: latestQaSha || null,
        effectiveCurrentSourceSha: effectiveCurrentSourceSha || null,
        qaSourceKind: qaDisabledReason ? null : latestSuccessfulCodeJobForCurrentSource ? 'job' : 'github_main_sync',
        qaSourceJob: qaDisabledReason ? null : latestSuccessfulCodeJobForCurrentSource,
        qaDisabledReason,
        canRunQa: !qaDisabledReason,
        screenshotsSourceJob: screenshotsDisabledReason ? null : screenshotsSourceJob,
        screenshotsDisabledReason,
        screenshotsAdvisoryReason,
        canRunScreenshots: !screenshotsDisabledReason,
    };
};

export const findLatestSuccessfulIntegrationForBranch = (jobs, baseBranch) => {
    const normalizedBranch = String(baseBranch ?? '').trim() || 'main';
    return findLatestSuccessfulJob(
        jobs,
        (job) => String(job?.kind ?? '') === 'integration' && (String(job?.base_branch ?? '').trim() || 'main') === normalizedBranch
    );
};

const compareText = (left, right) => String(left || '').localeCompare(String(right || ''));

const normalizeArtifactVariant = (value) => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'render' || raw === 'renders') return 'render';
    if (raw === 'simulator') return 'simulator';
    return '';
};

export const getArtifactVariant = (artifact) => {
    const fromMetadata = normalizeArtifactVariant(
        artifact?.metadata?.capture_variant ?? artifact?.metadata?.variant ?? artifact?.metadata?.capture_mode
    );
    if (fromMetadata) return fromMetadata;
    const match = String(artifact?.object_path ?? '').match(/\/(render|renders|simulator)\//i);
    return match ? normalizeArtifactVariant(match[1]) : '';
};

export const groupConnectorArtifacts = (artifacts) => {
    const list = normalizeList(artifacts);
    const qaEvidenceMap = new Map();
    const screenshotImageMap = new Map();
    let qaReport = null;
    let screenshotManifest = null;

    for (const artifact of list) {
        const kind = String(artifact?.kind ?? '').trim();
        if (kind === 'qa_report') {
            qaReport = artifact;
            continue;
        }
        if (kind === 'screenshot_manifest') {
            screenshotManifest = artifact;
            continue;
        }
        if (kind !== 'qa_evidence' && kind !== 'screenshot_image') continue;

        const variant = getArtifactVariant(artifact) || (kind === 'qa_evidence' ? 'render' : 'render');
        const theme = String(artifact?.metadata?.theme ?? '').trim() || 'light';
        const viewport = String(artifact?.metadata?.viewport ?? '').trim() || 'default';
        const targetId = String(artifact?.metadata?.target_id ?? '').trim() || 'target';
        const groupKey = `${variant}::${theme}::${viewport}`;
        const groupMap = kind === 'qa_evidence' ? qaEvidenceMap : screenshotImageMap;
        const existing =
            groupMap.get(groupKey) ||
            {
                key: groupKey,
                variant,
                theme,
                viewport,
                items: [],
            };
        existing.items.push({
            ...artifact,
            targetId,
        });
        groupMap.set(groupKey, existing);
    }

    const sortGroups = (groups) =>
        Array.from(groups.values())
            .map((group) => ({
                ...group,
                items: [...group.items].sort((left, right) => compareText(left.targetId, right.targetId) || compareText(left.id, right.id)),
            }))
            .sort((left, right) => {
                return (
                    compareText(left.variant, right.variant) ||
                    compareText(left.theme, right.theme) ||
                    compareText(left.viewport, right.viewport)
                );
            });

    return {
        qaReport,
        screenshotManifest,
        qaEvidenceGroups: sortGroups(qaEvidenceMap),
        screenshotGroups: sortGroups(screenshotImageMap),
        secretRequirementKeys: [],
    };
};
