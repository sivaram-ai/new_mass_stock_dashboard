/*
 * Placeholders shown by each route's loading.js while the server renders.
 *
 * Not a client component: these are static markup, so they ship no JS and can
 * stream immediately. They exist to make navigation feel instantaneous — Next
 * shows them the moment a link is clicked, instead of leaving the previous page
 * on screen with nothing happening.
 */

export function Bar({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export function TableSkeleton({ rows = 8, title = true }) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Bar className="h-5 w-40" />
            <Bar className="h-3 w-28" />
          </div>
          <Bar className="h-9 w-56" />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
            {Array.from({ length: 6 }).map((__, j) => (
              <Bar key={j} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ cards = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <Bar className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bar className="h-5 w-12" />
            <Bar className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ className = '', lines = 6 }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-200 px-5 py-3">
        <Bar className="h-4 w-36" />
      </div>
      <div className="space-y-3 p-5">
        {Array.from({ length: lines }).map((_, i) => (
          <Bar key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
