/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  buildGhostscriptCompressionCommand,
  createCompressionJobId,
  resolvePdfCompressionSettings,
} from './compression';
import { readRuntimeConfig } from './runtime-config';
import {
  buildWordHtmlFromExtractedText,
  extractLegacyWordHtml,
  isLegacyWordDocument,
} from './word-conversion';

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

describe('word conversion helpers', () => {
  it('detects legacy .doc files by extension', () => {
    expect(isLegacyWordDocument('legacy.doc')).toBe(true);
    expect(isLegacyWordDocument('legacy.DOC')).toBe(true);
    expect(isLegacyWordDocument('modern.docx')).toBe(false);
  });

  it('renders extracted word text as escaped html paragraphs', () => {
    const html = buildWordHtmlFromExtractedText({
      body: 'Heading\nSecond line\n\n<unsafe> body',
      footnotes: 'Note A',
    });

    expect(html).toContain('<p>Heading<br />Second line</p>');
    expect(html).toContain('<p>&lt;unsafe&gt; body</p>');
    expect(html).toContain('<section><h2>Footnotes</h2><p>Note A</p></section>');
  });

  it('extracts legacy .doc html through the injected extractor loader', async () => {
    const extract = vi.fn().mockResolvedValue({
      getBody: () => 'Legacy body',
      getHeaders: () => 'Header text',
      getFooters: () => '',
      getFootnotes: () => '',
      getEndnotes: () => '',
      getAnnotations: () => '',
      getTextboxes: () => 'Textbox text',
    });

    const loadWordExtractor = async () => {
      return class {
        extract = extract;
      };
    };

    const html = await extractLegacyWordHtml(Buffer.from('legacy-doc'), { loadWordExtractor });

    expect(extract).toHaveBeenCalledWith(Buffer.from('legacy-doc'));
    expect(html).toContain('<p>Legacy body</p>');
    expect(html).toContain('<section><h2>Headers</h2><p>Header text</p></section>');
    expect(html).toContain('<section><h2>Text Boxes</h2><p>Textbox text</p></section>');
  });
});