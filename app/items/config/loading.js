import { Bar, PanelSkeleton, TableSkeleton } from '@/components/Skeleton';

export default function ItemConfigLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bar className="h-5 w-44" />
        <Bar className="h-3 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <PanelSkeleton lines={8} />
        <div className="lg:col-span-2">
          <TableSkeleton rows={8} title={false} />
        </div>
      </div>
    </div>
  );
}
