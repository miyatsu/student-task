export interface ExtractedWordDocument {
  getBody(): string;
  getFootnotes(): string;
  getHeaders(options?: { includeFooters?: boolean }): string;
  getFooters(): string;
  getAnnotations(): string;
  getTextboxes(options?: { includeHeadersAndFooters?: boolean; includeBody?: boolean }): string;
  getEndnotes(): string;
}

interface WordExtractorInstance {
  extract(documentPath: string | Buffer): Promise<ExtractedWordDocument>;
}

type WordExtractorConstructor = new () => WordExtractorInstance;

interface ExtractLegacyWordHtmlDependencies {
  loadWordExtractor?: () => Promise<WordExtractorConstructor>;
}

interface WordHtmlSections {
  body?: string;
  headers?: string;
  footers?: string;
  footnotes?: string;
  endnotes?: string;
  annotations?: string;
  textboxes?: string;
}

function normalizeTextBlock(value?: string) {
  return (value ?? '').replace(/\r\n?/g, '\n').trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTextAsParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.split('\n').map((line) => escapeHtml(line)).join('<br />')}</p>`)
    .join('');
}

function renderOptionalSection(title: string, value?: string) {
  const normalizedValue = normalizeTextBlock(value);
  if (!normalizedValue) {
    return '';
  }

  return `<section><h2>${title}</h2>${renderTextAsParagraphs(normalizedValue)}</section>`;
}

export function isLegacyWordDocument(fileName: string) {
  const lowerCaseFileName = fileName.toLowerCase();
  return lowerCaseFileName.endsWith('.doc') && !lowerCaseFileName.endsWith('.docx');
}

export function buildWordHtmlFromExtractedText({
  body,
  headers,
  footers,
  footnotes,
  endnotes,
  annotations,
  textboxes,
}: WordHtmlSections) {
  const normalizedBody = normalizeTextBlock(body);

  const html = [
    normalizedBody ? renderTextAsParagraphs(normalizedBody) : '',
    renderOptionalSection('Headers', headers),
    renderOptionalSection('Text Boxes', textboxes),
    renderOptionalSection('Footnotes', footnotes),
    renderOptionalSection('Endnotes', endnotes),
    renderOptionalSection('Annotations', annotations),
    renderOptionalSection('Footers', footers),
  ].join('');

  if (!html) {
    throw new Error('The .doc document did not contain any readable text for PDF conversion.');
  }

  return html;
}

async function loadWordExtractorConstructor() {
  const wordExtractorModule = await import('word-extractor');
  return (wordExtractorModule.default ?? wordExtractorModule) as unknown as WordExtractorConstructor;
}

export async function extractLegacyWordHtml(
  documentBuffer: Buffer,
  dependencies: ExtractLegacyWordHtmlDependencies = {},
) {
  const loadWordExtractor = dependencies.loadWordExtractor ?? loadWordExtractorConstructor;
  const WordExtractor = await loadWordExtractor();
  const extractor = new WordExtractor();
  const document = await extractor.extract(documentBuffer);

  return buildWordHtmlFromExtractedText({
    body: document.getBody(),
    headers: document.getHeaders({ includeFooters: false }),
    footers: document.getFooters(),
    footnotes: document.getFootnotes(),
    endnotes: document.getEndnotes(),
    annotations: document.getAnnotations(),
    textboxes: document.getTextboxes({ includeHeadersAndFooters: false }),
  });
}