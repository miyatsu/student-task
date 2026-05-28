/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { runAiChatRequest, runAiOcrRequest } from './ai';

describe('server AI provider fallback', () => {
  it('uses the first successful configured provider for chat', async () => {
    const chatExecutors = {
      gemini: async () => {
        throw new Error('invalid api key');
      },
      openai: async () => 'openai reply',
      deepseek: async () => 'deepseek reply',
    };

    await expect(
      runAiChatRequest(
        { prompt: 'hello', messages: [], files: [] },
        {
          env: {
            GEMINI_API_KEY: 'gemini-key',
            OPENAI_API_KEY: 'openai-key',
          },
          chatExecutors,
        },
      ),
    ).resolves.toEqual({ text: 'openai reply' });
  });

  it('skips DeepSeek for image OCR and falls back to Gemini or OpenAI only', async () => {
    await expect(
      runAiOcrRequest(
        { file: { data: 'abc', mimeType: 'image/png', name: 'scan.png' } },
        {
          env: {
            DEEPSEEK_API_KEY: 'deepseek-key',
          },
        },
      ),
    ).rejects.toMatchObject({
      code: 'ai-no-capable-provider',
    });
  });

  it('rejects requests when no provider key is configured', async () => {
    await expect(
      runAiChatRequest(
        { prompt: 'hello', messages: [], files: [] },
        {
          env: {},
        },
      ),
    ).rejects.toMatchObject({
      code: 'ai-not-configured',
    });
  });
});