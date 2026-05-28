import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RuntimeConfig } from './ai-types';

async function importAiModule() {
  vi.resetModules();
  return import('./ai');
}

const configuredRuntimeConfig: RuntimeConfig = {
  aiProviders: [
    { id: 'gemini', label: 'Google Gemini', configured: true, supportsVision: true },
    { id: 'openai', label: 'OpenAI / ChatGPT', configured: false, supportsVision: true },
    { id: 'deepseek', label: 'DeepSeek', configured: false, supportsVision: false },
  ],
  localImageOcr: {
    engine: 'PaddleOCR',
    available: true,
    offlineReady: true,
    detail: 'ready',
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ai runtime config', () => {
  it('loads and caches the runtime AI configuration', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => configuredRuntimeConfig,
    });
    vi.stubGlobal('fetch', fetchMock);

    const ai = await importAiModule();

    await expect(ai.loadAiRuntimeConfig()).resolves.toEqual(configuredRuntimeConfig);
    await expect(ai.loadAiRuntimeConfig()).resolves.toEqual(configuredRuntimeConfig);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ai.isAiConfigured(ai.getAiRuntimeConfig())).toBe(true);
  });

  it('retries runtime config loading after an initial unconfigured response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          aiProviders: configuredRuntimeConfig.aiProviders.map((provider) => ({ ...provider, configured: false })),
          localImageOcr: {
            engine: 'PaddleOCR',
            available: false,
            offlineReady: false,
            detail: 'not ready',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => configuredRuntimeConfig,
      });
    vi.stubGlobal('fetch', fetchMock);

    const ai = await importAiModule();

    await expect(ai.loadAiRuntimeConfig()).resolves.toEqual({
      aiProviders: configuredRuntimeConfig.aiProviders.map((provider) => ({ ...provider, configured: false })),
      localImageOcr: {
        engine: 'PaddleOCR',
        available: false,
        offlineReady: false,
        detail: 'not ready',
      },
    });
    await expect(ai.loadAiRuntimeConfig()).resolves.toEqual(configuredRuntimeConfig);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('posts assistant requests through the local AI gateway', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => configuredRuntimeConfig,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'assistant reply' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const ai = await importAiModule();

    await ai.loadAiRuntimeConfig();
    await expect(ai.requestAiAssistantReply({ prompt: 'hello', messages: [], files: [] })).resolves.toBe('assistant reply');
  });

  it('surfaces local OCR gateway connectivity failures with a specific hint', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    const ai = await importAiModule();

    await expect(ai.extractImageTextWithLocalOcr({ data: 'abc', mimeType: 'image/png', name: 'scan.png' })).rejects.toThrow(
      'local OCR gateway',
    );
  });
});