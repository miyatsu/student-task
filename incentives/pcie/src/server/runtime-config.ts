export interface RuntimeConfig {
  geminiApiKey: string;
}

export function readRuntimeConfig(env: Partial<Pick<NodeJS.ProcessEnv, 'GEMINI_API_KEY'>> = process.env): RuntimeConfig {
  return {
    geminiApiKey: env.GEMINI_API_KEY?.trim() || '',
  };
}