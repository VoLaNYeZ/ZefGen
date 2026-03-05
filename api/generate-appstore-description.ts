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
        companyName: string;
        appCategoryHint: string;
    }) => string;
};

const MIN_CLIENT_SPEC_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 4000;
const DEFAULT_MODEL = 'gpt-5-mini';

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

const PROMPT_TEMPLATES: PromptTemplate[] = [
    {
        key: '1',
        build: ({ clientSpec, appStoreName, companyName, appCategoryHint }) => `You are an expert App Store copywriter.

Write one App Store description in English.
App name: ${appStoreName || 'Unknown app'}
Company: ${companyName || 'Unknown company'}
Category hint: ${appCategoryHint || 'General utility'}

Requirements:
- 1200-2200 characters.
- Confident, benefit-driven, conversion-oriented style.
- Start with a strong opening paragraph.
- Then provide a compact feature section with short bullet points using '-' only.
- End with a short trust/closing paragraph.
- No markdown headings, no code fences, no emojis.
- Do not invent legal claims you cannot infer from the spec.

Client spec:
${clientSpec}`,
    },
    {
        key: '2',
        build: ({ clientSpec, appStoreName, companyName, appCategoryHint }) => `Generate a polished App Store description in English for this iOS app.

App: ${appStoreName || 'Unknown app'}
Publisher: ${companyName || 'Unknown company'}
Category hint: ${appCategoryHint || 'General utility'}

Output format requirements:
- Plain text only.
- First paragraph: value proposition and target user.
- Second section: 5-7 bullets with concrete capabilities.
- Third paragraph: why this app is practical for daily use.
- Max length: 4000 characters.
- Avoid repetitive phrases and avoid generic filler.
- No markdown titles, no hashtags, no code blocks.

Client spec:
${clientSpec}`,
    },
    {
        key: '3',
        build: ({ clientSpec, appStoreName, companyName, appCategoryHint }) => `Write an App Store description (English) that sounds premium but clear.

Product name: ${appStoreName || 'Unknown app'}
Service provider: ${companyName || 'Unknown company'}
Category hint: ${appCategoryHint || 'General utility'}

Constraints:
- Use plain text.
- Keep it specific to the provided spec.
- Mention core jobs-to-be-done, primary flows, and outcomes.
- Include a short bullet list of standout features.
- Include a short closing CTA.
- No markdown headings or code fences.
- No unsupported superlatives like "best" or "#1".

Spec to use:
${clientSpec}`,
    },
    {
        key: '4',
        build: ({ clientSpec, appStoreName, companyName, appCategoryHint }) => `Create one English App Store description optimized for readability and trust.

App name: ${appStoreName || 'Unknown app'}
Company: ${companyName || 'Unknown company'}
Category hint: ${appCategoryHint || 'General utility'}

Style guide:
- Use short paragraphs and concise bullets.
- Explain the app's core problem and solution quickly.
- Highlight practical use cases derived from the client spec.
- Keep language natural and non-technical for end users.
- Plain text only, no markdown headings, no fenced blocks.
- Keep under 4000 characters.

Client spec:
${clientSpec}`,
    },
    {
        key: '5',
        build: ({ clientSpec, appStoreName, companyName, appCategoryHint }) => `You are writing final store copy for iOS.

App title: ${appStoreName || 'Unknown app'}
Company title: ${companyName || 'Unknown company'}
Category hint: ${appCategoryHint || 'General utility'}

Produce exactly one App Store description in English with this structure:
1) Hook paragraph.
2) Feature bullets (4-8 lines, '-' prefix only).
3) Closing paragraph with user value and confidence.

Hard rules:
- Output plain text only.
- No markdown headings, no code fences, no HTML.
- Keep tone clear, persuasive, and specific.
- Respect the provided spec and avoid fabricated details.
- Maximum 4000 characters.

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
    companyName: string;
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

    return {
        status: 'generated' as const,
        text,
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
        const companyName = String(parsed.companyName || '').trim();
        const appCategoryHint = String(parsed.appCategoryHint || '').trim();

        const model = String(process.env.OPENAI_APPSTORE_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
        const promptTemplate = pickPromptTemplate();
        const prompt = promptTemplate.build({
            clientSpec,
            appStoreName,
            companyName,
            appCategoryHint,
        });

        const generated = await generateWithOpenAI({
            clientSpec,
            appStoreName,
            companyName,
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
