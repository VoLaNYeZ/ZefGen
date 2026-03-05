// Vercel Serverless Function: POST /api/generate-icon-prompt
//
// Generates a No Brand icon prompt from the first few client-spec lines.

type GenerateIconPromptRequestBody = {
    clientSpec: string;
    appName?: string;
    appAlias?: string;
};

const MAX_CLIENT_SPEC_LINES = 6;
const MIN_SPEC_CONTENT_CHARS = 40;
const MAX_PROMPT_LENGTH = 320;
const DEFAULT_MODEL = 'gpt-5.2';

const json = (res: any, status: number, payload: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-ZefGen-Api', 'generate-icon-prompt');
    const deploySha = process.env.VERCEL_GIT_COMMIT_SHA;
    if (deploySha) {
        res.setHeader('X-ZefGen-Deploy', deploySha);
    }
    res.end(JSON.stringify(payload));
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const extractBearerToken = (authorization: unknown) => {
    if (!isNonEmptyString(authorization)) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
};

const verifySupabaseToken = async (token: string) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    }

    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`,
        },
    });

    return resp.ok;
};

const pickClientSpecLines = (clientSpec: string) => {
    const lines = String(clientSpec || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    return lines.slice(0, MAX_CLIENT_SPEC_LINES);
};

const coerceTextContent = (raw: any): string => {
    const candidate = raw?.choices?.[0]?.message?.content;
    if (typeof candidate === 'string') return candidate;
    if (Array.isArray(candidate)) {
        return candidate
            .map((part) => {
                if (typeof part === 'string') return part;
                if (typeof part?.text === 'string') return part.text;
                return '';
            })
            .join('\n')
            .trim();
    }
    return '';
};

const sanitizeIconPrompt = (value: string) => {
    let out = String(value || '').trim();

    out = out.replace(/^```[a-zA-Z0-9_-]*\s*/i, '').replace(/\s*```$/i, '').trim();
    out = out.replace(/^['"“”]+/, '').replace(/['"“”]+$/, '').trim();
    out = out.replace(/\s+/g, ' ').trim();

    if (out.length > MAX_PROMPT_LENGTH) {
        out = out.slice(0, MAX_PROMPT_LENGTH).trimEnd();
    }

    return out;
};

type ChatMessage = {
    role: 'system' | 'user';
    content: string;
};

const isGpt5FamilyModel = (model: string) => /^gpt-5(?:[.-]|$)/i.test(String(model || '').trim());

const canUseChatSampling = (model: string, reasoningEffort?: 'none' | 'low' | 'medium' | 'high') => {
    const normalized = String(model || '').trim().toLowerCase();
    if (!normalized) return false;
    if (!normalized.startsWith('gpt-5')) return true;
    const isGpt51Or52 = /^gpt-5\.(1|2)(?:$|[-:])/.test(normalized);
    return isGpt51Or52 && reasoningEffort === 'none';
};

const buildChatCompletionsBody = (payload: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}) => {
    const body: any = {
        model: payload.model,
        messages: payload.messages,
    };
    if (payload.reasoningEffort) {
        body.reasoning_effort = payload.reasoningEffort;
    }
    if (typeof payload.temperature === 'number' && canUseChatSampling(payload.model, payload.reasoningEffort)) {
        body.temperature = payload.temperature;
    }
    return body;
};

const normalizeOpenAIChatErrorMessage = (payload: { message: string; model: string; param?: string }) => {
    const raw = String(payload.message || '').trim();
    if (!raw) return '';
    const hintedParam = String(payload.param || '').trim();
    const detectedParam = (hintedParam || raw.match(/\b(temperature|top_p|logprobs|frequency_penalty|presence_penalty)\b/i)?.[1] || '').trim();
    const looksUnsupported = /isn'?t available|not supported|unsupported|does not support/i.test(raw);
    if (detectedParam && looksUnsupported) {
        return `OpenAI model "${payload.model}" does not support "${detectedParam}" for Chat Completions. Use a GPT-5-compatible payload (no sampling params unless reasoning_effort='none' on gpt-5.1/gpt-5.2).`;
    }
    if (isGpt5FamilyModel(payload.model) && /temperature|top_p|logprobs|frequency_penalty|presence_penalty/i.test(raw)) {
        return `OpenAI model "${payload.model}" rejected a sampling parameter. GPT-5 Chat Completions should omit sampling params unless reasoning_effort='none' on gpt-5.1/gpt-5.2.`;
    }
    return raw;
};

const generateWithOpenAI = async (payload: {
    clientSpecLines: string[];
    appName: string;
    appAlias: string;
    model: string;
}) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const err = new Error('Missing OPENAI_API_KEY.');
        (err as any).statusCode = 500;
        throw err;
    }

    const userPrompt = `Create one production-ready prompt for generating an iOS App Store icon.

App name: ${payload.appName || 'Unknown app'}
App alias: ${payload.appAlias || 'Unknown alias'}

Client spec excerpt (first lines only):
${payload.clientSpecLines.map((line, i) => `${i + 1}. ${line}`).join('\n')}

Requirements:
- Return exactly one icon-generation prompt in plain text.
- Keep it concise (about 1-2 sentences).
- Focus on the core app purpose inferred from the excerpt.
- Include visual direction (motif, style, palette, lighting, depth).
- No brand references, no logos, no trademarked names.
- No text, no letters, no numbers inside the icon.
- Do not return explanations, labels, JSON, or markdown.`;

    const requestBody = buildChatCompletionsBody({
        model: payload.model,
        messages: [
            {
                role: 'system',
                content:
                    'You write high-quality icon prompts for image models. Return only the final prompt text.',
            },
            {
                role: 'user',
                content: userPrompt,
            },
        ],
        // Deterministic-safe default for GPT-5 compatibility: no sampling params.
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = normalizeOpenAIChatErrorMessage({
            message: String((data as any)?.error?.message || `OpenAI request failed (${response.status}).`),
            model: payload.model,
            param: String((data as any)?.error?.param || ''),
        }).slice(0, 500);
        const err = new Error(message);
        (err as any).statusCode = response.status;
        throw err;
    }

    const text = sanitizeIconPrompt(coerceTextContent(data));
    if (!text) {
        throw new Error('OpenAI returned empty icon prompt text.');
    }

    return {
        status: 'generated' as const,
        text,
        model: payload.model,
        usedLineCount: payload.clientSpecLines.length,
    };
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { status: 'error', error: 'Method not allowed' });
    }

    const token = extractBearerToken(req.headers?.authorization ?? req.headers?.Authorization);
    if (!token) {
        return json(res, 401, { status: 'error', error: 'Missing bearer token' });
    }

    try {
        const isAuthorized = await verifySupabaseToken(token);
        if (!isAuthorized) {
            return json(res, 401, { status: 'error', error: 'Unauthorized' });
        }

        const body: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const parsed = (body || {}) as Partial<GenerateIconPromptRequestBody>;

        const clientSpec = String(parsed.clientSpec || '').trim();
        const clientSpecLines = pickClientSpecLines(clientSpec);
        const contentChars = clientSpecLines.join(' ').replace(/\s+/g, ' ').trim().length;

        if (!clientSpecLines.length || contentChars < MIN_SPEC_CONTENT_CHARS) {
            return json(res, 200, {
                status: 'skipped_short_spec',
                reason: `Client spec excerpt is too short. Add a clearer app purpose in Step 1 and retry.`,
            });
        }

        const appName = String(parsed.appName || '').trim();
        const appAlias = String(parsed.appAlias || '').trim();
        const model = String(process.env.OPENAI_ICON_PROMPT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

        const generated = await generateWithOpenAI({
            clientSpecLines,
            appName,
            appAlias,
            model,
        });

        return json(res, 200, generated);
    } catch (e: any) {
        const message = String(e?.message || e);
        const status = Number((e as any)?.statusCode || 500);
        return json(res, status, {
            status: 'error',
            error: message || 'Failed to generate icon prompt.',
        });
    }
}
