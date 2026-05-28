import { GoogleGenAI } from '@google/genai';

const buildTimeGeminiApiKey = process.env.GEMINI_API_KEY?.trim() || '';

let cachedGeminiApiKey: string | undefined;
let geminiApiKeyPromise: Promise<string> | null = null;

export const geminiSetupGuideMarkdown = `### Need a Gemini API key?

Get a free standalone key from [Google AI Studio](https://aistudio.google.com/app/apikey). Google's free tier is enough for local use and light public demos.

### Configure without changing code

This app only needs the \`GEMINI_API_KEY\` environment variable.

### Local development

Create a \`.env\` file in the project root and do not commit it:

\`\`\`text
GEMINI_API_KEY=your_actual_api_key
\`\`\`

Then restart \`npm run dev\`.

### Cloud deployment

For Cloud Run, a VPS, or a container platform, add \`GEMINI_API_KEY\` in the platform environment variables and start the app with \`npm run start\`. The Express server reads it at runtime and passes it through to the browser client.`;

export const geminiSetupGuideText = [
  'Need a Gemini API key?',
  '',
  'Get a free standalone key from Google AI Studio:',
  'https://aistudio.google.com/app/apikey',
  '',
  "Google's free tier is enough for local use and light public demos.",
  '',
  'Configure without changing code:',
  'Set the GEMINI_API_KEY environment variable.',
  '',
  'Local development:',
  'Create a .env file in the project root and do not commit it.',
  'GEMINI_API_KEY=your_actual_api_key',
  'Then restart npm run dev.',
  '',
  'Cloud deployment:',
  'On Cloud Run, a VPS, or a container platform, add GEMINI_API_KEY in environment variables and start the app with npm run start.',
].join('\n');

export const missingGeminiApiKeyMessage = geminiSetupGuideMarkdown;

function normalizeGeminiApiKey(apiKey?: string | null) {
  return apiKey?.trim() || '';
}

function readGeminiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause;
    const causeMessage = cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : '';

    return [error.message, causeMessage].filter(Boolean).join(' | ');
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error);
}

function readGeminiErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }

  return typeof error.status === 'number' ? error.status : undefined;
}

export function buildGeminiErrorMessage(error: unknown, actionLabel = 'Gemini request') {
  const rawMessage = readGeminiErrorMessage(error).trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const status = readGeminiErrorStatus(error);
  const rawDetail = rawMessage ? ` Raw error: ${rawMessage}` : '';

  if (
    status === 401
    || status === 403
    || normalizedMessage.includes('api key')
    || normalizedMessage.includes('unauthorized')
    || normalizedMessage.includes('permission denied')
    || normalizedMessage.includes('authentication')
  ) {
    return `${actionLabel} failed because Gemini rejected the API key or this key does not have access. Check GEMINI_API_KEY in .env or your deployment environment, then try again.${rawDetail}`;
  }

  if (
    status === 429
    || normalizedMessage.includes('quota')
    || normalizedMessage.includes('rate limit')
    || normalizedMessage.includes('resource has been exhausted')
  ) {
    return `${actionLabel} failed because the Gemini API quota or rate limit was exceeded. Wait a moment and verify the quota for this key before retrying.${rawDetail}`;
  }

  if (
    normalizedMessage.includes('fetch failed')
    || normalizedMessage.includes('failed to fetch')
    || normalizedMessage.includes('network')
    || normalizedMessage.includes('enotfound')
    || normalizedMessage.includes('econnrefused')
    || normalizedMessage.includes('timed out')
    || normalizedMessage.includes('timeout')
    || status === 503
    || status === 504
  ) {
    return `${actionLabel} failed before Gemini returned a response. Check whether this machine can reach generativelanguage.googleapis.com:443 and whether a firewall, proxy, VPN, or regional restriction is blocking outbound HTTPS.${rawDetail}`;
  }

  if (
    status === 404
    || (normalizedMessage.includes('model') && normalizedMessage.includes('not found'))
    || normalizedMessage.includes('unsupported model')
    || normalizedMessage.includes('model is not found')
  ) {
    return `${actionLabel} failed because the configured Gemini model is unavailable for this key, SDK version, or region.${rawDetail}`;
  }

  if (
    status === 400
    || normalizedMessage.includes('invalid argument')
    || normalizedMessage.includes('bad request')
  ) {
    return `${actionLabel} failed because Gemini rejected the request payload.${rawDetail}`;
  }

  if (status !== undefined && status >= 500) {
    return `${actionLabel} failed because the Gemini service returned a server-side error.${rawDetail}`;
  }

  return `${actionLabel} failed.${rawDetail || ' No additional error details were returned.'}`;
}

async function fetchRuntimeGeminiApiKey() {
  if (typeof window === 'undefined') {
    return buildTimeGeminiApiKey;
  }

  try {
    const response = await fetch('/api/runtime-config', { cache: 'no-store' });
    if (!response.ok) {
      return buildTimeGeminiApiKey;
    }

    const data = await response.json() as { geminiApiKey?: string };
    return normalizeGeminiApiKey(data.geminiApiKey) || buildTimeGeminiApiKey;
  } catch {
    return buildTimeGeminiApiKey;
  }
}

export function getGeminiApiKey() {
  if (cachedGeminiApiKey !== undefined) {
    return normalizeGeminiApiKey(cachedGeminiApiKey);
  }

  return buildTimeGeminiApiKey;
}

export async function loadGeminiApiKey() {
  if (cachedGeminiApiKey !== undefined) {
    return normalizeGeminiApiKey(cachedGeminiApiKey);
  }

  if (!geminiApiKeyPromise) {
    geminiApiKeyPromise = fetchRuntimeGeminiApiKey().then((apiKey) => {
      const normalizedApiKey = normalizeGeminiApiKey(apiKey);
      cachedGeminiApiKey = normalizedApiKey || undefined;
      geminiApiKeyPromise = null;
      return normalizedApiKey;
    });
  }

  return geminiApiKeyPromise;
}

export async function createGeminiClient() {
  const apiKey = await loadGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}