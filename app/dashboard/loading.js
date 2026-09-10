import { Bar, CardGridSkeleton, PanelSkeleton } from '@/components/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bar className="h-6 w-56" />
        <Bar className="h-3 w-72" />
      </div>
      <CardGridSkeleton />
      <PanelSkeleton lines={4} />
      <div className="grid gap-6 lg:grid-cols-3">
        <PanelSkeleton className="lg:col-span-2" lines={8} />
        <PanelSkeleton lines={6} />
      </div>
    </div>
  );
}
