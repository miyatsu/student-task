import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { AiProviderId, RuntimeConfig } from '../lib/ai-types';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_ORDER,
  AI_PROVIDER_SUPPORTS_VISION,
} from '../lib/ai-types';

interface RuntimeConfigDependencies {
  loadProcessEnv?: () => void;
}

type RuntimeEnv = Partial<Pick<NodeJS.ProcessEnv, 'GEMINI_API_KEY' | 'OPENAI_API_KEY' | 'DEEPSEEK_API_KEY'>>;

function normalizeApiKey(apiKey?: string | null) {
  return apiKey?.trim() || '';
}

function loadRuntimeDotEnvFile() {
  const envFilePath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  dotenv.config({
    path: envFilePath,
    override: false,
    quiet: true,
  });
}

export function readRuntimeConfig(
  env: RuntimeEnv = process.env,
  { loadProcessEnv = loadRuntimeDotEnvFile }: RuntimeConfigDependencies = {},
): RuntimeConfig {
  const runtimeEnv = env === process.env
    ? (loadProcessEnv(), { ...env })
    : env;

  return {
    aiProviders: AI_PROVIDER_ORDER.map((providerId) => ({
      id: providerId,
      label: AI_PROVIDER_LABELS[providerId],
      configured: Boolean(getProviderApiKey(providerId, runtimeEnv)),
      supportsVision: AI_PROVIDER_SUPPORTS_VISION[providerId],
    })),
  };
}

export function getProviderApiKey(providerId: AiProviderId, env: RuntimeEnv = process.env) {
  const runtimeEnv = env === process.env
    ? (loadRuntimeDotEnvFile(), env)
    : env;

  switch (providerId) {
    case 'gemini':
      return normalizeApiKey(runtimeEnv.GEMINI_API_KEY);
    case 'openai':
      return normalizeApiKey(runtimeEnv.OPENAI_API_KEY);
    case 'deepseek':
      return normalizeApiKey(runtimeEnv.DEEPSEEK_API_KEY);
    default:
      return '';
  }
}

export function getConfiguredAiProviders(env: RuntimeEnv = process.env) {
  return readRuntimeConfig(env).aiProviders.filter((provider) => provider.configured);
}