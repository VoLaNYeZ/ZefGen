const PHASES = [
    {
        id: 'prepare_repository',
        titleKey: 'connector_integration_phase_prepare',
        headlineKey: 'connector_integration_phase_prepare_headline',
        detailKey: 'connector_integration_detail_prepare',
    },
    {
        id: 'load_package',
        titleKey: 'connector_integration_phase_load',
        headlineKey: 'connector_integration_phase_load_headline',
        detailKey: 'connector_integration_detail_load',
    },
    {
        id: 'plan_changes',
        titleKey: 'connector_integration_phase_plan',
        headlineKey: 'connector_integration_phase_plan_headline',
        detailKey: 'connector_integration_detail_plan',
    },
    {
        id: 'apply_changes',
        titleKey: 'connector_integration_phase_apply',
        headlineKey: 'connector_integration_phase_apply_headline',
        detailKey: 'connector_integration_detail_apply',
    },
    {
        id: 'check_result',
        titleKey: 'connector_integration_phase_check',
        headlineKey: 'connector_integration_phase_check_headline',
        detailKey: 'connector_integration_detail_check',
    },
    {
        id: 'send_github',
        titleKey: 'connector_integration_phase_send',
        headlineKey: 'connector_integration_phase_send_headline',
        detailKey: 'connector_integration_detail_send',
    },
] ;

const ACTIVE_STATUSES = new Set(['queued', 'running', 'waiting_for_user']);

const PHASE_INDEX = new Map(PHASES.map((phase, index) => [phase.id, index]));

const MATCHERS = [
    { pattern: /Claimed job/i, phaseId: 'prepare_repository', detailKey: 'connector_integration_detail_prepare' },
    { pattern: /Cloning repo/i, phaseId: 'prepare_repository', detailKey: 'connector_integration_detail_prepare' },
    { pattern: /Accepted repo invitation/i, phaseId: 'prepare_repository', detailKey: 'connector_integration_detail_prepare' },
    {
        pattern: /Resolving latest remote commit on origin\/.+ for integration/i,
        phaseId: 'prepare_repository',
        detailKey: 'connector_integration_detail_prepare_github',
    },
    {
        pattern: /Resolved integration base ref .+ from origin\/.+/i,
        phaseId: 'prepare_repository',
        detailKey: 'connector_integration_detail_prepare_github',
    },
    {
        pattern: /Checking out integration base ref/i,
        phaseId: 'prepare_repository',
        detailKey: 'connector_integration_detail_prepare_open',
    },
    {
        pattern: /Creating branch /i,
        phaseId: 'prepare_repository',
        detailKey: 'connector_integration_detail_prepare_branch',
    },
    {
        pattern: /Copying integration payload into lib\/inte before planning/i,
        phaseId: 'load_package',
        detailKey: 'connector_integration_detail_load',
    },
    {
        pattern: /Running integration planner stage/i,
        phaseId: 'plan_changes',
        detailKey: 'connector_integration_detail_plan',
    },
    {
        pattern: /Running integration executor stage/i,
        phaseId: 'apply_changes',
        detailKey: 'connector_integration_detail_apply',
    },
    {
        pattern: /Running integration fixer stage/i,
        phaseId: 'apply_changes',
        detailKey: 'connector_integration_detail_apply_fix',
    },
    {
        pattern: /Committing changes/i,
        phaseId: 'check_result',
        detailKey: 'connector_integration_detail_check',
    },
    {
        pattern: /Running verify/i,
        phaseId: 'check_result',
        detailKey: 'connector_integration_detail_check',
    },
    {
        pattern: /Verify (?:pass|fail)/i,
        phaseId: 'check_result',
        detailKey: 'connector_integration_detail_check',
    },
    {
        pattern: /Final deterministic quality gates failed/i,
        phaseId: 'check_result',
        detailKey: 'connector_integration_detail_check',
    },
    {
        pattern: /Verify passed; pushing commit/i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /Verify .+; pushing work branch for inspection/i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /Pushing branch/i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /Creating PR/i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /PR ready:/i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /Verify passed; attempting PR merge/i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /Merged\./i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /Auto-merge enabled\./i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
    {
        pattern: /Pushed:\s*https?:\/\//i,
        phaseId: 'send_github',
        detailKey: 'connector_integration_detail_send',
    },
] ;

const STAGE_PREFIX_MAP = [
    { prefix: 'integration_plan', phaseId: 'plan_changes', detailKey: 'connector_integration_detail_plan' },
    { prefix: 'integration_execute', phaseId: 'apply_changes', detailKey: 'connector_integration_detail_apply' },
    { prefix: 'integration_fix_', phaseId: 'apply_changes', detailKey: 'connector_integration_detail_apply_fix' },
] ;

const toMs = (value) => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
};

const formatElapsed = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${String(hours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m`;
    }
    return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

const normalizeLine = (raw) =>
    String(raw || '')
        .replace(/^\s*\[runner\]\s*/i, '')
        .replace(/^\s*\[runner\]\s*/i, '')
        .trim();

const findPhase = (phaseId) => PHASES[PHASE_INDEX.get(phaseId) ?? 0] || PHASES[0];

const stageMatch = (line) => {
    const match = String(line || '').match(/Running Codex\s+\(stage:\s*([^)]+)\)/i);
    if (!match) return null;
    const stageName = String(match[1] || '').trim();
    if (!stageName) return null;
    const stage = STAGE_PREFIX_MAP.find((item) => stageName.startsWith(item.prefix));
    return stage
        ? {
              phaseId: stage.phaseId,
              detailKey: stage.detailKey,
          }
        : null;
};

const resolvePhaseProgress = (messages) => {
    let latest = null;

    for (const message of messages || []) {
        if (message.kind && message.kind !== 'log') continue;

        const line = normalizeLine(message.content);
        if (!line) continue;

        const direct = MATCHERS.find((item) => item.pattern.test(line));
        const stage = direct ? null : stageMatch(line);
        const matched = direct || stage;
        if (!matched) continue;

        latest = {
            phaseId: matched.phaseId,
            detailKey: matched.detailKey,
            atMs: toMs(message.created_at),
        };
    }

    return latest;
};

const translateFailure = ({ raw, text }) => {
    const value = String(raw || '').toLowerCase();
    if (!value) return '';

    if (
        value.includes('cannot access repo contents') ||
        value.includes('access failure cloning') ||
        value.includes('failed to resolve origin/') ||
        value.includes('failed to checkout integration base ref') ||
        value.includes('missing resolved base ref sha')
    ) {
        return text('connector_integration_error_repo');
    }

    if (value.includes('unable to determine dart package name')) {
        return text('connector_integration_error_package');
    }

    if (
        value.includes('invalid integration plan') ||
        value.includes('integration_plan stage failed')
    ) {
        return text('connector_integration_error_plan');
    }

    if (
        value.includes('integration_execute stage failed') ||
        value.includes('integration_fix_')
    ) {
        return text('connector_integration_error_apply');
    }

    if (
        value.includes('branch pushed for inspection') ||
        value.includes('pr opened') ||
        value.includes('verify fail') ||
        value.includes('quality gates failed') ||
        value.includes('failing state')
    ) {
        return text('connector_integration_error_verify');
    }

    return text('connector_integration_error_generic');
};

/**
 * @param {{
 *   job: any;
 *   messages?: Array<{ content?: string; created_at?: string; kind?: string }>;
 *   unansweredQuestionCount?: number;
 *   nowMs?: number;
 *   text: (key: string) => string;
 * }} payload
 */
export function buildIntegrationTerminalModel(payload) {
    const { job, text } = payload;
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const unansweredQuestionCount = Math.max(0, Number(payload.unansweredQuestionCount || 0));
    const nowMs = Number(payload.nowMs || Date.now());

    const status = String(job?.status || '').trim();
    const active = ACTIVE_STATUSES.has(status);
    const showActionRequired = status === 'waiting_for_user' || unansweredQuestionCount > 0;

    const phaseProgress = resolvePhaseProgress(messages);
    const fallbackPhaseId =
        status === 'succeeded'
            ? 'send_github'
            : status === 'failed'
              ? phaseProgress?.phaseId || 'check_result'
              : phaseProgress?.phaseId || 'prepare_repository';
    const activePhase = findPhase(fallbackPhaseId);
    const activePhaseIndex = PHASE_INDEX.get(activePhase.id) ?? 0;
    const phaseStartMs =
        phaseProgress?.atMs ??
        toMs(job?.started_at) ??
        toMs(job?.created_at);
    const elapsedText = active && phaseStartMs ? formatElapsed(nowMs - phaseStartMs) : '';

    const combinedFailureText = [String(job?.error || ''), String(job?.summary || '')]
        .concat(messages.map((message) => normalizeLine(message.content)))
        .filter(Boolean)
        .join('\n');
    const translatedError =
        status === 'failed'
            ? translateFailure({
                  raw: combinedFailureText,
                  text,
              })
            : '';

    let headline = text(activePhase.headlineKey);
    let detail = text(phaseProgress?.detailKey || activePhase.detailKey);

    if (showActionRequired) {
        headline = text('connector_integration_waiting_headline');
        detail = text('connector_integration_waiting_detail');
    } else if (status === 'queued' && !phaseProgress) {
        headline = text('connector_integration_phase_prepare_headline');
        detail = text('connector_integration_queueing');
    } else if (status === 'succeeded') {
        headline = text('connector_integration_success_headline');
        detail = text('connector_integration_success_detail');
    } else if (status === 'failed') {
        headline = text('connector_integration_failed_headline');
        detail = translatedError || text('connector_integration_error_generic');
    }

    const timelineLines = PHASES.map((phase, index) => {
        let level = 'info';
        let prefix = text('connector_integration_timeline_next');

        if (status === 'succeeded' || index < activePhaseIndex) {
            level = 'success';
            prefix = text('connector_integration_timeline_done');
        } else if (index === activePhaseIndex) {
            level = showActionRequired ? 'warn' : status === 'failed' ? 'error' : 'info';
            prefix = status === 'failed'
                ? text('connector_integration_timeline_stopped')
                : text('connector_integration_timeline_now');
        }

        let lineText = `${prefix}  ${text(phase.titleKey)}`;
        if (index === activePhaseIndex && elapsedText) {
            lineText += `  ${elapsedText}`;
        }

        return {
            level,
            text: lineText,
        };
    });

    return {
        headline,
        detail,
        activePhase: activePhase.id,
        timelineLines,
        translatedError,
        showActionRequired,
    };
}
