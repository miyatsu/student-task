import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  duplicateAppFile,
  getNextSortConfig,
  isSupportedFile,
  partitionAppFiles,
  removeSelectedFiles,
  renameAppFile,
  resolveZipEntryNames,
  sortAppFiles,
  toggleAllSelection,
  toggleSelection,
} from './file-utils';
import type { AppFile, SortConfig } from './types';

function createAppFileFixture(overrides: Partial<AppFile> = {}): AppFile {
  const file = overrides.file ?? new File(['content'], overrides.name ?? 'fixture.pdf', {
    type: overrides.type === 'image' ? 'image/png' : overrides.type === 'word' ? 'application/msword' : 'application/pdf',
    lastModified: 100,
  });

  return {
    id: overrides.id ?? 'file-1',
    file,
    name: overrides.name ?? file.name,
    size: overrides.size ?? file.size,
    type: overrides.type ?? 'pdf',
    previewUrl: overrides.previewUrl,
  };
}

describe('file-utils', () => {
  it('recognizes supported files', () => {
    assert.equal(isSupportedFile(new File(['pdf'], 'report.pdf', { type: 'application/pdf' })), true);
    assert.equal(isSupportedFile(new File(['docx'], 'notes.docx', { type: '' })), true);
    assert.equal(isSupportedFile(new File(['img'], 'photo.jpg', { type: 'image/jpeg' })), true);
    assert.equal(isSupportedFile(new File(['txt'], 'plain.txt', { type: 'text/plain' })), false);
  });

  it('partitions files and creates image preview URLs', () => {
    const ids = ['pdf-1', 'img-1', 'word-1'];
    const groupedFiles = partitionAppFiles(
      [
        new File(['pdf'], 'report.pdf', { type: 'application/pdf' }),
        new File(['img'], 'photo.jpg', { type: 'image/jpeg' }),
        new File(['word'], 'draft.docx', { type: '' }),
      ],
      {
        idFactory: () => ids.shift() ?? 'fallback-id',
        createPreviewUrl: (file) => `preview://${file.name}`,
      },
    );

    assert.equal(groupedFiles.pdf.length, 1);
    assert.equal(groupedFiles.image.length, 1);
    assert.equal(groupedFiles.word.length, 1);
    assert.equal(groupedFiles.image[0].previewUrl, 'preview://photo.jpg');
  });

  it('toggles individual and all selections', () => {
    const toggledOn = toggleSelection(new Set<string>(), 'image-1');
    assert.deepEqual([...toggledOn], ['image-1']);

    const toggledOff = toggleSelection(toggledOn, 'image-1');
    assert.deepEqual([...toggledOff], []);

    const allSelected = toggleAllSelection(new Set<string>(), [{ id: 'a' }, { id: 'b' }]);
    assert.deepEqual([...allSelected], ['a', 'b']);

    const clearedSelection = toggleAllSelection(allSelected, [{ id: 'a' }, { id: 'b' }]);
    assert.deepEqual([...clearedSelection], []);
  });

  it('derives the next sort config and sorts files deterministically', () => {
    const firstSort = getNextSortConfig(null, 'name');
    const secondSort = getNextSortConfig(firstSort, 'name');
    assert.deepEqual(firstSort, { key: 'name', order: 'asc' });
    assert.deepEqual(secondSort, { key: 'name', order: 'desc' });

    const files = [
      createAppFileFixture({ id: 'b', name: 'b.pdf', size: 3, file: new File(['b'], 'b.pdf', { type: 'application/pdf', lastModified: 300 }) }),
      createAppFileFixture({ id: 'a', name: 'a.pdf', size: 1, file: new File(['a'], 'a.pdf', { type: 'application/pdf', lastModified: 100 }) }),
      createAppFileFixture({ id: 'c', name: 'c.pdf', size: 2, file: new File(['c'], 'c.pdf', { type: 'application/pdf', lastModified: 200 }) }),
    ];

    const sortConfig: SortConfig = { key: 'size', order: 'asc' };
    const sortedFiles = sortAppFiles(files, sortConfig);
    assert.deepEqual(sortedFiles.map((file) => file.id), ['a', 'c', 'b']);
  });

  it('renames, duplicates, and bulk-removes files without mutating source arrays', () => {
    const imageFile = createAppFileFixture({
      id: 'img-1',
      type: 'image',
      name: 'photo.png',
      previewUrl: 'preview://photo.png',
      file: new File(['img'], 'photo.png', { type: 'image/png', lastModified: 10 }),
    });

    const renamedFile = renameAppFile(imageFile, 'renamed.png');
    assert.equal(renamedFile.name, 'renamed.png');
    assert.equal(renamedFile.file.name, 'renamed.png');

    const duplicatedFile = duplicateAppFile(imageFile, {
      idFactory: () => 'img-2',
      createPreviewUrl: (file) => `preview://${file.name}`,
    });
    assert.equal(duplicatedFile.id, 'img-2');
    assert.equal(duplicatedFile.name, 'photo-copy.png');
    assert.equal(duplicatedFile.previewUrl, 'preview://photo-copy.png');

    const remainingFiles = removeSelectedFiles([imageFile, duplicatedFile], new Set(['img-1']));
    assert.deepEqual(remainingFiles.map((file) => file.id), ['img-2']);
  });

  it('assigns stable zip entry names for duplicates', () => {
    const files = [
      createAppFileFixture({ id: '1', name: 'merged.pdf' }),
      createAppFileFixture({ id: '2', name: 'merged.pdf' }),
      createAppFileFixture({ id: '3', name: 'merged.pdf' }),
    ];

    const entries = resolveZipEntryNames(files);
    assert.deepEqual(entries.map((entry) => entry.name), ['merged.pdf', 'merged (2).pdf', 'merged (3).pdf']);
  });
});