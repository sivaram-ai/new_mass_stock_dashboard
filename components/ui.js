/*
 * Deliberately NOT marked 'use client'. Nothing here uses hooks or browser
 * APIs, so these render in Server Components too — which is what lets the
 * dashboard pass an icon component into <EmptyState icon={Star} />. Marking
 * the file 'use client' would put a serialization boundary in the way and
 * that prop would throw. Imported from a Client Component, these are bundled
 * client-side as usual, so event handlers keep working.
 */
import { Loader2 } from 'lucide-react';

export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  credit: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  debit: 'bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-300',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs gap-1',
  md: 'px-3.5 py-2 text-sm gap-1.5',
  lg: 'px-5 py-2.5 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400',
        className
      )}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
        'disabled:bg-slate-50 disabled:text-slate-400',
        className
      )}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, htmlFor, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Card({ className, children, id }) {
  return (
    <div id={id} className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'slate', className, children }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Alert({ tone = 'error', children }) {
  if (!children) return null;
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-3 py-2 text-sm', tones[tone])}
    >
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {Icon && <Icon className="h-8 w-8 text-slate-300" aria-hidden="true" />}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {children && <p className="max-w-sm text-xs text-slate-400">{children}</p>}
    </div>
  );
}
