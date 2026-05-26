import { describe, expect, it, vi } from 'vitest';

import {
  buildImageToPdfErrorMessage,
  embedImageFileInPdf,
  resolvePdfImageFormat,
} from './image-pdf';

describe('image-pdf helpers', () => {
  it('resolves the image format from mime type or file extension', () => {
    expect(resolvePdfImageFormat(new File(['png'], 'diagram.png', { type: 'image/png' }))).toBe('png');
    expect(resolvePdfImageFormat(new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' }))).toBe('jpeg');
    expect(resolvePdfImageFormat(new File(['jpg'], 'scan.jpeg', { type: '' }))).toBe('jpeg');
  });

  it('falls back to browser normalization when direct embedding fails', async () => {
    const embeddedImage = { width: 1200, height: 900 };
    const pdfDocument = {
      embedPng: vi
        .fn()
        .mockRejectedValueOnce(new Error('Unsupported PNG subtype'))
        .mockResolvedValueOnce(embeddedImage),
      embedJpg: vi.fn(),
    };

    const normalizeImageBytes = vi.fn().mockResolvedValue(new ArrayBuffer(16));
    const file = new File([new Uint8Array([1, 2, 3])], 'diagram.png', { type: 'image/png' });

    const result = await embedImageFileInPdf(pdfDocument, file, { normalizeImageBytes });

    expect(normalizeImageBytes).toHaveBeenCalledWith(file, 'png');
    expect(pdfDocument.embedPng).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ format: 'png', image: embeddedImage, normalized: true });
  });

  it('keeps the direct embedding path when the original bytes are already supported', async () => {
    const embeddedImage = { width: 800, height: 600 };
    const pdfDocument = {
      embedPng: vi.fn(),
      embedJpg: vi.fn().mockResolvedValue(embeddedImage),
    };

    const normalizeImageBytes = vi.fn();
    const file = new File([new Uint8Array([4, 5, 6])], 'photo.jpg', { type: 'image/jpeg' });

    const result = await embedImageFileInPdf(pdfDocument, file, { normalizeImageBytes });

    expect(normalizeImageBytes).not.toHaveBeenCalled();
    expect(pdfDocument.embedJpg).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ format: 'jpeg', image: embeddedImage, normalized: false });
  });

  it('builds a detailed error message with the file name and root cause', () => {
    expect(buildImageToPdfErrorMessage('photo.jpg', new Error('Unsupported JPEG marker.')))
      .toBe('Failed to convert "photo.jpg" to PDF: Unsupported JPEG marker.');
  });
});