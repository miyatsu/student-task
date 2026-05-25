/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  buildGhostscriptCompressionCommand,
  createCompressionJobId,
  resolvePdfCompressionSettings,
} from './compression';
import { readRuntimeConfig } from './runtime-config';

describe('server compression helpers', () => {
  it('maps compression levels to Ghostscript settings', () => {
    expect(resolvePdfCompressionSettings('low')).toBe('/screen');
    expect(resolvePdfCompressionSettings('medium')).toBe('/ebook');
    expect(resolvePdfCompressionSettings('high')).toBe('/printer');
    expect(resolvePdfCompressionSettings('unexpected')).toBe('/ebook');
    expect(resolvePdfCompressionSettings(undefined)).toBe('/ebook');
  });

  it('builds deterministic compression job ids when dependencies are injected', () => {
    const jobId = createCompressionJobId(() => 1700000000000, () => 0.123456789);
    expect(jobId).toBe('1700000000000-xjylrx');
  });

  it('builds the Ghostscript command with quoted paths and configured quality', () => {
    const command = buildGhostscriptCompressionCommand({
      inputPath: 'input files/document.pdf',
      outputPath: 'output files/compressed.pdf',
      pdfSettings: '/printer',
    });

    expect(command).toContain('-dPDFSETTINGS=/printer');
    expect(command).toContain('-sOutputFile="output files/compressed.pdf"');
    expect(command).toContain('"input files/document.pdf"');
    expect(command).toContain('-dColorImageDownsampleType=/Subsample');
  });
});

describe('runtime config helpers', () => {
  it('returns the trimmed Gemini key from the environment', () => {
    expect(readRuntimeConfig({ GEMINI_API_KEY: ' runtime-key ' })).toEqual({
      geminiApiKey: 'runtime-key',
    });
  });

  it('returns an empty Gemini key when the environment value is missing', () => {
    expect(readRuntimeConfig({ GEMINI_API_KEY: undefined })).toEqual({
      geminiApiKey: '',
    });
  });
});