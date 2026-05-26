import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

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
    return <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />;
  }

  return sortConfig.order === 'asc'
    ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
    : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />;
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
    <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
        />
        <h3 className="font-semibold text-zinc-700">{title} ({fileCount})</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white/90 px-2 py-2 shadow-sm">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">Sort by</span>
        {sortOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => onSort(option.key)}
            title={`Sort by ${option.label.toLowerCase()}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.18em] transition-all ${sortConfig?.key === option.key
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
              : 'border-transparent bg-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <SortIcon sortConfig={sortConfig} sortKey={option.key} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}