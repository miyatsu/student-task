import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Copy, Eye, FileArchive, FileImage, FileText, FileUp, GripVertical, ImagePlus, LayoutGrid, Loader2, Sparkles, Trash2 } from 'lucide-react';

import { formatBytes, selectFilesByIds } from '../file-utils';
import type { AppFile, SortConfig, SortKey } from '../types';
import { EditableFileNameCell } from './EditableFileNameCell';
import { FileSectionHeader } from './FileSectionHeader';
import { MoveFileButtons } from './MoveFileButtons';

type CompressionLevel = 'low' | 'medium' | 'high';

interface PdfFilesSectionProps {
  files: AppFile[];
  selectedIds: Set<string>;
  sortConfig: SortConfig | null;
  editingFileId: string | null;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onCancelEditing: () => void;
  onSaveRename: (id: string) => void;
  onStartRename: (file: AppFile) => void;
  onToggleAll: () => void;
  onToggleSelection: (id: string) => void;
  onSort: (key: SortKey) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onOpenPreview: (file: AppFile) => void;
  onDuplicate: (file: AppFile) => void;
  onAskAi: (files: AppFile[]) => void;
  onExtractImages: (file: AppFile) => void;
  extractingImagesId: string | null;
  onConvertToVector: (file: AppFile) => void;
  convertingToImgId: string | null;
  onEditPages: (file: AppFile) => void;
  onRemove: (id: string) => void;
  onDeleteSelected: () => void;
  onCompress: (level: CompressionLevel) => void;
  isCompressing: boolean;
  onMergeSelected: () => void;
  isMerging: boolean;
}

export function PdfFilesSection({
  files,
  selectedIds,
  sortConfig,
  editingFileId,
  editingName,
  onEditingNameChange,
  onCancelEditing,
  onSaveRename,
  onStartRename,
  onToggleAll,
  onToggleSelection,
  onSort,
  onMove,
  onOpenPreview,
  onDuplicate,
  onAskAi,
  onExtractImages,
  extractingImagesId,
  onConvertToVector,
  convertingToImgId,
  onEditPages,
  onRemove,
  onDeleteSelected,
  onCompress,
  isCompressing,
  onMergeSelected,
  isMerging,
}: PdfFilesSectionProps) {
  if (files.length === 0) {
    return null;
  }

  const allSelected = selectedIds.size === files.length && files.length > 0;
  const selectedFiles = selectFilesByIds(files, selectedIds);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      <FileSectionHeader
        title="PDF Documents"
        fileCount={files.length}
        allSelected={allSelected}
        onToggleAll={onToggleAll}
        sortConfig={sortConfig}
        onSort={onSort}
      />

      <Droppable droppableId="pdf-list" type="pdf">
        {(provided) => (
          <ul
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="divide-y divide-zinc-100"
          >
            {files.map((file, index) => (
              <Draggable key={file.id} draggableId={file.id} index={index}>
                {(draggableProvided, snapshot) => (
                  <li
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    className={`flex items-center p-4 gap-4 bg-white transition-colors
                      ${snapshot.isDragging ? 'shadow-md ring-1 ring-indigo-500/20 z-10' : 'hover:bg-zinc-50'}
                    `}
                  >
                    <div
                      {...draggableProvided.dragHandleProps}
                      className="text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing p-1"
                    >
                      <GripVertical className="w-5 h-5" />
                    </div>

                    <MoveFileButtons
                      canMoveUp={index > 0}
                      canMoveDown={index < files.length - 1}
                      onMoveUp={() => onMove(file.id, 'up')}
                      onMoveDown={() => onMove(file.id, 'down')}
                    />

                    <input
                      type="checkbox"
                      checked={selectedIds.has(file.id)}
                      onChange={() => onToggleSelection(file.id)}
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div
                      className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0 cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => onOpenPreview(file)}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    <EditableFileNameCell
                      fileName={file.name}
                      isEditing={editingFileId === file.id}
                      editingName={editingName}
                      onEditingNameChange={onEditingNameChange}
                      onSave={() => onSaveRename(file.id)}
                      onCancel={onCancelEditing}
                      onOpen={() => onOpenPreview(file)}
                      onStartRename={(event) => {
                        event.stopPropagation();
                        onStartRename(file);
                      }}
                    >
                      <button
                        onClick={(event) => { event.stopPropagation(); onDuplicate(file); }}
                        className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </EditableFileNameCell>

                    <div className="text-xs text-zinc-500 w-20 text-right">
                      {formatBytes(file.size)}
                    </div>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenPreview(file);
                      }}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Preview File"
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onAskAi([file]);
                      }}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="AI Assistant"
                    >
                      <Sparkles className="w-5 h-5" />
                    </button>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onExtractImages(file);
                      }}
                      disabled={extractingImagesId === file.id}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Extract Images"
                    >
                      {extractingImagesId === file.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onConvertToVector(file);
                      }}
                      disabled={convertingToImgId === file.id}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Convert Pages to Vector (SVG)"
                    >
                      {convertingToImgId === file.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileImage className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditPages(file);
                      }}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Preview & Edit Pages"
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(file.id);
                      }}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>

      <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <span className="text-sm text-zinc-500 font-medium whitespace-nowrap">
            {selectedIds.size} PDF(s) selected
          </span>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <button
              onClick={onDeleteSelected}
              disabled={selectedIds.size === 0}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap
                ${selectedIds.size === 0
                  ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200'
                }
              `}
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
            <button
              onClick={() => onAskAi(selectedFiles)}
              disabled={selectedIds.size === 0}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap
                ${selectedIds.size === 0
                  ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:bg-indigo-200'
                }
              `}
            >
              <Sparkles className="w-4 h-4" />
              Ask AI
            </button>
            <div className="flex items-center">
              <div className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap border
                ${selectedIds.size === 0 || isCompressing
                  ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed'
                  : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100 shadow-sm cursor-pointer'
                }`}
              >
                {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                {isCompressing ? 'Compressing...' : 'Compress As...'}
                <select
                  value=""
                  onChange={(event) => onCompress(event.target.value as CompressionLevel)}
                  disabled={selectedIds.size === 0 || isCompressing}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="" disabled>Select Ratio...</option>
                  <option value="low">Low Quality (Smallest)</option>
                  <option value="medium">Medium Quality (Recommended)</option>
                  <option value="high">High Quality (Largest)</option>
                </select>
              </div>
            </div>
            <button
              onClick={onMergeSelected}
              disabled={selectedIds.size < 2 || isMerging}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap
                ${selectedIds.size < 2 || isMerging
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow active:scale-[0.98]'
                }
              `}
            >
              {isMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Merge Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}