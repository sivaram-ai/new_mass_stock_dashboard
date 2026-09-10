/**
 * Shared query builder for the master history log.
 *
 * Used by both the server pre-render and the client refetch so the two can
 * never drift into returning differently shaped or differently filtered rows.
 */

export const HISTORY_PAGE_SIZE = 50;

export const HISTORY_COLUMNS =
  'id, item_id, item_name, item_code, category_name, action_type, quantity_changed, new_total, notes, user_id, user_name, created_at';

export const BLANK_HISTORY_FILTERS = {
  from: '',
  to: '',
  itemId: '',
  userId: '',
  action: '',
  notes: '',
};

export const DEFAULT_HISTORY_SORT = { key: 'created_at', dir: 'desc' };

/**
 * `withCount` is deliberately opt-in. Asking PostgREST for an exact count makes
 * it run a second COUNT over the whole filtered set, which on a large history
 * table costs as much as the page query itself. The total only changes when the
 * filters change, so paging and re-sorting reuse the count already held.
 */
export function buildHistoryQuery(
  supabase,
  { filters = BLANK_HISTORY_FILTERS, sort = DEFAULT_HISTORY_SORT, page = 0, withCount = false } = {}
) {
  let query = supabase
    .from('inventory_history_view')
    .select(HISTORY_COLUMNS, withCount ? { count: 'exact' } : undefined);

  if (filters.from) query = query.gte('created_at', new Date(filters.from).toISOString());
  if (filters.to) {
    // The date input gives a day; include everything up to its final moment.
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    query = query.lte('created_at', end.toISOString());
  }
  if (filters.itemId) query = query.eq('item_id', filters.itemId);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.action) query = query.eq('action_type', filters.action);
  if (filters.notes.trim()) query = query.ilike('notes', `%${filters.notes.trim()}%`);

  return query
    .order(sort.key, { ascending: sort.dir === 'asc', nullsFirst: false })
    .range(page * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE - 1);
}

/** Identity of a result set for counting purposes: only filters affect the total. */
export function historyCountKey(filters) {
  return JSON.stringify(filters);
}
