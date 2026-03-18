// Vercel Serverless Function: POST /api/generate-screenshot-prompts
//
// Generates an inferred app theme plus screenshot titles for No Brand slot prompts.

import {
    sanitizeClientSpecForPrompt,
} from '../lib/server/generate-appstore-description.shared.js';
import { SCREENSHOT_PROMPT_AUTOGEN_MIN_SPEC_LENGTH } from '../utils/screenshot-prompt-workflow.js';

type GenerateScreenshotPromptsRequestBody = {
    clientSpec: string;
    appName?: string;
    appAlias?: string;
    slotCount: number;
};

const DEFAULT_MODEL = 'gpt-5.2';
const MAX_THEME_LENGTH = 80;
const MAX_TITLE_LENGTH = 80;

const json = (res: any, status: number, payload: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-ZefGen-Api', 'generate-screenshot-prompts');
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

type ChatMessage = {
    role: 'system' | 'user';
    content: string;
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

const normalizeTextToken = (value: unknown, maxLength: number) => {
    const normalized = String(value || '')
        .replace(/^['"`“”]+/, '')
        .replace(/['"`“”]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return normalized.slice(0, maxLength).trimEnd();
};

const sanitizeGeneratedPayload = (raw: any, slotCount: number) => {
    const appTheme = normalizeTextToken(raw?.appTheme, MAX_THEME_LENGTH);
    const titles = Array.isArray(raw?.titles)
        ? raw.titles.map((item: unknown) => normalizeTextToken(item, MAX_TITLE_LENGTH)).filter(Boolean)
        : [];

    if (!appTheme) {
        throw new Error('OpenAI returned an empty app theme.');
    }

    if (titles.length < slotCount) {
        throw new Error(`OpenAI returned ${titles.length} titles, but ${slotCount} are required.`);
    }

    return {
        appTheme,
        titles: titles.slice(0, slotCount),
    };
};

const generateWithOpenAI = async (payload: {
    clientSpec: string;
    appName: string;
    appAlias: string;
    slotCount: number;
    model: string;
}) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const err = new Error('Missing OPENAI_API_KEY.');
        (err as any).statusCode = 500;
        throw err;
    }

    const userPrompt = `Return JSON with exactly two keys:
- "appTheme": a short visual theme phrase for a premium Apple App Store screenshot background, based on the app description
- "titles": an array of exactly ${payload.slotCount} short screenshot titles

App name: ${payload.appName || 'Unknown app'}
App alias: ${payload.appAlias || 'Unknown alias'}
Required slot count: ${payload.slotCount}

Client spec:
${payload.clientSpec}

Rules:
- Return valid JSON only.
- "appTheme" must be 2 to 6 words, no sentence punctuation.
- Each title must be short, concrete, and high-converting for an App Store screenshot.
- Each title should usually fit in 1 to 2 lines on an iPhone screenshot.
- Titles must be distinct from each other.
- Do not include numbering, markdown, commentary, or extra keys.`;

    const requestBody = buildChatCompletionsBody({
        model: payload.model,
        messages: [
            {
                role: 'system',
                content:
                    'You create concise App Store screenshot concepts and always return valid JSON with the requested schema.',
            },
            {
                role: 'user',
                content: userPrompt,
            },
        ],
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

    const content = coerceTextContent(data);
    const parsed = extractJsonObject(content);
    if (!parsed) {
        throw new Error('OpenAI returned invalid JSON for screenshot prompts.');
    }

    const sanitized = sanitizeGeneratedPayload(parsed, payload.slotCount);

    return {
        status: 'generated' as const,
        appTheme: sanitized.appTheme,
        titles: sanitized.titles,
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
        const parsed = (body || {}) as Partial<GenerateScreenshotPromptsRequestBody>;

        const sanitizedClientSpec = sanitizeClientSpecForPrompt(String(parsed.clientSpec || ''));
        const slotCount = Math.min(6, Math.max(3, Number(parsed.slotCount) || 0));
        if (!sanitizedClientSpec || sanitizedClientSpec.length < SCREENSHOT_PROMPT_AUTOGEN_MIN_SPEC_LENGTH) {
            return json(res, 200, {
                status: 'skipped_short_spec',
                reason: `Client spec is too short. Add more product detail and retry.`,
            });
        }

        if (slotCount < 3 || slotCount > 6) {
            return json(res, 400, { status: 'error', error: 'slotCount must be between 3 and 6.' });
        }

        const appName = String(parsed.appName || '').trim();
        const appAlias = String(parsed.appAlias || '').trim();
        const model =
            String(process.env.OPENAI_SCREENSHOT_PROMPT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

        const generated = await generateWithOpenAI({
            clientSpec: sanitizedClientSpec,
            appName,
            appAlias,
            slotCount,
            model,
        });

        return json(res, 200, generated);
    } catch (err: any) {
        const statusCode = Number(err?.statusCode) || 500;
        const message = String(err?.message || 'Failed to generate screenshot prompts.').slice(0, 500);
        return json(res, statusCode, {
            status: 'error',
            error: message,
        });
    }
}
