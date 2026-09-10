/**
 * Comparator shared by the Inventory and Item Config tables.
 *
 * Empty values (null/undefined/'') always sort last regardless of direction,
 * so a column of mostly-blank optional fields stays readable either way.
 * Strings compare naturally, so "Item 2" precedes "Item 10".
 */
export function compare(a, b, key, dir) {
  const av = a[key];
  const bv = b[key];
  const aEmpty = av === null || av === undefined || av === '';
  const bEmpty = bv === null || bv === undefined || bv === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const result =
    typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : typeof av === 'boolean' && typeof bv === 'boolean'
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });

  return dir === 'asc' ? result : -result;
}

/** Cycles a sort spec: same column flips direction, a new column starts fresh. */
export function nextSort(current, key, defaultDir = 'asc') {
  return current.key === key
    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: defaultDir };
}
