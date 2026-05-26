import { ArrowDown, ArrowUp } from 'lucide-react';

interface MoveFileButtonsProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function MoveFileButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: MoveFileButtonsProps) {
  const baseClassName = 'p-1 rounded-md transition-colors';

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        className={`${baseClassName} ${canMoveUp ? 'text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50' : 'text-zinc-200 cursor-not-allowed'}`}
        title="Move up"
        aria-label="Move up"
      >
        <ArrowUp className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        className={`${baseClassName} ${canMoveDown ? 'text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50' : 'text-zinc-200 cursor-not-allowed'}`}
        title="Move down"
        aria-label="Move down"
      >
        <ArrowDown className="w-4 h-4" />
      </button>
    </div>
  );
}