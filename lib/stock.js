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
 * Nothing left. Always worth flagging, whether or not a threshold is set.
 *
 * A missing item is not an out-of-stock item: without the guard, `item?.x ?? 0`
 * makes null read as zero stock, so a null slipping into a list would be
 * counted as needing attention. This matches isLowStock(), which also returns
 * false for a missing item.
 */
export function isOutOfStock(item) {
  if (!item) return false;

  const stock = Number(item.current_stock ?? 0);
  return Number.isFinite(stock) && stock <= 0;
}

/**
 * "Needs attention": below its alert threshold, or simply empty.
 *
 * The dashboard stat tile, the Low / Out of stock category and the inventory
 * filter all read from this one function, so the count on the tile and the
 * number of rows you land on can never disagree.
 */
export function isLowOrOutOfStock(item) {
  return isLowStock(item) || isOutOfStock(item);
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
