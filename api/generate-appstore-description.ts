// Vercel Serverless Function: POST /api/generate-appstore-description
//
// Generates long-form English App Store copy from a client spec.

import {
    analyzeGeneratedDescription,
    analyzeGeneratedKeywords,
    analyzeGeneratedSubtitleOptions,
    APPSTORE_KEYWORDS_LENGTH,
    APPSTORE_SUBTITLE_OPTION_COUNT,
    MAX_APPSTORE_SUBTITLE_LENGTH,
    MIN_CLIENT_SPEC_LENGTH,
    repairGeneratedKeywords,
    sanitizeClientSpecForPrompt,
    sanitizeDescription,
} from '../lib/server/generate-appstore-description.shared.js';

type GenerateAppstoreDescriptionRequestBody = {
    clientSpec: string;
    appStoreName?: string;
    companyName?: string;
    appCategoryHint?: string;
    generateDescription?: boolean;
    existingDescription?: string;
    generateSubtitleOptions?: boolean;
    generateKeywords?: boolean;
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

const wrapNetworkFetchError = (err: unknown, message: string) => {
    const raw = String((err as any)?.message || err || '').trim();
    if (!raw) {
        const wrapped = new Error(message);
        (wrapped as any).statusCode = 502;
        return wrapped;
    }
    if (/fetch failed|networkerror|econnrefused|enotfound|etimedout|socket hang up/i.test(raw)) {
        const wrapped = new Error(message);
        (wrapped as any).statusCode = 502;
        return wrapped;
    }
    return err as Error;
};

const verifySupabaseToken = async (token: string) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    }

    let resp: Response;
    try {
        resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${token}`,
            },
        });
    } catch (err) {
        throw wrapNetworkFetchError(
            err,
            'Failed to reach Supabase auth while verifying the current session. Check VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY and that Supabase is reachable.'
        );
    }

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

const requestOpenAIChatContent = async (payload: {
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}) => {
    let response: Response;
    try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    } catch (err) {
        throw wrapNetworkFetchError(
            err,
            `Failed to reach OpenAI while generating App Store description. Check OPENAI_API_KEY and outbound network access for model "${payload.model}".`
        );
    }

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

    const text = coerceTextContent(data).trim();
    if (!text) {
        const err = new Error('OpenAI returned empty text.');
        (err as any).statusCode = 502;
        throw err;
    }

    return text;
};

const requestOpenAIChat = async (payload: {
    apiKey: string;
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}) => {
    const text = sanitizeDescription(await requestOpenAIChatContent(payload));
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

const extractJsonObject = (value: string) => {
    const source = String(value || '').trim();
    if (!source) return null;

    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1] || source;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;

    try {
        return JSON.parse(candidate.slice(start, end + 1));
    } catch {
        return null;
    }
};

const METADATA_ISSUE_GUIDANCE: Record<string, string> = {
    metadata_json: 'Return valid JSON with exactly two keys: subtitleOptions and keywords.',
    subtitle_count: `Return at least ${APPSTORE_SUBTITLE_OPTION_COUNT} distinct subtitle options.`,
    subtitle_length: `Every subtitle option must be ${MAX_APPSTORE_SUBTITLE_LENGTH} characters or fewer.`,
    keywords_empty: 'Return a non-empty keywords string.',
    keywords_charset: 'Keywords may contain only lowercase letters and commas.',
    keywords_format: 'Each keyword must be one word only, separated by commas, with no spaces or numbers.',
    keywords_length: `The full keywords string must be exactly ${APPSTORE_KEYWORDS_LENGTH} characters, counting commas.`,
};

const formatMetadataIssues = (issues: string[]) =>
    issues.map((issue) => METADATA_ISSUE_GUIDANCE[issue] || `Fix ${issue}.`).join('\n- ');

const buildMetadataPrompt = (payload: {
    clientSpec: string;
    appStoreName: string;
    appCategoryHint: string;
    description: string;
    generateSubtitleOptions: boolean;
    generateKeywords: boolean;
}) => `Return valid JSON with exactly these keys:
${[
    payload.generateSubtitleOptions
        ? `- "subtitleOptions": an array of exactly ${APPSTORE_SUBTITLE_OPTION_COUNT} original App Store subtitles`
        : null,
    payload.generateKeywords ? '- "keywords": one comma-separated keywords string' : null,
]
    .filter(Boolean)
    .join('\n')}

${buildPromptContext({
    appStoreName: payload.appStoreName,
    appCategoryHint: payload.appCategoryHint,
})}

Source material:
- Use the generated App Store description as the main source for tone and meaning.
- Use the client spec only as supporting context.

${payload.generateSubtitleOptions ? `Rules for "subtitleOptions":
- English only.
- Return ${APPSTORE_SUBTITLE_OPTION_COUNT} distinct options.
- Each subtitle must be ${MAX_APPSTORE_SUBTITLE_LENGTH} characters or fewer.
- Make them sound App Store-ready, specific, and original.` : ''}

${payload.generateKeywords ? `Rules for "keywords":
- Lowercase letters and commas only.
- No spaces.
- No numbers.
- Each keyword must be one word only.
- The full string must total exactly ${APPSTORE_KEYWORDS_LENGTH} characters, counting commas.
- Count every character before you answer and adjust until the total is exact.` : ''}

Return JSON only. No markdown, no commentary, no extra keys.

Client spec:
${payload.clientSpec}

Generated App Store description:
${payload.description}`;

const buildMetadataRewritePrompt = (payload: {
    clientSpec: string;
    appStoreName: string;
    appCategoryHint: string;
    description: string;
    draft: string;
    issues: string[];
    generateSubtitleOptions: boolean;
    generateKeywords: boolean;
}) => `Repair this generated App Store metadata output so it fully matches the schema and constraints.

${buildPromptContext({
    appStoreName: payload.appStoreName,
    appCategoryHint: payload.appCategoryHint,
})}

Problems to fix:
- ${formatMetadataIssues(payload.issues)}

Return JSON with exactly these keys:
${[
    payload.generateSubtitleOptions
        ? `- "subtitleOptions": ${APPSTORE_SUBTITLE_OPTION_COUNT} distinct subtitles, each ${MAX_APPSTORE_SUBTITLE_LENGTH} chars max`
        : null,
    payload.generateKeywords
        ? `- "keywords": one lowercase comma-separated string with no spaces or numbers and exactly ${APPSTORE_KEYWORDS_LENGTH} characters`
        : null,
]
    .filter(Boolean)
    .join('\n')}

Return JSON only. No markdown, no commentary.

Client spec:
${payload.clientSpec}

Generated App Store description:
${payload.description}

Current invalid output:
${payload.draft}`;

const repairMetadataDraftKeywords = (
    draft: string,
    payload: {
        clientSpec: string;
        appStoreName: string;
        appCategoryHint: string;
        description: string;
        generateKeywords: boolean;
    }
) => {
    if (!payload.generateKeywords) return draft;

    const parsed = extractJsonObject(draft);
    if (!parsed || typeof parsed !== 'object') return draft;

    const repairedKeywords = repairGeneratedKeywords((parsed as any)?.keywords, [
        payload.description,
        payload.clientSpec,
        payload.appStoreName,
        payload.appCategoryHint,
    ]);

    if (!repairedKeywords) return draft;

    return JSON.stringify({
        ...(parsed as Record<string, unknown>),
        keywords: repairedKeywords,
    });
};

const hasKeywordIssue = (issues: string[]) => issues.some((issue) => String(issue || '').startsWith('keywords_'));

const analyzeMetadataDraft = (
    draft: string,
    options: { generateSubtitleOptions: boolean; generateKeywords: boolean }
) => {
    const parsed = extractJsonObject(draft);
    if (!parsed) {
        return {
            subtitleOptions: [],
            keywords: '',
            issues: ['metadata_json'],
        };
    }
    const subtitleAnalysis = options.generateSubtitleOptions
        ? analyzeGeneratedSubtitleOptions((parsed as any)?.subtitleOptions)
        : { options: [] as string[], issues: [] as string[] };
    const keywordsAnalysis = options.generateKeywords
        ? analyzeGeneratedKeywords((parsed as any)?.keywords)
        : { keywords: '', issues: [] as string[] };

    return {
        subtitleOptions: options.generateSubtitleOptions ? subtitleAnalysis.options : [],
        keywords: options.generateKeywords ? keywordsAnalysis.keywords : '',
        issues: Array.from(new Set([
            ...(options.generateSubtitleOptions ? subtitleAnalysis.issues : []),
            ...(options.generateKeywords ? keywordsAnalysis.issues : []),
        ])),
    };
};

const generateMetadataWithOpenAI = async (payload: {
    clientSpec: string;
    appStoreName: string;
    appCategoryHint: string;
    description: string;
    model: string;
    generateSubtitleOptions: boolean;
    generateKeywords: boolean;
}) => {
    if (!payload.generateSubtitleOptions && !payload.generateKeywords) {
        return {
            subtitleOptions: [] as string[],
            keywords: '',
        };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const err = new Error('Missing OPENAI_API_KEY.');
        (err as any).statusCode = 500;
        throw err;
    }

    const initialDraft = await requestOpenAIChatContent({
        apiKey,
        model: payload.model,
        messages: [
            {
                role: 'system',
                content:
                    'You generate App Store subtitle options and keywords. Always return valid JSON with the requested keys only.',
            },
            {
                role: 'user',
                content: buildMetadataPrompt(payload),
            },
        ],
        temperature: 0.75,
        reasoningEffort: DEFAULT_REASONING_EFFORT,
    });

    let analysis = analyzeMetadataDraft(initialDraft, {
        generateSubtitleOptions: payload.generateSubtitleOptions,
        generateKeywords: payload.generateKeywords,
    });
    let finalDraft = initialDraft;

    if (hasKeywordIssue(analysis.issues)) {
        finalDraft = repairMetadataDraftKeywords(finalDraft, payload);
        analysis = analyzeMetadataDraft(finalDraft, {
            generateSubtitleOptions: payload.generateSubtitleOptions,
            generateKeywords: payload.generateKeywords,
        });
    }

    if (analysis.issues.length > 0) {
        finalDraft = await requestOpenAIChatContent({
            apiKey,
            model: payload.model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You repair invalid App Store subtitle and keyword JSON. Output valid JSON only with the requested keys.',
                },
                {
                    role: 'user',
                    content: buildMetadataRewritePrompt({
                        clientSpec: payload.clientSpec,
                        appStoreName: payload.appStoreName,
                        appCategoryHint: payload.appCategoryHint,
                        description: payload.description,
                        draft: finalDraft,
                        issues: analysis.issues,
                        generateSubtitleOptions: payload.generateSubtitleOptions,
                        generateKeywords: payload.generateKeywords,
                    }),
                },
            ],
            temperature: 0.4,
            reasoningEffort: DEFAULT_REASONING_EFFORT,
        });

        analysis = analyzeMetadataDraft(finalDraft, {
            generateSubtitleOptions: payload.generateSubtitleOptions,
            generateKeywords: payload.generateKeywords,
        });

        if (hasKeywordIssue(analysis.issues)) {
            finalDraft = repairMetadataDraftKeywords(finalDraft, payload);
            analysis = analyzeMetadataDraft(finalDraft, {
                generateSubtitleOptions: payload.generateSubtitleOptions,
                generateKeywords: payload.generateKeywords,
            });
        }
    }

    if (analysis.issues.length > 0) {
        const err = new Error(`Generated subtitle/keywords failed quality checks: ${analysis.issues.join(', ')}.`);
        (err as any).statusCode = 502;
        throw err;
    }

    return {
        subtitleOptions: analysis.subtitleOptions,
        keywords: analysis.keywords,
    };
};

const generateDescriptionWithOpenAI = async (payload: {
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
        text: finalText,
        promptKey: payload.promptKey,
        model: payload.model,
    };
};

const buildGeneratedResponse = (payload: {
    text: string;
    promptKey: string;
    model: string;
    descriptionStatus: 'generated' | 'reused';
    metadataStatus: 'generated' | 'skipped' | 'error';
    subtitleOptions?: string[];
    keywords?: string;
    metadataError?: string | null;
}) => ({
    status: 'generated' as const,
    text: payload.text,
    subtitleOptions: Array.isArray(payload.subtitleOptions) ? payload.subtitleOptions : [],
    keywords: String(payload.keywords || ''),
    promptKey: payload.promptKey,
    model: payload.model,
    descriptionStatus: payload.descriptionStatus,
    metadataStatus: payload.metadataStatus,
    metadataError: String(payload.metadataError || '').trim() || null,
});

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

        const generateDescription = parsed.generateDescription !== false;
        const clientSpec = String(parsed.clientSpec || '').trim();
        if (generateDescription && !clientSpec) {
            return json(res, 400, { status: 'error', error: 'Missing required field: clientSpec.' });
        }

        if (generateDescription && clientSpec.length < MIN_CLIENT_SPEC_LENGTH) {
            return json(res, 200, {
                status: 'skipped_short_spec',
                reason: `Client spec is too short (< ${MIN_CLIENT_SPEC_LENGTH} chars).`,
            });
        }

        const appStoreName = String(parsed.appStoreName || '').trim();
        const appCategoryHint = String(parsed.appCategoryHint || '').trim();
        const existingDescription = sanitizeDescription(parsed.existingDescription || '');
        const generateSubtitleOptions = parsed.generateSubtitleOptions !== false;
        const generateKeywords = parsed.generateKeywords !== false;
        const sanitizedClientSpec = clientSpec ? sanitizeClientSpecForPrompt(clientSpec) : '';

        const model = String(process.env.OPENAI_APPSTORE_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

        if (!generateDescription) {
            if (!existingDescription) {
                return json(res, 400, {
                    status: 'error',
                    error: 'Missing required field: existingDescription for metadata-only generation.',
                });
            }

            if (!generateSubtitleOptions && !generateKeywords) {
                return json(
                    res,
                    200,
                    buildGeneratedResponse({
                        text: existingDescription,
                        promptKey: 'metadata_only',
                        model,
                        descriptionStatus: 'reused',
                        metadataStatus: 'skipped',
                    })
                );
            }

            try {
                const metadata = await generateMetadataWithOpenAI({
                    clientSpec: sanitizedClientSpec,
                    appStoreName,
                    appCategoryHint,
                    description: existingDescription,
                    model,
                    generateSubtitleOptions,
                    generateKeywords,
                });

                return json(
                    res,
                    200,
                    buildGeneratedResponse({
                        text: existingDescription,
                        promptKey: 'metadata_only',
                        model,
                        descriptionStatus: 'reused',
                        metadataStatus: 'generated',
                        subtitleOptions: metadata.subtitleOptions,
                        keywords: metadata.keywords,
                    })
                );
            } catch (err: any) {
                return json(
                    res,
                    200,
                    buildGeneratedResponse({
                        text: existingDescription,
                        promptKey: 'metadata_only',
                        model,
                        descriptionStatus: 'reused',
                        metadataStatus: 'error',
                        metadataError: String(err?.message || 'Failed to generate subtitle or keywords.').slice(0, 500),
                    })
                );
            }
        }

        const promptTemplate = pickPromptTemplate();
        const prompt = promptTemplate.build({
            clientSpec: sanitizedClientSpec,
            appStoreName,
            appCategoryHint,
        });

        const generatedDescription = await generateDescriptionWithOpenAI({
            clientSpec: sanitizedClientSpec,
            appStoreName,
            appCategoryHint,
            model,
            promptKey: promptTemplate.key,
            prompt,
        });

        try {
            const metadata = await generateMetadataWithOpenAI({
                clientSpec: sanitizedClientSpec,
                appStoreName,
                appCategoryHint,
                description: generatedDescription.text,
                model,
                generateSubtitleOptions,
                generateKeywords,
            });

            return json(
                res,
                200,
                buildGeneratedResponse({
                    text: generatedDescription.text,
                    promptKey: generatedDescription.promptKey,
                    model: generatedDescription.model,
                    descriptionStatus: 'generated',
                    metadataStatus: generateSubtitleOptions || generateKeywords ? 'generated' : 'skipped',
                    subtitleOptions: metadata.subtitleOptions,
                    keywords: metadata.keywords,
                })
            );
        } catch (err: any) {
            return json(
                res,
                200,
                buildGeneratedResponse({
                    text: generatedDescription.text,
                    promptKey: generatedDescription.promptKey,
                    model: generatedDescription.model,
                    descriptionStatus: 'generated',
                    metadataStatus: 'error',
                    metadataError: String(err?.message || 'Failed to generate subtitle or keywords.').slice(0, 500),
                })
            );
        }
    } catch (err: any) {
        const status = Number(err?.statusCode) || 500;
        const safeMessage = String(err?.message || 'Server error').slice(0, 500);
        return json(res, status, { status: 'error', error: safeMessage });
    }
}
