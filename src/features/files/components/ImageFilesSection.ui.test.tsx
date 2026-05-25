import type { ComponentProps } from 'react';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AppFile } from '../types';
import { ImageFilesSection } from './ImageFilesSection';

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
  const file = overrides.file ?? new File(['image'], overrides.name ?? 'fixture.png', {
    type: 'image/png',
    lastModified: 100,
  });

  return {
    id: overrides.id ?? 'image-1',
    file,
    name: overrides.name ?? file.name,
    size: overrides.size ?? file.size,
    type: overrides.type ?? 'image',
    previewUrl: overrides.previewUrl ?? `preview://${overrides.name ?? file.name}`,
  };
}

function createProps(overrides: Partial<ComponentProps<typeof ImageFilesSection>> = {}): ComponentProps<typeof ImageFilesSection> {
  const files = overrides.files ?? [
    createAppFileFixture({ id: 'image-1', name: 'cover.png', size: 1200 }),
    createAppFileFixture({ id: 'image-2', name: 'receipt.png', size: 2400 }),
  ];

  return {
    files,
    selectedIds: overrides.selectedIds ?? new Set(['image-2']),
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
    onRotate: overrides.onRotate ?? vi.fn(),
    onEnhance: overrides.onEnhance ?? vi.fn(),
    onAskAi: overrides.onAskAi ?? vi.fn(),
    onExtractText: overrides.onExtractText ?? vi.fn(),
    extractingTextId: overrides.extractingTextId ?? null,
    onRemove: overrides.onRemove ?? vi.fn(),
    onDeleteSelected: overrides.onDeleteSelected ?? vi.fn(),
    onCompress: overrides.onCompress ?? vi.fn(),
    isCompressing: overrides.isCompressing ?? false,
    onConvertSelected: overrides.onConvertSelected ?? vi.fn(),
    isConverting: overrides.isConverting ?? false,
  };
}

describe('ImageFilesSection', () => {
  it('routes per-file actions through the provided callbacks', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<ImageFilesSection {...props} />);

    const firstRow = screen.getByText('cover.png').closest('li');
    expect(firstRow).not.toBeNull();

    const row = within(firstRow as HTMLLIElement);

    await user.click(row.getByTitle('Rename'));
    expect(props.onStartRename).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Duplicate'));
    expect(props.onDuplicate).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Rotate 90°'));
    expect(props.onRotate).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Enhance Image'));
    expect(props.onEnhance).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Preview File'));
    expect(props.onOpenPreview).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('AI Assistant'));
    expect(props.onAskAi).toHaveBeenLastCalledWith([props.files[0]]);

    await user.click(row.getByTitle('Extract Text (OCR)'));
    expect(props.onExtractText).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Remove file'));
    expect(props.onRemove).toHaveBeenCalledWith('image-1');
  });

  it('uses the selected files for bulk actions and routes sorting callbacks', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<ImageFilesSection {...props} />);

    await user.click(screen.getByText('NAME'));
    expect(props.onSort).toHaveBeenCalledWith('name');

    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(props.onToggleAll).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(props.onAskAi).toHaveBeenLastCalledWith([props.files[1]]);

    await user.click(screen.getByRole('button', { name: 'Delete Selected' }));
    expect(props.onDeleteSelected).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Convert to PDF' }));
    expect(props.onConvertSelected).toHaveBeenCalledTimes(1);
  });

  it('saves inline rename edits with the current file id', async () => {
    const user = userEvent.setup();
    const props = createProps({
      editingFileId: 'image-1',
      editingName: 'renamed-cover.png',
    });

    render(<ImageFilesSection {...props} />);

    const input = screen.getByDisplayValue('renamed-cover.png');
    await user.type(input, '{Enter}');

    expect(props.onSaveRename).toHaveBeenCalledWith('image-1');
  });

  it('cancels inline rename edits on escape', async () => {
    const user = userEvent.setup();
    const props = createProps({
      editingFileId: 'image-1',
      editingName: 'renamed-cover.png',
    });

    render(<ImageFilesSection {...props} />);

    const input = screen.getByDisplayValue('renamed-cover.png');
    await user.type(input, '{Escape}');

    expect(props.onCancelEditing).toHaveBeenCalledTimes(1);
  });
});