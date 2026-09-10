import { Bar, TableSkeleton } from '@/components/Skeleton';

export default function HistoryLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Bar className="h-5 w-48" />
        <Bar className="h-3 w-56" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <TableSkeleton rows={10} title={false} />
    </div>
  );
}
