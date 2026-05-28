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
import {
  buildNativeWordPdfUnavailableMessage,
  convertWordDocumentToPdf,
  NativeWordPdfUnavailableError,
  resolveExistingExecutablePath,
  resolveNativeWordPdfBackend,
} from './word-pdf-native';

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

  it('reloads the process environment from .env when the running server started before the file existed', () => {
    const originalGeminiApiKey = process.env.GEMINI_API_KEY;

    try {
      delete process.env.GEMINI_API_KEY;
      const loadProcessEnv = vi.fn(() => {
        process.env.GEMINI_API_KEY = ' reloaded-runtime-key ';
      });

      expect(readRuntimeConfig(process.env, { loadProcessEnv })).toEqual({
        geminiApiKey: 'reloaded-runtime-key',
      });
      expect(loadProcessEnv).toHaveBeenCalledTimes(1);
    } finally {
      if (originalGeminiApiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalGeminiApiKey;
      }
    }
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

describe('native word pdf helpers', () => {
  it('prefers Microsoft Word COM when both native backends are available', async () => {
    const backend = await resolveNativeWordPdfBackend(undefined, {
      platform: 'win32',
      checkWordComAvailability: async () => true,
      findLibreOfficeExecutable: async () => 'C:/LibreOffice/program/soffice.exe',
    });

    expect(backend).toEqual({ kind: 'word-com' });
  });

  it('falls back to the LibreOffice CLI backend when Word COM is unavailable', async () => {
    const backend = await resolveNativeWordPdfBackend(undefined, {
      platform: 'win32',
      checkWordComAvailability: async () => false,
      findLibreOfficeExecutable: async () => 'C:/LibreOffice/program/soffice.exe',
    });

    expect(backend).toEqual({
      kind: 'libreoffice-cli',
      executablePath: 'C:/LibreOffice/program/soffice.exe',
    });
  });

  it('can resolve a specifically requested backend', async () => {
    const backend = await resolveNativeWordPdfBackend('word-com', {
      platform: 'win32',
      checkWordComAvailability: async () => true,
      findLibreOfficeExecutable: async () => 'C:/LibreOffice/program/soffice.exe',
    });

    expect(backend).toEqual({ kind: 'word-com' });
  });

  it('can resolve LibreOffice CLI when it is explicitly requested', async () => {
    const backend = await resolveNativeWordPdfBackend('libreoffice-cli', {
      platform: 'win32',
      checkWordComAvailability: async () => true,
      findLibreOfficeExecutable: async () => 'C:/LibreOffice/program/soffice.exe',
    });

    expect(backend).toEqual({
      kind: 'libreoffice-cli',
      executablePath: 'C:/LibreOffice/program/soffice.exe',
    });
  });

  it('reports no native backend when neither Word nor LibreOffice is available', async () => {
    const backend = await resolveNativeWordPdfBackend(undefined, {
      platform: 'win32',
      checkWordComAvailability: async () => false,
      findLibreOfficeExecutable: async () => null,
    });

    expect(backend).toBeNull();
    expect(buildNativeWordPdfUnavailableMessage()).toContain('Microsoft Word or LibreOffice');
  });

  it('resolves the first existing executable path from a candidate list', () => {
    const executablePath = resolveExistingExecutablePath(
      ['missing.exe', 'existing.exe', 'later.exe'],
      (candidate) => candidate === 'existing.exe',
    );

    expect(executablePath).toBe('existing.exe');
  });

  it('runs the selected native backend and returns its name', async () => {
    const runWordComExport = vi.fn().mockResolvedValue(undefined);

    const backend = await convertWordDocumentToPdf('input.docx', 'output.pdf', {
      preferredBackend: 'word-com',
      resolveNativeBackend: async () => ({ kind: 'word-com' }),
      runWordComExport,
      pathExists: (targetPath) => targetPath === 'output.pdf',
    });

    expect(backend).toBe('word-com');
    expect(runWordComExport).toHaveBeenCalledWith('input.docx', 'output.pdf');
  });

  it('throws a dedicated unavailable error when no native backend exists', async () => {
    await expect(convertWordDocumentToPdf('input.docx', 'output.pdf', {
      preferredBackend: 'libreoffice-cli',
      resolveNativeBackend: async () => null,
    })).rejects.toBeInstanceOf(NativeWordPdfUnavailableError);
  });
});