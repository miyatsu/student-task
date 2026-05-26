import type { PDFImage } from 'pdf-lib';

export type PdfImageFormat = 'png' | 'jpeg';

function describeError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Unknown image conversion error.';
}

export function resolvePdfImageFormat(file: Pick<File, 'type' | 'name'>): PdfImageFormat {
  const mimeType = file.type.toLowerCase();
  const lowerCaseFileName = file.name.toLowerCase();

  if (mimeType === 'image/png' || lowerCaseFileName.endsWith('.png')) {
    return 'png';
  }

  if (
    mimeType === 'image/jpeg'
    || mimeType === 'image/jpg'
    || lowerCaseFileName.endsWith('.jpg')
    || lowerCaseFileName.endsWith('.jpeg')
  ) {
    return 'jpeg';
  }

  throw new Error(`Unsupported image type "${file.type || file.name}". Only PNG, JPG, and JPEG images can be converted to PDF.`);
}

export function buildImageToPdfErrorMessage(fileName: string, error: unknown) {
  return `Failed to convert "${fileName}" to PDF: ${describeError(error)}`;
}

interface NormalizeImageForPdfDependencies {
  createObjectUrl?: (file: File) => string;
  revokeObjectUrl?: (url: string) => void;
  createImageElement?: () => HTMLImageElement;
  createCanvasElement?: () => HTMLCanvasElement;
}

export async function normalizeImageFileForPdf(
  file: File,
  format: PdfImageFormat,
  dependencies: NormalizeImageForPdfDependencies = {},
) {
  const createObjectUrl = dependencies.createObjectUrl ?? URL.createObjectURL;
  const revokeObjectUrl = dependencies.revokeObjectUrl ?? URL.revokeObjectURL;
  const createImageElement = dependencies.createImageElement ?? (() => new Image());
  const createCanvasElement = dependencies.createCanvasElement ?? (() => document.createElement('canvas'));

  const previewUrl = createObjectUrl(file);

  try {
    const image = createImageElement();
    const decodedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The browser could not decode the image bytes for PDF conversion.'));
      image.src = previewUrl;
    });

    const width = decodedImage.naturalWidth || decodedImage.width;
    const height = decodedImage.naturalHeight || decodedImage.height;

    if (!width || !height) {
      throw new Error('The image has invalid dimensions and cannot be converted to PDF.');
    }

    const canvas = createCanvasElement();
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('The browser could not create a canvas context for image conversion.');
    }

    if (format === 'jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(decodedImage, 0, 0, width, height);

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, format === 'jpeg' ? 0.95 : undefined);
    });

    if (!blob) {
      throw new Error('The browser failed to re-encode the image before PDF conversion.');
    }

    return await blob.arrayBuffer();
  } finally {
    revokeObjectUrl(previewUrl);
  }
}

interface PdfImageEmbedder {
  embedPng: (bytes: ArrayBuffer) => Promise<PDFImage>;
  embedJpg: (bytes: ArrayBuffer) => Promise<PDFImage>;
}

async function embedImageBytes(
  pdfDocument: Pick<PdfImageEmbedder, 'embedPng' | 'embedJpg'>,
  bytes: ArrayBuffer,
  format: PdfImageFormat,
) {
  return format === 'png' ? pdfDocument.embedPng(bytes) : pdfDocument.embedJpg(bytes);
}

interface EmbedImageFileInPdfDependencies {
  normalizeImageBytes?: (file: File, format: PdfImageFormat) => Promise<ArrayBuffer>;
}

export async function embedImageFileInPdf(
  pdfDocument: Pick<PdfImageEmbedder, 'embedPng' | 'embedJpg'>,
  file: File,
  dependencies: EmbedImageFileInPdfDependencies = {},
) {
  const format = resolvePdfImageFormat(file);
  const bytes = await file.arrayBuffer();

  try {
    const image = await embedImageBytes(pdfDocument, bytes, format);
    return { format, image, normalized: false };
  } catch {
    const normalizeImageBytes = dependencies.normalizeImageBytes ?? normalizeImageFileForPdf;
    const normalizedBytes = await normalizeImageBytes(file, format);
    const image = await embedImageBytes(pdfDocument, normalizedBytes, format);
    return { format, image, normalized: true };
  }
}