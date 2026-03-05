// Vercel Serverless Function: POST /api/generate-appstore-description
//
// Generates an English App Store description from client spec with one
// randomly selected prompt variant.

type GenerateAppstoreDescriptionRequestBody = {
    clientSpec: string;
    appStoreName?: string;
    companyName?: string;
    appCategoryHint?: string;
};

type PromptTemplate = {
    key: '1' | '2' | '3' | '4' | '5';
    build: (payload: {
        clientSpec: string;
        appStoreName: string;
        appCategoryHint: string;
    }) => string;
};

const MIN_CLIENT_SPEC_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 4000;
const DEFAULT_MODEL = 'gpt-5-mini';
const SPEC_MAX_CHARS = 8_000;
const SPEC_FALLBACK_CHARS = 4_000;

const json = (res: any, status: number, payload: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-ZefGen-Api', 'generate-appstore-description');
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

const SPEC_EXCLUDE_PATTERNS: RegExp[] = [
    /\b\d+\+?\s*(templates?|variants?|categories?|tones?)\b/i,
    /\b(char|chars|character|characters)\s*(limit|range|count)?\b/i,
    /\bjobs?-to-be-done\b/i,
    /\bplaceholder|fallback|mvp|modal|tab\s*bar|default\b/i,
    /\blocal\s*storage|on-device|device\s*storage|daily\s*limit\b/i,
    /\{(?:name|context|cta|signoff)\}/i,
];

const INTERNAL_LEAK_PATTERNS: RegExp[] = [
    /\b\d+\+?\s*(templates?|variants?|categories?|tones?)\b/i,
    /\bjobs?-to-be-done\b/i,
    /\bplaceholder|fallback|mvp|default true|daily limit\b/i,
    /\{(?:name|context|cta|signoff)\}/i,
    /\bchar(?:acter)?s?\s*[-–]?\s*\d+\b/i,
    /\btab\s*bar|modal|profile injection|flow(s)?\b/i,
];

const sanitizeClientSpecForPrompt = (rawSpec: string) => {
    const source = String(rawSpec || '').replace(/\r/g, '').slice(0, SPEC_MAX_CHARS);
    const lines = source
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !SPEC_EXCLUDE_PATTERNS.some((rx) => rx.test(line)));
    const sanitized = lines.join('\n').slice(0, SPEC_MAX_CHARS).trim();
    if (sanitized.length >= MIN_CLIENT_SPEC_LENGTH) return sanitized;
    return source.slice(0, SPEC_FALLBACK_CHARS).trim();
};

const hasInternalLeakSignals = (text: string) => {
    const value = String(text || '');
    return INTERNAL_LEAK_PATTERNS.some((rx) => rx.test(value));
};

const PROMPT_TEMPLATES: PromptTemplate[] = [
    {
        key: '1',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `You are an elite App Store copywriter for consumer iOS apps.

Write one App Store description in English for this app:
App name: ${appStoreName || 'Unknown app'}
Category hint: ${appCategoryHint || 'General utility'}

Format and quality requirements:
- Audience-first marketing copy only.
- 1 short hook paragraph, then 4-7 simple bullet points, then a short closing line.
- Keep text naturally readable and persuasive, not technical.
- No markdown headings, no numbered sections, no code fences, no emojis.
- Do NOT expose internal implementation details, architecture, counts, fallback logic, defaults, placeholders, or operational limits.
- Do NOT include developer/company identity unless explicitly required by user-facing value.
- Keep under 2200 characters.

Client spec:
${clientSpec}`,
    },
    {
        key: '2',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `Create a conversion-focused App Store description in English.

App: ${appStoreName || 'Unknown app'}
Category hint: ${appCategoryHint || 'General utility'}

Rules:
- Write for end users, not for product managers.
- Focus on outcomes, convenience, and emotional relief.
- Keep it specific but never reveal hidden internal mechanics.
- Never mention counts of templates/tones/categories/variants.
- Never mention placeholders, fallback behavior, character limits, defaults, or technical fields.
- Plain text only with short paragraphs and '-' bullets.

Client spec:
${clientSpec}`,
    },
    {
        key: '3',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `Write premium but simple App Store copy in English.

Product name: ${appStoreName || 'Unknown app'}
Category hint: ${appCategoryHint || 'General utility'}

Constraints:
- Highlight practical user benefits and everyday use cases.
- Keep the tone polished, concise, and trustworthy.
- Avoid business/internal wording and avoid implementation talk.
- No markdown headings or code fences.
- Do not repeat or mirror the spec verbatim.
- Final output should feel like App Store listing text, not a requirements document.

Spec to use:
${clientSpec}`,
    },
    {
        key: '4',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `Create an App Store description in English optimized for clarity and appeal.

App name: ${appStoreName || 'Unknown app'}
Category hint: ${appCategoryHint || 'General utility'}

Style guide:
- Start with a direct value statement.
- Use compact '-' bullet points for key benefits.
- End with a short call-to-action sentence.
- Keep language simple and human, no product-management jargon.
- Exclude internal details, thresholds, defaults, and behind-the-scenes mechanics.
- Plain text only.

Client spec:
${clientSpec}`,
    },
    {
        key: '5',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `You are writing final iOS App Store description copy.

App title: ${appStoreName || 'Unknown app'}
Category hint: ${appCategoryHint || 'General utility'}

Output structure:
1) Strong opening sentence/paragraph.
2) 4-7 bullets of user-facing benefits and scenarios.
3) Short closing line.

Hard rules:
- Plain text only (no headings, no code fences, no HTML).
- No technical or internal leakage from source spec.
- No “MVP”, “jobs-to-be-done”, placeholder syntax, counts, defaults, limits, or implementation notes.
- No company/developer naming unless strictly necessary for end users.
- Keep it concise and natural.

Client spec:
${clientSpec}`,
    },
];

const pickPromptTemplate = () => {
    const idx = Math.floor(Math.random() * PROMPT_TEMPLATES.length);
    return PROMPT_TEMPLATES[idx] || PROMPT_TEMPLATES[0];
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

const sanitizeDescription = (value: string) => {
    let out = String(value || '').trim();

    // Remove fenced wrappers if model still emitted markdown.
    out = out.replace(/^```[a-zA-Z0-9_-]*\s*/i, '').replace(/\s*```$/i, '').trim();

    // Drop markdown heading prefixes.
    out = out
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, ''))
        .join('\n')
        .trim();

    if (out.length > MAX_DESCRIPTION_LENGTH) {
        out = out.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
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
    clientSpec: string;
    appStoreName: string;
    appCategoryHint: string;
    model: string;
    promptKey: PromptTemplate['key'];
    prompt: string;
}) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const err = new Error('Missing OPENAI_API_KEY.');
        (err as any).statusCode = 500;
        throw err;
    }

    const requestBody = buildChatCompletionsBody({
        model: payload.model,
        messages: [
            {
                role: 'system',
                content:
                    'You write production-ready App Store descriptions in plain English text. Return only the final description text.',
            },
            {
                role: 'user',
                content: payload.prompt,
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

    const text = sanitizeDescription(coerceTextContent(data));
    if (!text) {
        throw new Error('OpenAI returned empty description text.');
    }

    let finalText = text;
    if (hasInternalLeakSignals(finalText)) {
        const rewriteBody = buildChatCompletionsBody({
            model: payload.model,
            messages: [
                {
                    role: 'system',
                    content:
                        'Rewrite App Store descriptions into consumer-facing copy only. Remove all internal product details and technical disclosures. Output only final plain text.',
                },
                {
                    role: 'user',
                    content: `Rewrite this draft for App Store users.

App: ${payload.appStoreName || 'Unknown app'}
Category hint: ${payload.appCategoryHint || 'General utility'}

Rewrite rules:
- Keep only user-facing value and core benefits.
- Remove internal details (counts, limits, defaults, placeholders, fallback logic, architecture, internal field names, implementation notes).
- Keep plain text with short paragraphs and optional '-' bullets.
- Keep it concise and natural.

Draft:
${finalText}`,
                },
            ],
        });

        const rewriteResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(rewriteBody),
        });
        const rewriteData = await rewriteResp.json().catch(() => ({}));
        if (rewriteResp.ok) {
            const rewritten = sanitizeDescription(coerceTextContent(rewriteData));
            if (rewritten) {
                finalText = rewritten;
            }
        }
    }

    return {
        status: 'generated' as const,
        text: finalText,
        promptKey: payload.promptKey,
        model: payload.model,
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
        const parsed = (body || {}) as Partial<GenerateAppstoreDescriptionRequestBody>;

        const clientSpec = String(parsed.clientSpec || '').trim();
        if (!clientSpec) {
            return json(res, 400, { status: 'error', error: 'Missing required field: clientSpec.' });
        }

        if (clientSpec.length < MIN_CLIENT_SPEC_LENGTH) {
            return json(res, 200, {
                status: 'skipped_short_spec',
                reason: `Client spec is too short (< ${MIN_CLIENT_SPEC_LENGTH} chars).`,
            });
        }

        const appStoreName = String(parsed.appStoreName || '').trim();
        const appCategoryHint = String(parsed.appCategoryHint || '').trim();
        const sanitizedClientSpec = sanitizeClientSpecForPrompt(clientSpec);

        const model = String(process.env.OPENAI_APPSTORE_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
        const promptTemplate = pickPromptTemplate();
        const prompt = promptTemplate.build({
            clientSpec: sanitizedClientSpec,
            appStoreName,
            appCategoryHint,
        });

        const generated = await generateWithOpenAI({
            clientSpec: sanitizedClientSpec,
            appStoreName,
            appCategoryHint,
            model,
            promptKey: promptTemplate.key,
            prompt,
        });

        return json(res, 200, generated);
    } catch (err: any) {
        const status = Number(err?.statusCode) || 500;
        const safeMessage = String(err?.message || 'Server error').slice(0, 500);
        return json(res, status, { status: 'error', error: safeMessage });
    }
}
