import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export interface RuntimeConfig {
  geminiApiKey: string;
}

interface RuntimeConfigDependencies {
  loadProcessEnv?: () => void;
}

function normalizeGeminiApiKey(apiKey?: string | null) {
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
  env: Partial<Pick<NodeJS.ProcessEnv, 'GEMINI_API_KEY'>> = process.env,
  { loadProcessEnv = loadRuntimeDotEnvFile }: RuntimeConfigDependencies = {},
): RuntimeConfig {
  if (!normalizeGeminiApiKey(env.GEMINI_API_KEY) && env === process.env) {
    loadProcessEnv();
  }

  return {
    geminiApiKey: normalizeGeminiApiKey(env.GEMINI_API_KEY),
  };
}