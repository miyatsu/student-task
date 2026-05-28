import type {
  AiChatRequestBody,
  AiRequestFile,
  AiTextResponse,
  LocalImageOcrRuntimeSummary,
  RuntimeConfig,
} from './ai-types';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_ORDER,
  AI_PROVIDER_SUPPORTS_VISION,
} from './ai-types';

let cachedRuntimeConfig: RuntimeConfig | undefined;
let runtimeConfigPromise: Promise<RuntimeConfig> | null = null;

function buildDefaultLocalImageOcrRuntime(): LocalImageOcrRuntimeSummary {
  return {
    engine: 'PaddleOCR',
    available: false,
    offlineReady: false,
    detail: 'Local PaddleOCR image OCR is not ready yet.',
  };
}

function buildDefaultRuntimeConfig(): RuntimeConfig {
  return {
    aiProviders: AI_PROVIDER_ORDER.map((id) => ({
      id,
      label: AI_PROVIDER_LABELS[id],
      configured: false,
      supportsVision: AI_PROVIDER_SUPPORTS_VISION[id],
    })),
    localImageOcr: buildDefaultLocalImageOcrRuntime(),
  };
}

export const aiSetupGuideMarkdown = `### Need an AI API key?

This workspace automatically uses the first available AI provider in this order: Gemini, OpenAI, then DeepSeek.

You can enable the assistant by configuring any one of these environment variables:

- \`GEMINI_API_KEY\` from [Google AI Studio](https://aistudio.google.com/app/apikey)
- \`OPENAI_API_KEY\` from [OpenAI Platform](https://platform.openai.com/api-keys)
- \`DEEPSEEK_API_KEY\` from [DeepSeek Platform](https://platform.deepseek.com/api_keys)

### Local development

Create a \`.env\` file in the project root and do not commit it:

\`\`\`text
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
\`\`\`

You can set just one key or multiple keys. When multiple keys are present, the app tries Gemini first, then OpenAI, then DeepSeek, and uses the first provider that can complete the request.

### Cloud deployment

For Cloud Run, a VPS, or a container platform, add the same environment variables on the server side and start the app with \`npm run start\`. The browser only talks to the local /api/ai/* gateway; the raw provider keys stay on the server.

### Image OCR

Image OCR is local-first and does not use these AI API keys. It runs through a local PaddleOCR runtime that is bootstrapped during \`npm install\`.`;

export const aiSetupGuideText = [
  'Need an AI API key?',
  '',
  'This workspace automatically tries AI providers in this order:',
  '1. Gemini',
  '2. OpenAI / ChatGPT',
  '3. DeepSeek',
  '',
  'Configure any one or more of these environment variables:',
  'GEMINI_API_KEY  -> https://aistudio.google.com/app/apikey',
  'OPENAI_API_KEY  -> https://platform.openai.com/api-keys',
  'DEEPSEEK_API_KEY -> https://platform.deepseek.com/api_keys',
  '',
  'Create a .env file in the project root and do not commit it.',
  'The app tries Gemini first, then OpenAI, then DeepSeek.',
].join('\n');

export const localImageOcrSetupText = [
  'Local image OCR is not ready yet.',
  '',
  'This workspace uses a local PaddleOCR runtime for image text extraction.',
  'No AI API key is required for image OCR.',
  '',
  'To set it up:',
  '1. Install Python 3.9 or newer on this machine.',
  '2. Run npm install from the project root, or rerun npm run setup:ocr.',
  '3. Retry the OCR action after the setup completes.',
  '',
  'The setup step downloads the local OCR runtime and warms the offline models so image OCR can keep working without network access afterward.',
].join('\n');

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error);
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  try {
    const data = await response.json() as { error?: string };
    throw new Error(data.error || fallbackMessage);
  } catch (error) {
    const message = readErrorMessage(error);
    throw new Error(message || fallbackMessage);
  }
}

async function fetchRuntimeConfig() {
  try {
    const response = await fetch('/api/runtime-config', { cache: 'no-store' });
    return await readJsonResponse<RuntimeConfig>(response, 'Failed to load AI runtime configuration.');
  } catch {
    return buildDefaultRuntimeConfig();
  }
}

export function isAiConfigured(runtimeConfig: RuntimeConfig | undefined) {
  return Boolean(runtimeConfig?.aiProviders.some((provider) => provider.configured));
}

export function isLocalImageOcrAvailable(runtimeConfig: RuntimeConfig | undefined) {
  return Boolean(runtimeConfig?.localImageOcr.available && runtimeConfig.localImageOcr.offlineReady);
}

function shouldCacheRuntimeConfig(runtimeConfig: RuntimeConfig) {
  return isAiConfigured(runtimeConfig) || isLocalImageOcrAvailable(runtimeConfig);
}

export function getAiRuntimeConfig() {
  return cachedRuntimeConfig;
}

export async function loadAiRuntimeConfig() {
  if (cachedRuntimeConfig && shouldCacheRuntimeConfig(cachedRuntimeConfig)) {
    return cachedRuntimeConfig;
  }

  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetchRuntimeConfig().then((runtimeConfig) => {
      cachedRuntimeConfig = shouldCacheRuntimeConfig(runtimeConfig) ? runtimeConfig : undefined;
      runtimeConfigPromise = null;
      return runtimeConfig;
    });
  }

  return runtimeConfigPromise;
}

function buildLocalGatewayErrorMessage(actionLabel: string, gatewayLabel: string) {
  return `${actionLabel} failed because the local ${gatewayLabel} could not be reached. Ensure this workspace is running through npm run dev or npm run start, then retry.`;
}

async function postJson<TResponse>(
  url: string,
  body: unknown,
  actionLabel: string,
  gatewayLabel = 'AI gateway',
) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return await readJsonResponse<TResponse>(response, `${actionLabel} failed.`);
  } catch (error) {
    const message = readErrorMessage(error).trim();
    if (!message || message === 'Failed to fetch' || message === 'fetch failed') {
      throw new Error(buildLocalGatewayErrorMessage(actionLabel, gatewayLabel));
    }

    throw new Error(message);
  }
}

export async function requestAiAssistantReply(request: AiChatRequestBody) {
  const response = await postJson<AiTextResponse>('/api/ai/chat', request, 'AI assistant request');
  return response.text;
}

export async function extractImageTextWithLocalOcr(file: AiRequestFile) {
  const response = await postJson<AiTextResponse>('/api/ocr/image', { file }, 'Image OCR request', 'OCR gateway');
  return response.text;
}

export const extractImageTextWithAi = extractImageTextWithLocalOcr;