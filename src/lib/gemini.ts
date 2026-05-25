import { GoogleGenAI } from '@google/genai';

const buildTimeGeminiApiKey = process.env.GEMINI_API_KEY?.trim() || '';

let cachedGeminiApiKey: string | null | undefined;
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
      cachedGeminiApiKey = apiKey || null;
      geminiApiKeyPromise = null;
      return apiKey;
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