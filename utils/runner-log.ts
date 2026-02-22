export type RunnerLogMessage = {
    content: string;
    created_at?: string;
    kind?: string;
    role?: string;
};

export type RunnerCompactEvent = {
    level: 'info' | 'warn' | 'error' | 'success';
    text: string;
    atMs: number | null;
};

export type RunnerCompactState = {
    repo: string | null;
    milestonesTotal: number | null;
    currentStage: string | null;
    currentMilestoneIndex: number | null;
    currentMilestoneName: string | null;
    stageStartedAtMs: number | null;
    pushedUrl: string | null;
    events: RunnerCompactEvent[];
    lastErrorEvent: string | null;
};

const toMs = (iso: string | undefined) => {
    const t = Date.parse(String(iso || ''));
    return Number.isFinite(t) ? t : null;
};

const normalizeLine = (raw: string) => {
    let s = String(raw || '');
    // The stored log sometimes includes "[runner]" prefix already.
    s = s.replace(/^\s*\[runner\]\s*/i, '');
    s = s.replace(/^\s*\[runner\]\s*/i, '');
    return s.trim();
};

const pushLimited = <T,>(arr: T[], item: T, limit: number) => {
    arr.push(item);
    if (arr.length > limit) arr.splice(0, arr.length - limit);
};

export function parseRunnerLog(messages: RunnerLogMessage[]): RunnerCompactState {
    const out: RunnerCompactState = {
        repo: null,
        milestonesTotal: null,
        currentStage: null,
        currentMilestoneIndex: null,
        currentMilestoneName: null,
        stageStartedAtMs: null,
        pushedUrl: null,
        events: [],
        lastErrorEvent: null,
    };

    const addEvent = (level: RunnerCompactEvent['level'], text: string, atMs: number | null) => {
        pushLimited(out.events, { level, text, atMs }, 8);
    };

    for (const m of messages) {
        if (m.kind && m.kind !== 'log') continue;

        const atMs = toMs(m.created_at);
        const line = normalizeLine(m.content);
        if (!line) continue;

        // Claimed job ... (generate) for repo ORG/REPO
        const claimed = line.match(/Claimed job\s+[0-9a-f-]+\s+\(([^)]+)\)\s+for repo\s+(.+)$/i);
        if (claimed) {
            out.repo = String(claimed[2] || '').trim() || out.repo;
            addEvent('info', 'Job claimed.', atMs);
            continue;
        }

        if (/Cloning repo\.\.\./i.test(line)) {
            addEvent('info', 'Cloning repo.', atMs);
            continue;
        }

        const milestones = line.match(/ExecPlan milestones detected:\s*(.+)$/i);
        if (milestones) {
            const parts = String(milestones[1] || '')
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean);
            const ms = parts.filter((p) => /^M\d+$/i.test(p));
            out.milestonesTotal = ms.length || null;
            addEvent('info', `Milestones detected: ${ms.length || parts.length}.`, atMs);
            continue;
        }

        const stage = line.match(/Running Codex\s+\(stage:\s*([^)]+)\)/i);
        if (stage) {
            const stageName = String(stage[1] || '').trim();
            out.currentStage = stageName || out.currentStage;
            out.stageStartedAtMs = atMs ?? out.stageStartedAtMs;

            const mm = stageName.match(/^M(\d+)/i);
            if (mm) {
                const idx = parseInt(mm[1] || '', 10);
                if (Number.isFinite(idx)) {
                    out.currentMilestoneIndex = idx;
                    out.currentMilestoneName = `M${idx}`;
                }
            }
            continue;
        }

        const verifyFail = line.match(/Verify fail after\s+(M\d+)/i);
        if (verifyFail) {
            const which = String(verifyFail[1] || '').trim();
            const msg = which ? `Quality check failed (${which}).` : 'Quality check failed.';
            out.lastErrorEvent = msg;
            addEvent('error', msg, atMs);
            continue;
        }

        const verifyPassAfterFix = line.match(/Verify pass after fix attempt\s+(\d+)/i);
        if (verifyPassAfterFix) {
            const n = String(verifyPassAfterFix[1] || '').trim();
            addEvent('success', n ? `Recovered after fix attempt ${n}.` : 'Recovered after fix.', atMs);
            continue;
        }

        const milestoneComplete = line.match(/Milestone\s+(M\d+)\s+complete\./i);
        if (milestoneComplete) {
            addEvent('success', `Milestone ${String(milestoneComplete[1] || '').trim()} completed.`, atMs);
            continue;
        }

        const pushed = line.match(/Pushed:\s*(https?:\/\/\S+)/i);
        if (pushed) {
            const url = String(pushed[1] || '').trim();
            out.pushedUrl = url || out.pushedUrl;
            addEvent('success', 'Pushed commit.', atMs);
            continue;
        }

        if (/^Error:/i.test(line) || /\bfatal\b/i.test(line)) {
            out.lastErrorEvent = line;
            addEvent('error', line, atMs);
            continue;
        }
    }

    return out;
}

export function humanizeStage(stage: string | null | undefined) {
    const s = String(stage || '').trim();
    if (!s) return '';

    if (s === 'design_style') return 'Designing style';
    if (s === 'specs') return 'Writing specs';

    // M1, M2 fix 1, etc.
    const mm = s.match(/^M(\d+)(?:\s+fix\s+(\d+))?/i);
    if (mm) {
        const idx = mm[1];
        const fix = mm[2];
        if (fix) return `Fixing milestone ${idx} (attempt ${fix})`;
        return `Working on milestone ${idx}`;
    }

    return s.replace(/_/g, ' ');
}
