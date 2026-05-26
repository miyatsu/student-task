export type AppFileType = 'pdf' | 'image' | 'word';

export interface AppFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: AppFileType;
  previewUrl?: string;
}

export type SortKey = 'name' | 'date' | 'size';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  order: SortOrder;
}