import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Copy, Eye, FileImage, FileText, GripVertical, Loader2, Sparkles, Trash2 } from 'lucide-react';

import { formatBytes, selectFilesByIds } from '../file-utils';
import type { AppFile, SortConfig, SortKey } from '../types';
import { EditableFileNameCell } from './EditableFileNameCell';
import { FileSectionHeader } from './FileSectionHeader';

interface WordFilesSectionProps {
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
  onOpenPreview: (file: AppFile) => void;
  onDuplicate: (file: AppFile) => void;
  onAskAi: (files: AppFile[]) => void;
  onRemove: (id: string) => void;
  onDeleteSelected: () => void;
  onConvertSelected: () => void;
  isConverting: boolean;
}

export function WordFilesSection({
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
  onOpenPreview,
  onDuplicate,
  onAskAi,
  onRemove,
  onDeleteSelected,
  onConvertSelected,
  isConverting,
}: WordFilesSectionProps) {
  if (files.length === 0) {
    return null;
  }

  const allSelected = selectedIds.size === files.length && files.length > 0;
  const selectedFiles = selectFilesByIds(files, selectedIds);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden mb-8">
      <FileSectionHeader
        title="Word Documents"
        fileCount={files.length}
        allSelected={allSelected}
        onToggleAll={onToggleAll}
        sortConfig={sortConfig}
        onSort={onSort}
      />

      <Droppable droppableId="word-list" type="word">
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

                    <input
                      type="checkbox"
                      checked={selectedIds.has(file.id)}
                      onChange={() => onToggleSelection(file.id)}
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div
                      className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 cursor-pointer hover:bg-blue-100 transition-colors"
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
                      <button onClick={(event) => { event.stopPropagation(); onDuplicate(file); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate">
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

      <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 flex justify-between items-center overflow-x-auto">
        <span className="text-sm text-zinc-500 whitespace-nowrap min-w-max mr-4">
          {selectedIds.size} document(s) selected
        </span>
        <div className="flex gap-3">
          <button
            onClick={onDeleteSelected}
            disabled={selectedIds.size === 0}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm shrink-0 whitespace-nowrap
              ${selectedIds.size === 0
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                : 'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm hover:shadow active:scale-[0.98]'
              }
            `}
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </button>
          <button
            onClick={() => onAskAi(selectedFiles)}
            disabled={selectedIds.size === 0}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm shrink-0 whitespace-nowrap
              ${selectedIds.size === 0
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-sm hover:shadow active:scale-[0.98]'
              }
            `}
          >
            <Sparkles className="w-4 h-4" />
            Ask AI
          </button>
          <button
            onClick={onConvertSelected}
            disabled={selectedIds.size === 0 || isConverting}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm
              ${selectedIds.size === 0 || isConverting
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow active:scale-[0.98]'
              }
            `}
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <FileImage className="w-4 h-4" />
                To PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}