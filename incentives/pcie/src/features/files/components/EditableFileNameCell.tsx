import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { Check, Edit2, X } from 'lucide-react';

interface EditableFileNameCellProps {
  fileName: string;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onOpen: () => void;
  onStartRename: (event: MouseEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
}

export function EditableFileNameCell({
  fileName,
  isEditing,
  editingName,
  onEditingNameChange,
  onSave,
  onCancel,
  onOpen,
  onStartRename,
  children,
}: EditableFileNameCellProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSave();
    }

    if (event.key === 'Escape') {
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="text"
          value={editingName}
          onChange={(event) => onEditingNameChange(event.target.value)}
          className="flex-1 border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
          onKeyDown={handleKeyDown}
        />
        <button onClick={onSave} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={onCancel} className="p-1 text-red-600 hover:bg-red-50 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex items-center gap-2 group cursor-pointer" onClick={onOpen}>
      <p className="text-sm font-medium text-zinc-900 truncate hover:text-indigo-600 transition-colors">
        {fileName}
      </p>
      <button
        onClick={onStartRename}
        className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
        title="Rename"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
}