import { GoogleGenAI } from '@google/genai';

export const missingGeminiApiKeyMessage =
  'Gemini AI is not configured for local development. Create a .env file in the project root with GEMINI_API_KEY=your_actual_key_here, then restart npm run dev.';

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || '';
}

export function createGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({ apiKey });
}