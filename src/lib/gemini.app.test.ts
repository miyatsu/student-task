import { afterEach, describe, expect, it, vi } from 'vitest';

const googleGenAiMocks = vi.hoisted(() => ({
  GoogleGenAI: vi.fn(class GoogleGenAIMock {
    apiKey: string;

    constructor({ apiKey }: { apiKey: string }) {
      this.apiKey = apiKey;
    }
  }),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: googleGenAiMocks.GoogleGenAI,
}));

const originalGeminiApiKey = process.env.GEMINI_API_KEY;

async function importGeminiModule() {
  vi.resetModules();
  return import('./gemini');
}

function resetGoogleGenAiMock() {
  googleGenAiMocks.GoogleGenAI.mockClear();
}

afterEach(() => {
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }

  vi.unstubAllGlobals();
});

describe('gemini runtime config', () => {
  it('loads and caches the runtime Gemini API key', async () => {
    resetGoogleGenAiMock();
    process.env.GEMINI_API_KEY = 'build-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ geminiApiKey: ' runtime-key ' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = await importGeminiModule();

    expect(gemini.getGeminiApiKey()).toBe('build-key');
    await expect(gemini.loadGeminiApiKey()).resolves.toBe('runtime-key');
    expect(gemini.getGeminiApiKey()).toBe('runtime-key');

    await gemini.loadGeminiApiKey();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the build-time key when runtime config fails', async () => {
    resetGoogleGenAiMock();
    process.env.GEMINI_API_KEY = 'build-key';

    const fetchMock = vi.fn().mockRejectedValue(new Error('network failure'));
    vi.stubGlobal('fetch', fetchMock);

    const gemini = await importGeminiModule();

    await expect(gemini.loadGeminiApiKey()).resolves.toBe('build-key');
    expect(gemini.getGeminiApiKey()).toBe('build-key');
  });

  it('creates a Gemini client from the loaded runtime key', async () => {
    resetGoogleGenAiMock();
    delete process.env.GEMINI_API_KEY;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ geminiApiKey: 'runtime-key' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = await importGeminiModule();
    const client = await gemini.createGeminiClient();

    expect(googleGenAiMocks.GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'runtime-key' });
    expect(client).toBeInstanceOf(googleGenAiMocks.GoogleGenAI);
    expect(client).toMatchObject({ apiKey: 'runtime-key' });
  });

  it('returns null when neither runtime nor build-time keys are available', async () => {
    resetGoogleGenAiMock();
    delete process.env.GEMINI_API_KEY;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ geminiApiKey: '' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = await importGeminiModule();

    await expect(gemini.createGeminiClient()).resolves.toBeNull();
    expect(googleGenAiMocks.GoogleGenAI).not.toHaveBeenCalled();
  });

  it('retries runtime config loading after an initial missing-key response', async () => {
    resetGoogleGenAiMock();
    delete process.env.GEMINI_API_KEY;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ geminiApiKey: '' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ geminiApiKey: 'runtime-key' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const gemini = await importGeminiModule();

    await expect(gemini.loadGeminiApiKey()).resolves.toBe('');
    await expect(gemini.loadGeminiApiKey()).resolves.toBe('runtime-key');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(gemini.getGeminiApiKey()).toBe('runtime-key');
  });

  it('classifies network failures with actionable guidance', async () => {
    const gemini = await importGeminiModule();

    expect(gemini.buildGeminiErrorMessage(new TypeError('fetch failed'), 'Gemini chat')).toContain(
      'generativelanguage.googleapis.com:443',
    );
  });

  it('classifies invalid key failures with a specific setup hint', async () => {
    const gemini = await importGeminiModule();

    expect(
      gemini.buildGeminiErrorMessage(
        { message: 'API key not valid. Please pass a valid API key.', status: 400 },
        'Gemini OCR',
      ),
    ).toContain('rejected the API key');
  });
});