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

export const MIGRATION_HINT =
  'Low stock alerts are inactive until supabase/migrations/0002_add_alert_size.sql is run.';
