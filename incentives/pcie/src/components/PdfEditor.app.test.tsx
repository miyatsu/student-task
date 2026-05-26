import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppFile } from '../features/files';
import PdfEditor from './PdfEditor';

const pdfjsMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
}));

const pdfLibMocks = vi.hoisted(() => ({
  load: vi.fn(),
  create: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: pdfjsMocks.getDocument,
}));

vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'pdf-worker.js' }));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: pdfLibMocks.load,
    create: pdfLibMocks.create,
  },
}));

function createPdfAppFile(name = 'sample.pdf'): AppFile {
  const file = new File([new Uint8Array([1, 2, 3, 4])], name, {
    type: 'application/pdf',
    lastModified: 100,
  });

  return {
    id: 'pdf-1',
    file,
    name,
    size: file.size,
    type: 'pdf',
  };
}

beforeEach(() => {
  let renderCallCount = 0;

  pdfjsMocks.getDocument.mockReset();
  pdfLibMocks.load.mockReset();
  pdfLibMocks.create.mockReset();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => `data:image/jpeg;base64,page-${++renderCallCount}`);

  pdfjsMocks.getDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn(async () => ({
        getViewport: () => ({ width: 100, height: 140 }),
        render: () => ({ promise: Promise.resolve() }),
      })),
    }),
  });
});

describe('PdfEditor', () => {
  it('deletes selected pages and forwards the updated file', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const removePage = vi.fn();
    const save = vi.fn(async () => new Uint8Array([9, 9, 9]));

    pdfLibMocks.load.mockResolvedValue({ removePage, save });

    render(
      <PdfEditor
        file={createPdfAppFile()}
        onClose={vi.fn()}
        onUpdate={onUpdate}
        onExtract={vi.fn()}
      />,
    );

    await screen.findByText('Page 1');

    await user.click(screen.getByText('Page 2'));
    await user.click(screen.getByRole('button', { name: 'Delete Selected' }));

    await waitFor(() => expect(removePage).toHaveBeenCalledWith(1));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

    const [id, newFile] = onUpdate.mock.calls[0];
    expect(id).toBe('pdf-1');
    expect(newFile).toBeInstanceOf(File);
    expect(newFile.name).toBe('sample.pdf');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('extracts the selected pages into a new pdf file', async () => {
    const user = userEvent.setup();
    const onExtract = vi.fn();
    const sourcePdf = { id: 'source-pdf' };
    const addPage = vi.fn();
    const copyPages = vi.fn(async () => [{ id: 'page-1' }, { id: 'page-2' }]);
    const save = vi.fn(async () => new Uint8Array([8, 8, 8]));

    pdfLibMocks.load.mockResolvedValue(sourcePdf);
    pdfLibMocks.create.mockResolvedValue({ copyPages, addPage, save });

    render(
      <PdfEditor
        file={createPdfAppFile()}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onExtract={onExtract}
      />,
    );

    await screen.findByText('Page 1');

    await user.click(screen.getByText('Page 1'));
    await user.click(screen.getByText('Page 2'));
    await user.click(screen.getByRole('button', { name: 'Extract to New PDF' }));

    await waitFor(() => expect(copyPages).toHaveBeenCalledWith(sourcePdf, [0, 1]));
    expect(addPage).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(1);

    const extractedFile = onExtract.mock.calls[0][0] as File;
    expect(extractedFile).toBeInstanceOf(File);
    expect(extractedFile.name).toMatch(/^sample-extracted-\d+\.pdf$/);
  });

  it('disables deleting all pages at once', async () => {
    const user = userEvent.setup();

    render(
      <PdfEditor
        file={createPdfAppFile()}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onExtract={vi.fn()}
      />,
    );

    await screen.findByText('Page 1');

    await user.click(screen.getByRole('button', { name: 'Select All' }));

    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeDisabled();
  });
});