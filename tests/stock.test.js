import { describe, expect, it } from 'vitest';
import { isLowStock, lowStockRowClass, parseAlertSize } from '@/lib/stock';

describe('isLowStock', () => {
  it('flags an item at or below its threshold', () => {
    expect(isLowStock({ current_stock: 5, alert_size: 10 })).toBe(true);
    expect(isLowStock({ current_stock: 10, alert_size: 10 })).toBe(true); // boundary is inclusive
    expect(isLowStock({ current_stock: 0, alert_size: 10 })).toBe(true);
  });

  it('leaves an item above its threshold alone', () => {
    expect(isLowStock({ current_stock: 11, alert_size: 10 })).toBe(false);
    expect(isLowStock({ current_stock: 999, alert_size: 1 })).toBe(false);
  });

  it('treats a missing, blank, zero or negative threshold as "no alert"', () => {
    // The spec is explicit: NULL, empty or 0 must never highlight, no matter
    // how low the stock is.
    expect(isLowStock({ current_stock: 0, alert_size: null })).toBe(false);
    expect(isLowStock({ current_stock: 0, alert_size: undefined })).toBe(false);
    expect(isLowStock({ current_stock: 0, alert_size: '' })).toBe(false);
    expect(isLowStock({ current_stock: 0, alert_size: 0 })).toBe(false);
    expect(isLowStock({ current_stock: 0, alert_size: -5 })).toBe(false);
    expect(isLowStock({ current_stock: 0 })).toBe(false);
  });

  it('survives junk input rather than throwing', () => {
    expect(isLowStock(null)).toBe(false);
    expect(isLowStock(undefined)).toBe(false);
    expect(isLowStock({})).toBe(false);
    expect(isLowStock({ current_stock: 'abc', alert_size: 10 })).toBe(false);
    expect(isLowStock({ current_stock: 5, alert_size: 'abc' })).toBe(false);
  });

  it('accepts numeric strings, which is how PostgREST returns numerics', () => {
    expect(isLowStock({ current_stock: '5', alert_size: '10' })).toBe(true);
    expect(isLowStock({ current_stock: '50', alert_size: '10' })).toBe(false);
  });

  it('handles fractional stock against a whole-number threshold', () => {
    expect(isLowStock({ current_stock: 9.5, alert_size: 10 })).toBe(true);
    expect(isLowStock({ current_stock: 10.5, alert_size: 10 })).toBe(false);
  });
});

describe('parseAlertSize', () => {
  it('treats blank input as clearing the threshold', () => {
    expect(parseAlertSize('')).toEqual({ ok: true, value: null });
    expect(parseAlertSize('   ')).toEqual({ ok: true, value: null });
    expect(parseAlertSize(null)).toEqual({ ok: true, value: null });
    expect(parseAlertSize(undefined)).toEqual({ ok: true, value: null });
  });

  it('accepts non-negative whole numbers', () => {
    expect(parseAlertSize('0')).toEqual({ ok: true, value: 0 });
    expect(parseAlertSize('10')).toEqual({ ok: true, value: 10 });
    expect(parseAlertSize(25)).toEqual({ ok: true, value: 25 });
  });

  it('rejects values the integer column could not store', () => {
    expect(parseAlertSize('-1').ok).toBe(false);
    expect(parseAlertSize('2.5').ok).toBe(false);
    expect(parseAlertSize('abc').ok).toBe(false);
  });
});

describe('lowStockRowClass', () => {
  it('tints a low row red', () => {
    expect(lowStockRowClass({ current_stock: 1, alert_size: 5 })).toContain('bg-red-50');
  });

  it('leaves a healthy row on the default hover style', () => {
    expect(lowStockRowClass({ current_stock: 50, alert_size: 5 })).toContain('hover:bg-slate-50');
    expect(lowStockRowClass({ current_stock: 50, alert_size: 5 })).not.toContain('bg-red-50');
  });

  it('lets selection win, so a selected row stays readable', () => {
    const cls = lowStockRowClass({ current_stock: 1, alert_size: 5 }, { selected: true });
    expect(cls).toContain('bg-indigo-50/50');
    expect(cls).not.toContain('bg-red-50');
  });
});
