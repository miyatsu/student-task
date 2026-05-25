import type { ComponentProps } from 'react';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AppFile } from '../types';
import { PdfFilesSection } from './PdfFilesSection';

vi.mock('@hello-pangea/dnd', () => ({
  Droppable: ({ children }: { children: (provided: { innerRef: () => void; droppableProps: Record<string, never>; placeholder: null }) => unknown }) => children({
    innerRef: () => undefined,
    droppableProps: {},
    placeholder: null,
  }),
  Draggable: ({ children }: { children: (provided: { innerRef: () => void; draggableProps: Record<string, never>; dragHandleProps: Record<string, never> }, snapshot: { isDragging: boolean }) => unknown }) => children({
    innerRef: () => undefined,
    draggableProps: {},
    dragHandleProps: {},
  }, { isDragging: false }),
}));

function createAppFileFixture(overrides: Partial<AppFile> = {}): AppFile {
  const file = overrides.file ?? new File(['pdf'], overrides.name ?? 'fixture.pdf', {
    type: 'application/pdf',
    lastModified: 100,
  });

  return {
    id: overrides.id ?? 'pdf-1',
    file,
    name: overrides.name ?? file.name,
    size: overrides.size ?? file.size,
    type: overrides.type ?? 'pdf',
    previewUrl: overrides.previewUrl,
  };
}

function createProps(overrides: Partial<ComponentProps<typeof PdfFilesSection>> = {}): ComponentProps<typeof PdfFilesSection> {
  const files = overrides.files ?? [
    createAppFileFixture({ id: 'pdf-1', name: 'contract.pdf', size: 1200 }),
    createAppFileFixture({ id: 'pdf-2', name: 'invoice.pdf', size: 2400 }),
  ];

  return {
    files,
    selectedIds: overrides.selectedIds ?? new Set(['pdf-2']),
    sortConfig: overrides.sortConfig ?? { key: 'name', order: 'asc' },
    editingFileId: overrides.editingFileId ?? null,
    editingName: overrides.editingName ?? '',
    onEditingNameChange: overrides.onEditingNameChange ?? vi.fn(),
    onCancelEditing: overrides.onCancelEditing ?? vi.fn(),
    onSaveRename: overrides.onSaveRename ?? vi.fn(),
    onStartRename: overrides.onStartRename ?? vi.fn(),
    onToggleAll: overrides.onToggleAll ?? vi.fn(),
    onToggleSelection: overrides.onToggleSelection ?? vi.fn(),
    onSort: overrides.onSort ?? vi.fn(),
    onOpenPreview: overrides.onOpenPreview ?? vi.fn(),
    onDuplicate: overrides.onDuplicate ?? vi.fn(),
    onAskAi: overrides.onAskAi ?? vi.fn(),
    onExtractImages: overrides.onExtractImages ?? vi.fn(),
    extractingImagesId: overrides.extractingImagesId ?? null,
    onConvertToVector: overrides.onConvertToVector ?? vi.fn(),
    convertingToImgId: overrides.convertingToImgId ?? null,
    onEditPages: overrides.onEditPages ?? vi.fn(),
    onRemove: overrides.onRemove ?? vi.fn(),
    onDeleteSelected: overrides.onDeleteSelected ?? vi.fn(),
    onCompress: overrides.onCompress ?? vi.fn(),
    isCompressing: overrides.isCompressing ?? false,
    onMergeSelected: overrides.onMergeSelected ?? vi.fn(),
    isMerging: overrides.isMerging ?? false,
  };
}

describe('PdfFilesSection', () => {
  it('routes per-file actions through the provided callbacks', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<PdfFilesSection {...props} />);

    const firstRow = screen.getByText('contract.pdf').closest('li');
    expect(firstRow).not.toBeNull();

    const row = within(firstRow as HTMLLIElement);

    await user.click(row.getByTitle('Rename'));
    expect(props.onStartRename).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Duplicate'));
    expect(props.onDuplicate).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Preview File'));
    expect(props.onOpenPreview).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('AI Assistant'));
    expect(props.onAskAi).toHaveBeenLastCalledWith([props.files[0]]);

    await user.click(row.getByTitle('Extract Images'));
    expect(props.onExtractImages).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Convert Pages to Vector (SVG)'));
    expect(props.onConvertToVector).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Preview & Edit Pages'));
    expect(props.onEditPages).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Remove file'));
    expect(props.onRemove).toHaveBeenCalledWith('pdf-1');
  });

  it('uses the selected files for bulk actions and routes sorting callbacks', async () => {
    const user = userEvent.setup();
    const props = createProps({ selectedIds: new Set(['pdf-1', 'pdf-2']) });

    render(<PdfFilesSection {...props} />);

    await user.click(screen.getByText('SIZE'));
    expect(props.onSort).toHaveBeenCalledWith('size');

    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(props.onToggleAll).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(props.onAskAi).toHaveBeenLastCalledWith(props.files);

    await user.click(screen.getByRole('button', { name: 'Delete Selected' }));
    expect(props.onDeleteSelected).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByRole('combobox'), 'high');
    expect(props.onCompress).toHaveBeenCalledWith('high');

    await user.click(screen.getByRole('button', { name: 'Merge Selected' }));
    expect(props.onMergeSelected).toHaveBeenCalledTimes(1);
  });

  it('saves inline rename edits with the current file id', async () => {
    const user = userEvent.setup();
    const props = createProps({
      editingFileId: 'pdf-1',
      editingName: 'renamed-contract.pdf',
    });

    render(<PdfFilesSection {...props} />);

    const input = screen.getByDisplayValue('renamed-contract.pdf');
    await user.type(input, '{Enter}');

    expect(props.onSaveRename).toHaveBeenCalledWith('pdf-1');
  });
});