import { Bar, PanelSkeleton } from '@/components/Skeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bar className="h-5 w-48" />
        <Bar className="h-3 w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton lines={8} />
        <PanelSkeleton lines={8} />
      </div>
    </div>
  );
}
