/**
 * Item reads and writes that tolerate a database which has not run migration
 * 0002 yet (`items.alert_size`).
 *
 * Without this, deploying the app before applying the migration takes every
 * item screen down with a raw "column items.alert_size does not exist" error.
 * Instead each query asks for the column, and on the specific undefined-column
 * error retries without it — low stock alerts stay dormant, everything else
 * keeps working.
 *
 * Nothing is cached: the full query is always attempted first, so the moment
 * the migration lands the app picks the column up with no restart. The only
 * cost is one wasted round trip per load while the database is behind.
 */

/** Postgres 42703 = undefined_column. */
export function isMissingColumnError(error, column) {
  if (!error) return false;
  if (error.code === '42703') {
    return column ? String(error.message ?? '').includes(column) : true;
  }
  return false;
}

/**
 * Select from `items`, adding `alert_size` when the database has it.
 *
 * @param supabase  a Supabase client
 * @param columns   column list WITHOUT alert_size (embeds like
 *                  "categories(name)" are fine)
 * @param apply     optional chain of .order()/.eq()/... applied to the builder
 * @returns the PostgREST result, plus `alertSizeSupported`
 */
export async function selectItems(supabase, columns, apply = (query) => query) {
  const run = (cols) => apply(supabase.from('items').select(cols));

  const withAlert = await run(`${columns}, alert_size`);
  if (!withAlert.error) {
    return { ...withAlert, alertSizeSupported: true };
  }
  if (!isMissingColumnError(withAlert.error, 'alert_size')) {
    return { ...withAlert, alertSizeSupported: true };
  }

  const withoutAlert = await run(columns);
  return { ...withoutAlert, alertSizeSupported: false };
}

/**
 * Insert or update an item, dropping `alert_size` if the column is absent.
 *
 * @returns `{ data, error, alertSizeSupported }` — when false, the row saved
 *          but its alert threshold was discarded, and the caller should say so.
 */
export async function saveItem(supabase, payload, id = null) {
  const run = (body) =>
    id
      ? supabase.from('items').update(body).eq('id', id)
      : supabase.from('items').insert([body]).select('id').single();

  const first = await run(payload);
  if (!first.error) {
    return { ...first, alertSizeSupported: true };
  }
  if (!isMissingColumnError(first.error, 'alert_size')) {
    return { ...first, alertSizeSupported: true };
  }

  const { alert_size: _dropped, ...rest } = payload;
  const second = await run(rest);
  return { ...second, alertSizeSupported: false };
}

/**
 * Column list for the inventory and item-config tables. Shared so the server
 * pre-render and any later client refetch return identically shaped rows —
 * a mismatch would make the table flicker or lose a column on refresh.
 * alert_size is appended by selectItems() when the database has it.
 */
export const ITEM_LIST_COLUMNS =
  'id, name, shortcut_code, category_id, size, unit, current_stock, is_important, display_order, categories(name)';

/**
 * Flattens the embedded category and coerces stock to a number, so the value
 * sorts and filters like any other column. Must be applied to both the
 * server-rendered rows and any client refetch.
 */
export function normaliseItemRow(row) {
  return {
    ...row,
    current_stock: Number(row.current_stock ?? 0),
    category_name: row.categories?.name ?? '',
  };
}

export const MIGRATION_HINT =
  'Low stock alerts are inactive until supabase/migrations/0002_add_alert_size.sql is run.';
