import { GoogleGenAI } from '@google/genai';

import type {
  AiChatMessage,
  AiChatRequestBody,
  AiProviderId,
  AiRequestFile,
  AiOcrRequestBody,
} from '../lib/ai-types';
import { AI_PROVIDER_ORDER } from '../lib/ai-types';
import { getConfiguredAiProviders, getProviderApiKey } from './runtime-config';

const GEMINI_CHAT_MODEL = 'gemini-3.1-pro-preview';
const OPENAI_CHAT_MODEL = 'gpt-4.1-mini';
const DEEPSEEK_CHAT_MODEL = 'deepseek-chat';
const MAX_TEXT_CHARS_PER_FILE = 20_000;
const MAX_PDF_PAGES = 20;

type AiFailureKind = 'auth' | 'quota' | 'network' | 'model' | 'bad-request' | 'unsupported' | 'service' | 'unknown';

export class AiRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'ai-request-invalid') {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
    this.code = code;
  }
}

interface AiProviderFailure {
  providerId: AiProviderId;
  kind: AiFailureKind;
}

interface PreparedReferenceContext {
  textFiles: Array<{ name: string; text: string }>;
  imageFiles: Array<{ name: string; dataUrl: string }>;
}

type ChatProviderExecutor = (request: AiChatRequestBody, apiKey: string) => Promise<string>;
type OcrProviderExecutor = (request: AiOcrRequestBody, apiKey: string) => Promise<string>;

interface AiExecutionDependencies {
  env?: Partial<Pick<NodeJS.ProcessEnv, 'GEMINI_API_KEY' | 'OPENAI_API_KEY' | 'DEEPSEEK_API_KEY'>>;
  chatExecutors?: Partial<Record<AiProviderId, ChatProviderExecutor>>;
  ocrExecutors?: Partial<Record<AiProviderId, OcrProviderExecutor>>;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureRecord(value: unknown, message: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiRequestError(message);
  }

  return value as Record<string, unknown>;
}

function normalizeAiFile(value: unknown, fieldLabel: string): AiRequestFile {
  const record = ensureRecord(value, `${fieldLabel} is malformed.`);
  const data = normalizeString(record.data);
  const mimeType = normalizeString(record.mimeType);
  const name = normalizeString(record.name) || 'file';

  if (!data) {
    throw new AiRequestError(`${fieldLabel} is missing base64 data.`);
  }

  if (!mimeType) {
    throw new AiRequestError(`${fieldLabel} is missing a MIME type.`);
  }

  return { data, mimeType, name };
}

function normalizeAiMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AiChatMessage[];
  }

  return value.map((message, index) => {
    const record = ensureRecord(message, `messages[${index}] is malformed.`);
    const role = record.role;
    const text = normalizeString(record.text);

    if (role !== 'user' && role !== 'model') {
      throw new AiRequestError(`messages[${index}] has an unsupported role.`);
    }

    if (!text) {
      throw new AiRequestError(`messages[${index}] is missing text.`);
    }

    return {
      role: role as AiChatMessage['role'],
      text,
    };
  });
}

function normalizeAiChatRequest(body: unknown): AiChatRequestBody {
  const record = ensureRecord(body, 'AI assistant request body is malformed.');
  const prompt = normalizeString(record.prompt);

  if (!prompt) {
    throw new AiRequestError('AI assistant request is missing the prompt text.');
  }

  const files = Array.isArray(record.files)
    ? record.files.map((file, index) => normalizeAiFile(file, `files[${index}]`))
    : [];

  return {
    prompt,
    messages: normalizeAiMessages(record.messages),
    files,
  };
}

function normalizeAiOcrRequest(body: unknown): AiOcrRequestBody {
  const record = ensureRecord(body, 'AI OCR request body is malformed.');
  const file = normalizeAiFile(record.file, 'file');

  if (!file.mimeType.startsWith('image/')) {
    throw new AiRequestError('AI OCR currently only accepts image files.');
  }

  return { file };
}

function decodeBase64ToUtf8(data: string) {
  return Buffer.from(data, 'base64').toString('utf-8');
}

function toUint8Array(data: string) {
  const buffer = Buffer.from(data, 'base64');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function buildDataUrl(file: AiRequestFile) {
  return `data:${file.mimeType};base64,${file.data}`;
}

function truncateText(text: string) {
  const normalized = text.trim();
  if (normalized.length <= MAX_TEXT_CHARS_PER_FILE) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TEXT_CHARS_PER_FILE)}\n\n[Truncated after ${MAX_TEXT_CHARS_PER_FILE} characters to keep the AI request within a manageable size.]`;
}

async function extractPdfText(file: AiRequestFile) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: toUint8Array(file.data) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages && pageNumber <= MAX_PDF_PAGES; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText) {
      pages.push(`[Page ${pageNumber}] ${pageText}`);
    }

    if (pages.join('\n\n').length >= MAX_TEXT_CHARS_PER_FILE) {
      break;
    }
  }

  return truncateText(pages.join('\n\n') || 'No extractable text was found in this PDF.');
}

async function prepareReferenceContext(files: AiRequestFile[]): Promise<PreparedReferenceContext> {
  const textFiles: PreparedReferenceContext['textFiles'] = [];
  const imageFiles: PreparedReferenceContext['imageFiles'] = [];

  for (const file of files) {
    if (file.mimeType === 'application/pdf') {
      textFiles.push({
        name: file.name,
        text: await extractPdfText(file),
      });
      continue;
    }

    if (file.mimeType.startsWith('text/')) {
      textFiles.push({
        name: file.name,
        text: truncateText(decodeBase64ToUtf8(file.data) || 'No extractable text was found in this document.'),
      });
      continue;
    }

    if (file.mimeType.startsWith('image/')) {
      imageFiles.push({
        name: file.name,
        dataUrl: buildDataUrl(file),
      });
    }
  }

  return { textFiles, imageFiles };
}

function buildReferenceTextBlock(referenceContext: PreparedReferenceContext) {
  if (referenceContext.textFiles.length === 0) {
    return 'No text-based reference documents were provided.';
  }

  return referenceContext.textFiles
    .map((file) => `### ${file.name}\n${file.text}`)
    .join('\n\n');
}

function readProviderErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }

  return typeof error.status === 'number' ? error.status : undefined;
}

function readProviderErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error);
}

function classifyProviderError(error: unknown): AiFailureKind {
  const status = readProviderErrorStatus(error);
  const message = readProviderErrorMessage(error).toLowerCase();

  if (
    status === 401
    || status === 403
    || message.includes('api key')
    || message.includes('unauthorized')
    || message.includes('authentication')
    || message.includes('permission denied')
  ) {
    return 'auth';
  }

  if (
    status === 429
    || message.includes('quota')
    || message.includes('rate limit')
    || message.includes('resource has been exhausted')
  ) {
    return 'quota';
  }

  if (
    message.includes('fetch failed')
    || message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('enotfound')
    || message.includes('econnrefused')
    || message.includes('timed out')
    || message.includes('timeout')
    || status === 503
    || status === 504
  ) {
    return 'network';
  }

  if (
    status === 404
    || (message.includes('model') && message.includes('not found'))
    || message.includes('unsupported model')
  ) {
    return 'model';
  }

  if (status === 400 || message.includes('invalid argument') || message.includes('bad request')) {
    return 'bad-request';
  }

  if (status !== undefined && status >= 500) {
    return 'service';
  }

  return 'unknown';
}

function buildAggregateFailureMessage(actionLabel: string, failures: AiProviderFailure[]) {
  const kinds = new Set(failures.map((failure) => failure.kind));

  if (kinds.size === 1 && kinds.has('auth')) {
    return `${actionLabel} failed because every configured AI provider rejected the configured API key or access rights. Check the API keys in .env or your deployment environment and retry.`;
  }

  if (kinds.size === 1 && kinds.has('quota')) {
    return `${actionLabel} failed because every configured AI provider hit a quota or rate limit. Wait a moment, verify the usage limits for your configured keys, and retry.`;
  }

  if (kinds.size === 1 && kinds.has('network')) {
    return `${actionLabel} failed because none of the configured AI providers could be reached from this machine. Check outbound HTTPS access, firewall, proxy, VPN, or regional restrictions, then retry.`;
  }

  if (kinds.size === 1 && kinds.has('model')) {
    return `${actionLabel} failed because the configured AI models are unavailable for the current keys, regions, or provider accounts.`;
  }

  if (kinds.size === 1 && kinds.has('bad-request')) {
    return `${actionLabel} failed because every configured AI provider rejected the request payload. Check the selected files and retry.`;
  }

  if (kinds.has('auth') && kinds.has('network')) {
    return `${actionLabel} failed because the configured AI providers either rejected their API keys or could not be reached from this machine. Check your API keys and outbound HTTPS access, then retry.`;
  }

  return `${actionLabel} failed across all configured AI providers. Check the configured API keys, quotas, model access, and outbound HTTPS access, then retry.`;
}

async function readJsonOrThrow(response: Response) {
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  if (!response.ok) {
    throw new AiRequestError(
      payload.error?.message || `Upstream AI provider returned HTTP ${response.status}.`,
      response.status,
      'ai-upstream-failed',
    );
  }

  return payload;
}

function normalizeOpenAiContent(content: unknown) {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return '';
      }

      const typedPart = part as { type?: string; text?: string };
      return typedPart.type === 'text' && typedPart.text ? typedPart.text : '';
    })
    .join('\n')
    .trim();
}

function providerSupportsChatRequest(providerId: AiProviderId, request: AiChatRequestBody) {
  if (providerId === 'deepseek') {
    return request.files.every((file) => !file.mimeType.startsWith('image/'));
  }

  return true;
}

function providerSupportsOcrRequest(providerId: AiProviderId) {
  return providerId === 'gemini' || providerId === 'openai';
}

async function executeGeminiChat(request: AiChatRequestBody, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> }> = [];

  if (request.files.length > 0) {
    contents.push({
      role: 'user',
      parts: [
        ...request.files.map((file) => ({ inlineData: { data: file.data, mimeType: file.mimeType } })),
        { text: 'These are the reference files for this conversation. Use them when answering the user.' },
      ],
    });
  }

  contents.push(...request.messages.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }],
  })));

  contents.push({
    role: 'user',
    parts: [{ text: request.prompt }],
  });

  const response = await ai.models.generateContent({
    model: GEMINI_CHAT_MODEL,
    contents,
  });

  return response.text || '';
}

async function executeOpenAiChat(request: AiChatRequestBody, apiKey: string) {
  const referenceContext = await prepareReferenceContext(request.files);
  const contextParts: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  contextParts.push({
    type: 'text',
    text: `Use the following reference materials when answering the user.\n\n${buildReferenceTextBlock(referenceContext)}`,
  });

  contextParts.push(...referenceContext.imageFiles.map((file) => ({
    type: 'image_url' as const,
    image_url: {
      url: file.dataUrl,
    },
  })));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are the AI assistant for a local-first PDF, image, and Word workspace. Use the provided reference materials when they are relevant. If the files do not contain the answer, say so clearly.',
        },
        {
          role: 'user',
          content: contextParts,
        },
        ...request.messages.map((message) => ({
          role: message.role === 'model' ? 'assistant' : 'user',
          content: message.text,
        })),
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    }),
  });

  const payload = await readJsonOrThrow(response);
  return normalizeOpenAiContent(payload.choices?.[0]?.message?.content);
}

async function executeDeepSeekChat(request: AiChatRequestBody, apiKey: string) {
  const referenceContext = await prepareReferenceContext(request.files);
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are the AI assistant for a local-first PDF, image, and Word workspace. Use the provided reference materials when they are relevant. If the files do not contain the answer, say so clearly.',
        },
        {
          role: 'user',
          content: `Reference materials:\n\n${buildReferenceTextBlock(referenceContext)}`,
        },
        ...request.messages.map((message) => ({
          role: message.role === 'model' ? 'assistant' : 'user',
          content: message.text,
        })),
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    }),
  });

  const payload = await readJsonOrThrow(response);
  return normalizeOpenAiContent(payload.choices?.[0]?.message?.content);
}

async function executeGeminiOcr(request: AiOcrRequestBody, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_CHAT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: request.file.data, mimeType: request.file.mimeType } },
          { text: 'Extract all text from this image. Output ONLY the extracted text in Markdown format. Do not include any conversational filler, explanations, or markdown code blocks around the entire output.' },
        ],
      },
    ],
  });

  return response.text || '';
}

async function executeOpenAiOcr(request: AiOcrRequestBody, apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Extract all text from the provided image. Return only the extracted text in Markdown without code fences or conversational filler.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this image. Return only the extracted text in Markdown.',
            },
            {
              type: 'image_url',
              image_url: {
                url: buildDataUrl(request.file),
              },
            },
          ],
        },
      ],
    }),
  });

  const payload = await readJsonOrThrow(response);
  return normalizeOpenAiContent(payload.choices?.[0]?.message?.content);
}

const defaultChatExecutors: Record<AiProviderId, ChatProviderExecutor> = {
  gemini: executeGeminiChat,
  openai: executeOpenAiChat,
  deepseek: executeDeepSeekChat,
};

const defaultOcrExecutors: Partial<Record<AiProviderId, OcrProviderExecutor>> = {
  gemini: executeGeminiOcr,
  openai: executeOpenAiOcr,
};

function buildMissingConfigurationError() {
  return new AiRequestError(
    'No AI API key is configured. Add GEMINI_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY to .env or your deployment environment, then retry.',
    503,
    'ai-not-configured',
  );
}

function buildNoCapableProviderError(actionLabel: string, needsVision: boolean) {
  if (needsVision) {
    return new AiRequestError(
      `${actionLabel} requires an AI provider with image analysis support. Configure GEMINI_API_KEY or OPENAI_API_KEY, or remove image-only inputs from this request, then retry.`,
      503,
      'ai-no-capable-provider',
    );
  }

  return new AiRequestError(
    `${actionLabel} could not find a configured AI provider that supports this request. Configure at least one supported AI API key and retry.`,
    503,
    'ai-no-capable-provider',
  );
}

export function isAiRequestError(error: unknown): error is AiRequestError {
  return error instanceof AiRequestError;
}

export async function runAiChatRequest(body: unknown, dependencies: AiExecutionDependencies = {}) {
  const request = normalizeAiChatRequest(body);
  const env = dependencies.env ?? process.env;
  const configuredProviders = getConfiguredAiProviders(env);

  if (configuredProviders.length === 0) {
    throw buildMissingConfigurationError();
  }

  const chatExecutors = {
    ...defaultChatExecutors,
    ...dependencies.chatExecutors,
  };
  const failures: AiProviderFailure[] = [];
  let attemptedProvider = false;

  for (const provider of configuredProviders) {
    if (!providerSupportsChatRequest(provider.id, request)) {
      continue;
    }

    attemptedProvider = true;
    const apiKey = getProviderApiKey(provider.id, env);
    const executor = chatExecutors[provider.id];

    if (!apiKey || !executor) {
      continue;
    }

    try {
      const text = await executor(request, apiKey);
      return { text };
    } catch (error) {
      console.error(`AI chat provider ${provider.id} failed:`, error);
      failures.push({
        providerId: provider.id,
        kind: classifyProviderError(error),
      });
    }
  }

  if (!attemptedProvider) {
    throw buildNoCapableProviderError('AI assistant', request.files.some((file) => file.mimeType.startsWith('image/')));
  }

  throw new AiRequestError(
    buildAggregateFailureMessage('AI assistant', failures),
    502,
    'ai-all-providers-failed',
  );
}

export async function runAiOcrRequest(body: unknown, dependencies: AiExecutionDependencies = {}) {
  const request = normalizeAiOcrRequest(body);
  const env = dependencies.env ?? process.env;
  const configuredProviders = getConfiguredAiProviders(env);

  if (configuredProviders.length === 0) {
    throw buildMissingConfigurationError();
  }

  const ocrExecutors = {
    ...defaultOcrExecutors,
    ...dependencies.ocrExecutors,
  };
  const failures: AiProviderFailure[] = [];
  let attemptedProvider = false;

  for (const provider of configuredProviders) {
    if (!providerSupportsOcrRequest(provider.id)) {
      continue;
    }

    attemptedProvider = true;
    const apiKey = getProviderApiKey(provider.id, env);
    const executor = ocrExecutors[provider.id];

    if (!apiKey || !executor) {
      continue;
    }

    try {
      const text = await executor(request, apiKey);
      return { text };
    } catch (error) {
      console.error(`AI OCR provider ${provider.id} failed:`, error);
      failures.push({
        providerId: provider.id,
        kind: classifyProviderError(error),
      });
    }
  }

  if (!attemptedProvider) {
    throw buildNoCapableProviderError('AI OCR', true);
  }

  throw new AiRequestError(
    buildAggregateFailureMessage('AI OCR', failures),
    502,
    'ai-all-providers-failed',
  );
}

export const __internal = {
  normalizeAiChatRequest,
  normalizeAiOcrRequest,
  providerSupportsChatRequest,
  providerSupportsOcrRequest,
  classifyProviderError,
};