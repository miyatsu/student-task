import { ArrowDown, ArrowUp } from 'lucide-react';

import type { SortConfig, SortKey } from '../types';

interface FileSectionHeaderProps {
  title: string;
  fileCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  sortConfig: SortConfig | null;
  onSort: (key: SortKey) => void;
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'NAME' },
  { key: 'date', label: 'DATE' },
  { key: 'size', label: 'SIZE' },
];

function SortIcon({ sortConfig, sortKey }: { sortConfig: SortConfig | null; sortKey: SortKey }) {
  if (!sortConfig || sortConfig.key !== sortKey) {
    return null;
  }

  return sortConfig.order === 'asc'
    ? <ArrowUp className="inline w-3 h-3 ml-1 text-indigo-600" />
    : <ArrowDown className="inline w-3 h-3 ml-1 text-indigo-600" />;
}

export function FileSectionHeader({
  title,
  fileCount,
  allSelected,
  onToggleAll,
  sortConfig,
  onSort,
}: FileSectionHeaderProps) {
  return (
    <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
        />
        <h3 className="font-semibold text-zinc-700">{title} ({fileCount})</h3>
      </div>
      <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
        {sortOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => onSort(option.key)}
            className="hover:text-zinc-900 transition-colors flex items-center"
          >
            {option.label}
            <SortIcon sortConfig={sortConfig} sortKey={option.key} />
          </button>
        ))}
      </div>
    </div>
  );
}