'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Minus, Plus, X } from 'lucide-react';

const DEFAULT_DURATION = 4000;

/** Newest-first; anything past this is dropped so the stack can't run off screen. */
const MAX_VISIBLE = 5;

/**
 * Toast queue for transient action feedback.
 *
 * Ids come from a monotonic counter rather than Date.now(): rapid clicks land
 * inside the same millisecond, and duplicate keys would make React reuse a
 * node, so one toast would visually overwrite another instead of stacking.
 */
export function useToasts(duration = DEFAULT_DURATION) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (toast) => {
      nextId.current += 1;
      const id = nextId.current;

      setToasts((current) => [{ ...toast, id }, ...current].slice(0, MAX_VISIBLE));

      const timer = setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
        timers.current.delete(id);
      }, toast.duration ?? duration);
      timers.current.set(id, timer);

      return id;
    },
    [duration]
  );

  // Clear pending timers on unmount so they can't fire against a dead component.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return { toasts, pushToast, dismissToast };
}

const TONES = {
  credit: {
    icon: Plus,
    wrap: 'border-emerald-200 bg-white',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  debit: {
    icon: Minus,
    wrap: 'border-amber-200 bg-white',
    badge: 'bg-amber-100 text-amber-800',
  },
  success: {
    icon: Check,
    wrap: 'border-emerald-200 bg-white',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  error: {
    icon: AlertTriangle,
    wrap: 'border-red-200 bg-white',
    badge: 'bg-red-100 text-red-700',
  },
};

/**
 * Fixed-position toast stack, anchored bottom-LEFT.
 *
 * `fixed` keeps it out of document flow entirely — the inventory rows behind it
 * never move, which is the whole point: a row that shifts under a rapid
 * click-through gets the wrong item credited or debited.
 *
 * Left rather than right because the inventory table's +/- buttons sit at the
 * far right of every row, and each toast is `pointer-events-auto` so it can be
 * dismissed. Stacked on the right they covered the very buttons being clicked,
 * so a rapid run of adjustments ended up blocking itself.
 */
export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.tone] ?? TONES.success;
        const Icon = tone.icon;

        return (
          <div
            key={toast.id}
            // assertive for errors so a failed adjustment interrupts; polite
            // otherwise, so a burst of successes doesn't spam a screen reader.
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg ${tone.wrap}`}
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone.badge}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-slate-500">{toast.description}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
