import type { AppFile, AppFileType, SortConfig, SortKey } from './types';

const supportedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg']);
const supportedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  ...supportedImageMimeTypes,
]);

interface AppFileFactoryOptions {
  idFactory?: () => string;
  createPreviewUrl?: (file: File) => string;
}

export function createFileId() {
  return Math.random().toString(36).substring(7);
}

function hasWordExtension(fileName: string) {
  const lowerCaseFileName = fileName.toLowerCase();
  return lowerCaseFileName.endsWith('.doc') || lowerCaseFileName.endsWith('.docx');
}

function splitFileName(fileName: string) {
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return { baseName: fileName, extension: '' };
  }

  return {
    baseName: fileName.slice(0, extensionIndex),
    extension: fileName.slice(extensionIndex),
  };
}

function createPreviewUrl(file: File, previewUrlFactory?: (file: File) => string) {
  if (previewUrlFactory) {
    return previewUrlFactory(file);
  }

  return URL.createObjectURL(file);
}

export function isSupportedFile(file: File) {
  return supportedMimeTypes.has(file.type) || hasWordExtension(file.name);
}

export function resolveAppFileType(file: File): AppFileType {
  if (file.type === 'application/pdf') {
    return 'pdf';
  }

  if (hasWordExtension(file.name) || file.type.includes('word')) {
    return 'word';
  }

  return 'image';
}

export function createAppFile(file: File, options: AppFileFactoryOptions = {}): AppFile {
  const type = resolveAppFileType(file);

  return {
    id: options.idFactory?.() ?? createFileId(),
    file,
    name: file.name,
    size: file.size,
    type,
    previewUrl: type === 'image' ? createPreviewUrl(file, options.createPreviewUrl) : undefined,
  };
}

export function partitionAppFiles(files: Iterable<File>, options: AppFileFactoryOptions = {}) {
  const groupedFiles: Record<AppFileType, AppFile[]> = {
    pdf: [],
    image: [],
    word: [],
  };

  for (const file of files) {
    const appFile = createAppFile(file, options);
    groupedFiles[appFile.type].push(appFile);
  }

  return groupedFiles;
}

export function removeAppFile(files: AppFile[], id: string) {
  return files.filter((file) => file.id !== id);
}

export function toggleSelection(selectedIds: Set<string>, id: string) {
  const nextSelection = new Set(selectedIds);
  if (nextSelection.has(id)) {
    nextSelection.delete(id);
  } else {
    nextSelection.add(id);
  }

  return nextSelection;
}

export function toggleAllSelection(selectedIds: Set<string>, files: Pick<AppFile, 'id'>[]) {
  if (files.length > 0 && selectedIds.size === files.length) {
    return new Set<string>();
  }

  return new Set(files.map((file) => file.id));
}

export function removeSelectedFiles(files: AppFile[], selectedIds: Set<string>) {
  return files.filter((file) => !selectedIds.has(file.id));
}

export function getNextSortConfig(currentConfig: SortConfig | null, key: SortKey): SortConfig {
  return {
    key,
    order: currentConfig?.key === key && currentConfig.order === 'asc' ? 'desc' : 'asc',
  };
}

function compareFiles(left: AppFile, right: AppFile, key: SortKey) {
  switch (key) {
    case 'name':
      return left.name.localeCompare(right.name);
    case 'size':
      return left.size - right.size;
    case 'date':
      return left.file.lastModified - right.file.lastModified;
  }
}

export function sortAppFiles(files: AppFile[], config: SortConfig) {
  return [...files].sort((left, right) => {
    const comparison = compareFiles(left, right, config.key);
    return config.order === 'asc' ? comparison : -comparison;
  });
}

export function renameAppFile(file: AppFile, nextName: string): AppFile {
  const renamedFile = new File([file.file], nextName, { type: file.file.type });
  return {
    ...file,
    file: renamedFile,
    name: nextName,
  };
}

export function duplicateAppFile(file: AppFile, options: AppFileFactoryOptions = {}): AppFile {
  const { baseName, extension } = splitFileName(file.name);
  const nextName = `${baseName}-copy${extension}`;
  const duplicatedFile = new File([file.file], nextName, { type: file.file.type });

  return {
    ...file,
    id: options.idFactory?.() ?? createFileId(),
    file: duplicatedFile,
    name: nextName,
    previewUrl: file.type === 'image' ? createPreviewUrl(duplicatedFile, options.createPreviewUrl) : undefined,
  };
}

export function selectFilesByIds(files: AppFile[], selectedIds: Set<string>) {
  return files.filter((file) => selectedIds.has(file.id));
}

export function resolveZipEntryNames(files: AppFile[]) {
  const nameCounts = new Map<string, number>();

  return files.map((file) => {
    const nextCount = (nameCounts.get(file.name) ?? 0) + 1;
    nameCounts.set(file.name, nextCount);

    if (nextCount === 1) {
      return { file, name: file.name };
    }

    const { baseName, extension } = splitFileName(file.name);
    return {
      file,
      name: `${baseName} (${nextCount})${extension}`,
    };
  });
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) {
    return '0 Bytes';
  }

  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${Number.parseFloat((bytes / 1024 ** unitIndex).toFixed(dm))} ${sizes[unitIndex]}`;
}