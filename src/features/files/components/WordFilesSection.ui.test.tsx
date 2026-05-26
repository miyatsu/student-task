import type { ComponentProps } from 'react';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AppFile } from '../types';
import { WordFilesSection } from './WordFilesSection';

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
  const file = overrides.file ?? new File(['word'], overrides.name ?? 'fixture.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: 100,
  });

  return {
    id: overrides.id ?? 'word-1',
    file,
    name: overrides.name ?? file.name,
    size: overrides.size ?? file.size,
    type: overrides.type ?? 'word',
    previewUrl: overrides.previewUrl,
  };
}

function createProps(overrides: Partial<ComponentProps<typeof WordFilesSection>> = {}): ComponentProps<typeof WordFilesSection> {
  const files = overrides.files ?? [
    createAppFileFixture({ id: 'word-1', name: 'proposal.docx', size: 1800 }),
    createAppFileFixture({ id: 'word-2', name: 'minutes.docx', size: 2400 }),
  ];

  return {
    files,
    selectedIds: overrides.selectedIds ?? new Set(['word-2']),
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
    onMove: overrides.onMove ?? vi.fn(),
    onOpenPreview: overrides.onOpenPreview ?? vi.fn(),
    onDuplicate: overrides.onDuplicate ?? vi.fn(),
    onAskAi: overrides.onAskAi ?? vi.fn(),
    onRemove: overrides.onRemove ?? vi.fn(),
    onDeleteSelected: overrides.onDeleteSelected ?? vi.fn(),
    onConvertSelected: overrides.onConvertSelected ?? vi.fn(),
    isConverting: overrides.isConverting ?? false,
    conversionProgress: overrides.conversionProgress ?? null,
  };
}

describe('WordFilesSection', () => {
  it('routes per-file actions through the provided callbacks', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<WordFilesSection {...props} />);

    const firstRow = screen.getByText('proposal.docx').closest('li');
    expect(firstRow).not.toBeNull();

    const row = within(firstRow as HTMLLIElement);

    await user.click(row.getByTitle('Rename'));
    expect(props.onStartRename).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Duplicate'));
    expect(props.onDuplicate).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('Move down'));
    expect(props.onMove).toHaveBeenCalledWith('word-1', 'down');

    await user.click(row.getByTitle('Preview File'));
    expect(props.onOpenPreview).toHaveBeenCalledWith(props.files[0]);

    await user.click(row.getByTitle('AI Assistant'));
    expect(props.onAskAi).toHaveBeenLastCalledWith([props.files[0]]);

    await user.click(row.getByTitle('Remove file'));
    expect(props.onRemove).toHaveBeenCalledWith('word-1');
  });

  it('uses the selected files for bulk actions and routes sorting callbacks', async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<WordFilesSection {...props} />);

    await user.click(screen.getByText('DATE'));
    expect(props.onSort).toHaveBeenCalledWith('date');

    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(props.onToggleAll).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(props.onAskAi).toHaveBeenLastCalledWith([props.files[1]]);

    await user.click(screen.getByRole('button', { name: 'Delete Selected' }));
    expect(props.onDeleteSelected).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'To PDF' }));
    expect(props.onConvertSelected).toHaveBeenCalledTimes(1);
  });

  it('shows word conversion progress details while converting', () => {
    const props = createProps({
      isConverting: true,
      conversionProgress: {
        completed: 2,
        total: 5,
        currentFileName: 'archive.doc',
      },
    });

    render(<WordFilesSection {...props} />);

    expect(screen.getByRole('status')).toHaveTextContent('Converting Word documents to PDF');
    expect(screen.getByRole('status')).toHaveTextContent('2/5');
    expect(screen.getByRole('status')).toHaveTextContent('Now converting archive.doc');
  });

  it('saves inline rename edits with the current file id', async () => {
    const user = userEvent.setup();
    const props = createProps({
      editingFileId: 'word-1',
      editingName: 'renamed-proposal.docx',
    });

    render(<WordFilesSection {...props} />);

    const input = screen.getByDisplayValue('renamed-proposal.docx');
    await user.type(input, '{Enter}');

    expect(props.onSaveRename).toHaveBeenCalledWith('word-1');
  });
});