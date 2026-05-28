/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { runLocalImageOcrRequest } from './local-ocr';

describe('local PaddleOCR image OCR', () => {
  it('rejects requests when the local OCR runtime is not ready', async () => {
    await expect(
      runLocalImageOcrRequest(
        { file: { data: 'abc', mimeType: 'image/png', name: 'scan.png' } },
        {
          readRuntimeSummary: () => ({
            engine: 'PaddleOCR',
            available: false,
            offlineReady: false,
            detail: 'setup required',
          }),
        },
      ),
    ).rejects.toMatchObject({
      code: 'local-ocr-not-ready',
    });
  });

  it('runs OCR through the injected local executor when the runtime is ready', async () => {
    const executeOcr = vi.fn().mockResolvedValue('# OCR text');

    await expect(
      runLocalImageOcrRequest(
        { file: { data: 'abc', mimeType: 'image/png', name: 'scan.png' } },
        {
          readRuntimeSummary: () => ({
            engine: 'PaddleOCR',
            available: true,
            offlineReady: true,
            detail: 'ready',
          }),
          executeOcr,
        },
      ),
    ).resolves.toEqual({ text: '# OCR text' });

    expect(executeOcr).toHaveBeenCalledTimes(1);
  });
});