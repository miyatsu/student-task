export const AI_PROVIDER_ORDER = ['gemini', 'openai', 'deepseek'] as const;

export type AiProviderId = (typeof AI_PROVIDER_ORDER)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI / ChatGPT',
  deepseek: 'DeepSeek',
};

export const AI_PROVIDER_SUPPORTS_VISION: Record<AiProviderId, boolean> = {
  gemini: true,
  openai: true,
  deepseek: false,
};

export interface AiProviderRuntimeSummary {
  id: AiProviderId;
  label: string;
  configured: boolean;
  supportsVision: boolean;
}

export interface RuntimeConfig {
  aiProviders: AiProviderRuntimeSummary[];
}

export type AiChatRole = 'user' | 'model';

export interface AiChatMessage {
  role: AiChatRole;
  text: string;
}

export interface AiRequestFile {
  data: string;
  mimeType: string;
  name: string;
}

export interface AiChatRequestBody {
  prompt: string;
  messages: AiChatMessage[];
  files: AiRequestFile[];
}

export interface AiOcrRequestBody {
  file: AiRequestFile;
}

export interface AiTextResponse {
  text: string;
}