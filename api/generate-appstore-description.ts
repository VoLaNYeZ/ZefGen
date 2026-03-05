// Vercel Serverless Function: POST /api/generate-appstore-description
//
// Generates long-form English App Store copy from a client spec.

import {
    analyzeGeneratedDescription,
    MIN_CLIENT_SPEC_LENGTH,
    sanitizeClientSpecForPrompt,
    sanitizeDescription,
} from './generate-appstore-description.shared.js';

type GenerateAppstoreDescriptionRequestBody = {
    clientSpec: string;
    appStoreName?: string;
    companyName?: string;
    appCategoryHint?: string;
};

type PromptTemplate = {
    key: 'premium_narrative' | 'day_in_life' | 'clarity_depth';
    build: (payload: {
        clientSpec: string;
        appStoreName: string;
        appCategoryHint: string;
    }) => string;
};

type ChatMessage = {
    role: 'system' | 'user';
    content: string;
};

const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_REASONING_EFFORT = 'none' as const;
const DEFAULT_TEMPERATURE = 0.85;

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

const buildPromptContext = (payload: { appStoreName: string; appCategoryHint: string }) => {
    const lines = [`App name: ${payload.appStoreName || 'Unknown app'}`];
    if (isNonEmptyString(payload.appCategoryHint)) {
        lines.push(`Category hint: ${payload.appCategoryHint}`);
    }
    return lines.join('\n');
};

const COMMON_PROMPT_RULES = `Non-negotiable rules:
- Plain text only.
- Write 2 to 4 substantial paragraphs.
- Target 1500 to 2800 characters and stay under 4000 characters.
- Paragraph-first structure. Do not default to bullets.
- Use bullets only if the app clearly has a tight cluster of standout benefits that truly reads better as one short middle list.
- If you use bullets, keep them to a single middle block with 2 to 4 bullets maximum.
- Never force a closing CTA and never end with lines like "Download the app", "Get started today", or "Install now".
- Make the closing paragraph specific and value-driven instead of slogan-like.
- Keep the copy consumer-facing: outcomes, routines, use cases, and emotional payoff.
- Do not mention internal planning language, prompt notes, implementation details, fallback behavior, thresholds, placeholders, or hidden mechanics.
- Do not mirror the spec verbatim.`;

const PROMPT_TEMPLATES: PromptTemplate[] = [
    {
        key: 'premium_narrative',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `You are an elite App Store copywriter for consumer iOS apps.

Write one final App Store description in English that feels premium, vivid, and specific.

${buildPromptContext({ appStoreName, appCategoryHint })}

${COMMON_PROMPT_RULES}

Shape:
- Open with a confident paragraph that explains the app's core value in real user language.
- Use the middle section to expand on concrete scenarios, habits, or transformations the app supports.
- Close with a grounded paragraph that reinforces why the experience matters, without turning into a slogan.

Client spec:
${clientSpec}`,
    },
    {
        key: 'day_in_life',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `Write long-form App Store copy in English that feels natural, human, and easy to trust.

${buildPromptContext({ appStoreName, appCategoryHint })}

${COMMON_PROMPT_RULES}

Angle:
- Show how the app fits into a person's day or routine.
- Translate features into relief, momentum, confidence, convenience, or clarity.
- Keep the details concrete enough to feel real, but never technical.

Client spec:
${clientSpec}`,
    },
    {
        key: 'clarity_depth',
        build: ({ clientSpec, appStoreName, appCategoryHint }) => `Create a polished App Store description in English that balances specific feature clarity with emotional appeal.

${buildPromptContext({ appStoreName, appCategoryHint })}

${COMMON_PROMPT_RULES}

Editorial focus:
- Make the first paragraph immediately understandable.
- Use the middle section to reveal depth without sounding like a spec sheet.
- End with a calm, credible closing paragraph that leaves the user with a concrete sense of value.

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

const isGpt5FamilyModel = (model: string) => /^gpt-5(?:[.-]|$)/i.test(String(model || '').trim());

const canUseChatSampling = (model: string, reasoningEffort?: 'none' | 'low' | 'medium' | 'high') => {
    const normalized = String(model || '').trim().toLowerCase();
    if (!normalized) return false;
    if (!normalized.startsWith('gpt-5')) return true;
    const supportsSampling = /^gpt-5\.(1|2|4)(?:$|[-:.])/.test(normalized);
    return supportsSampling && reasoningEffort === 'none';
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
    const detectedParam = (
        hintedParam || raw.match(/\b(temperature|top_p|logprobs|frequency_penalty|presence_penalty)\b/i)?.[1] || ''
    ).trim();
    const looksUnsupported = /isn'?t available|not supported|unsupported|does not support/i.test(raw);
    if (detectedParam && looksUnsupported) {
        return `OpenAI model "${payload.model}" does not support "${detectedParam}" for Chat Completions. Use a GPT-5-compatible payload with reasoning_effort='none' on gpt-5.1, gpt-5.2, or gpt-5.4.`;
    }
    if (isGpt5FamilyModel(payload.model) && /temperature|top_p|logprobs|frequency_penalty|presence_penalty/i.test(raw)) {
        return `OpenAI model "${payload.model}" rejected a sampling parameter. GPT-5 Chat Completions should omit sampling params unless reasoning_effort='none' on gpt-5.1, gpt-5.2, or gpt-5.4.`;
    }
    return raw;
};

const requestOpenAIChat = async (payload: {
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${payload.apiKey}`,
        },
        body: JSON.stringify(
            buildChatCompletionsBody({
                model: payload.model,
                messages: payload.messages,
                temperature: payload.temperature,
                reasoningEffort: payload.reasoningEffort,
            })
        ),
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
        const err = new Error('OpenAI returned empty description text.');
        (err as any).statusCode = 502;
        throw err;
    }

    return text;
};

const ISSUE_GUIDANCE: Record<string, string> = {
    too_short: 'Expand the copy to at least 1500 characters with richer detail, use cases, and benefits.',
    too_few_paragraphs: 'Restructure the draft into at least 2 substantial paragraphs.',
    too_many_paragraphs: 'Consolidate the draft into no more than 4 substantial paragraphs.',
    bullet_heavy: 'Replace most bullets with flowing prose. Keep at most one short middle bullet block only if it adds real clarity.',
    generic_cta: 'Remove generic CTA endings like "Download the app" and replace them with a grounded value-driven closing paragraph.',
    internal_leak: 'Remove any internal, planning, or implementation wording so the copy reads only as user-facing App Store text.',
    empty: 'Rewrite the description into a complete final draft.',
};

const formatValidationIssues = (issues: string[]) =>
    issues.map((issue) => ISSUE_GUIDANCE[issue] || `Fix ${issue}.`).join('\n- ');

const buildRewritePrompt = (payload: {
    clientSpec: string;
    appStoreName: string;
    appCategoryHint: string;
    draft: string;
    issues: string[];
}) => `Rewrite this App Store description so it passes editorial review.

${buildPromptContext({
    appStoreName: payload.appStoreName,
    appCategoryHint: payload.appCategoryHint,
})}

Problems to fix:
- ${formatValidationIssues(payload.issues)}

Rewrite rules:
- Return plain English text only.
- End with 2 to 4 substantial paragraphs.
- Stay above 1500 characters and under 4000 characters.
- Do not default to bullets. If a bullet list is truly necessary, keep one short middle list only.
- Remove internal/product-management wording and all generic CTA language.
- Keep the copy persuasive, readable, and grounded in real user value.

Client spec:
${payload.clientSpec}

Draft:
${payload.draft}`;

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

    const initialText = await requestOpenAIChat({
        apiKey,
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
        temperature: DEFAULT_TEMPERATURE,
        reasoningEffort: DEFAULT_REASONING_EFFORT,
    });

    let analysis = analyzeGeneratedDescription(initialText);
    let finalText = analysis.text;

    if (analysis.issues.length > 0) {
        const rewritten = await requestOpenAIChat({
            apiKey,
            model: payload.model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You repair App Store descriptions that are too short, too templated, too bullet-heavy, or too generic. Output only the final plain-text description.',
                },
                {
                    role: 'user',
                    content: buildRewritePrompt({
                        clientSpec: payload.clientSpec,
                        appStoreName: payload.appStoreName,
                        appCategoryHint: payload.appCategoryHint,
                        draft: finalText,
                        issues: analysis.issues,
                    }),
                },
            ],
            temperature: 0.72,
            reasoningEffort: DEFAULT_REASONING_EFFORT,
        });

        analysis = analyzeGeneratedDescription(rewritten);
        finalText = analysis.text;
    }

    if (analysis.issues.length > 0) {
        const err = new Error(`Generated description failed quality checks: ${analysis.issues.join(', ')}.`);
        (err as any).statusCode = 502;
        throw err;
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
