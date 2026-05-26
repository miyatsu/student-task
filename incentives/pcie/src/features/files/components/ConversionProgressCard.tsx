export interface ConversionProgressValue {
  completed: number;
  total: number;
  currentFileName: string | null;
}

interface ConversionProgressCardProps {
  title: string;
  progress: ConversionProgressValue;
  currentLabel?: string;
  finalizingLabel?: string;
}

export function ConversionProgressCard({
  title,
  progress,
  currentLabel = 'Now converting',
  finalizingLabel = 'Finalizing converted files',
}: ConversionProgressCardProps) {
  const completedCount = progress.completed;
  const totalCount = progress.total;
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;
  const progressPercent = Math.round(progressRatio * 100);
  const progressDegrees = progressRatio * 360;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 md:flex-row md:items-center md:gap-4" role="status" aria-live="polite">
      <div
        className="relative h-16 w-16 shrink-0 rounded-full"
        style={{ background: `conic-gradient(#16a34a ${progressDegrees}deg, #bbf7d0 ${progressDegrees}deg 360deg)` }}
        aria-hidden="true"
      >
        <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white text-sm font-semibold text-emerald-700">
          {progressPercent}%
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-emerald-900">{title}</p>
          <p className="text-sm font-medium text-emerald-700">{completedCount}/{totalCount}</p>
        </div>
        <p className="truncate text-xs text-emerald-700">
          {progress.currentFileName ? `${currentLabel} ${progress.currentFileName}` : finalizingLabel}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}