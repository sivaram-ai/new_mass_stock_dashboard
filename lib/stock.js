/**
 * Low-stock rule, shared by every screen that renders items so the highlight
 * cannot drift between the dashboard, the inventory table and item config.
 *
 * An item is low when it has an alert threshold configured (`alert_size` > 0)
 * and its current stock has fallen to or below it. A null, blank, zero or
 * negative threshold means "no alert configured" and never highlights.
 */
export function isLowStock(item) {
  const threshold = Number(item?.alert_size ?? 0);
  if (!Number.isFinite(threshold) || threshold <= 0) return false;

  const stock = Number(item?.current_stock ?? 0);
  if (!Number.isFinite(stock)) return false;

  return stock <= threshold;
}

/**
 * Normalises the Alert size form field for writing to the database.
 * Blank clears the threshold (null); anything else must be a non-negative
 * whole number, since `items.alert_size` is an integer column.
 *
 * @returns {{ok: true, value: number|null} | {ok: false, error: string}}
 */
export function parseAlertSize(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { ok: true, value: null };
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Alert size must be a number.' };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, error: 'Alert size must be a whole number.' };
  }
  if (value < 0) {
    return { ok: false, error: 'Alert size cannot be negative.' };
  }

  return { ok: true, value };
}

/** Tailwind classes for a table row, so low stock reads the same everywhere. */
export function lowStockRowClass(item, { selected = false } = {}) {
  if (selected) return 'bg-indigo-50/50';
  return isLowStock(item) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50';
}
