import { describe, expect, it } from 'vitest';
import { compare, nextSort } from '@/lib/table';

const sortBy = (rows, key, dir) => [...rows].sort((a, b) => compare(a, b, key, dir));

describe('compare', () => {
  it('orders numbers numerically, not lexicographically', () => {
    const rows = [{ n: 91.34 }, { n: 186.38 }, { n: 9 }];
    expect(sortBy(rows, 'n', 'asc').map((r) => r.n)).toEqual([9, 91.34, 186.38]);
    expect(sortBy(rows, 'n', 'desc').map((r) => r.n)).toEqual([186.38, 91.34, 9]);
  });

  it('orders strings naturally, so Item 2 precedes Item 10', () => {
    const rows = [{ s: 'Item 10' }, { s: 'Item 2' }];
    expect(sortBy(rows, 's', 'asc').map((r) => r.s)).toEqual(['Item 2', 'Item 10']);
  });

  it('is case insensitive', () => {
    const rows = [{ s: 'banana' }, { s: 'Apple' }];
    expect(sortBy(rows, 's', 'asc').map((r) => r.s)).toEqual(['Apple', 'banana']);
  });

  it('keeps empty values last in BOTH directions', () => {
    // Optional columns are mostly blank; burying them keeps the column readable
    // whichever way it is pointing.
    const rows = [{ s: 'b' }, { s: null }, { s: 'a' }, { s: '' }, { s: undefined }];
    expect(sortBy(rows, 's', 'asc').slice(0, 2).map((r) => r.s)).toEqual(['a', 'b']);
    expect(sortBy(rows, 's', 'desc').slice(0, 2).map((r) => r.s)).toEqual(['b', 'a']);
    expect(sortBy(rows, 's', 'asc').slice(2).every((r) => !r.s)).toBe(true);
    expect(sortBy(rows, 's', 'desc').slice(2).every((r) => !r.s)).toBe(true);
  });

  it('orders booleans false-then-true ascending', () => {
    const rows = [{ b: true }, { b: false }];
    expect(sortBy(rows, 'b', 'asc').map((r) => r.b)).toEqual([false, true]);
    expect(sortBy(rows, 'b', 'desc').map((r) => r.b)).toEqual([true, false]);
  });

  it('treats zero as a real value, not as empty', () => {
    // Regression guard: a truthiness check here would bury every zero-stock
    // item at the bottom, which is exactly the row you most need to see.
    const rows = [{ n: 5 }, { n: 0 }, { n: 3 }];
    expect(sortBy(rows, 'n', 'asc').map((r) => r.n)).toEqual([0, 3, 5]);
  });
});

describe('nextSort', () => {
  it('flips direction when the same column is clicked again', () => {
    expect(nextSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSort({ key: 'name', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' });
  });

  it('starts a new column fresh rather than inheriting the old direction', () => {
    expect(nextSort({ key: 'name', dir: 'desc' }, 'stock')).toEqual({ key: 'stock', dir: 'asc' });
  });

  it('honours a per-column default direction', () => {
    expect(nextSort({ key: 'name', dir: 'asc' }, 'created_at', 'desc')).toEqual({
      key: 'created_at',
      dir: 'desc',
    });
  });
});
