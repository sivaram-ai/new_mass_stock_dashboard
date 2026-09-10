import { describe, expect, it, vi } from 'vitest';
import { isMissingColumnError, saveItem, selectItems } from '@/lib/items';

/** Postgres error shape PostgREST returns for an unknown column. */
const missingAlertSize = {
  code: '42703',
  message: 'column items.alert_size does not exist',
};

/**
 * Minimal Supabase client stand-in. `fail` decides which select strings blow up,
 * which is how we simulate a database that has not run migration 0002.
 */
function stubClient({ failOn = () => false, rows = [{ id: '1' }] } = {}) {
  const calls = [];

  return {
    calls,
    from() {
      return {
        select(cols) {
          calls.push({ op: 'select', cols });
          const result = failOn(cols)
            ? { data: null, error: missingAlertSize }
            : { data: rows, error: null };
          // The real builder is thenable and chainable; mimic just enough.
          return {
            ...result,
            order() {
              return this;
            },
            eq() {
              return this;
            },
            single() {
              return this;
            },
            then(resolve) {
              return Promise.resolve(result).then(resolve);
            },
          };
        },
        insert(body) {
          calls.push({ op: 'insert', body: body[0] });
          const failed = failOn(Object.keys(body[0]).join(','));
          return {
            select() {
              return {
                single: async () =>
                  failed
                    ? { data: null, error: missingAlertSize }
                    : { data: { id: 'new' }, error: null },
              };
            },
          };
        },
        update(body) {
          calls.push({ op: 'update', body });
          const failed = failOn(Object.keys(body).join(','));
          return {
            eq: async () =>
              failed ? { data: null, error: missingAlertSize } : { data: null, error: null },
          };
        },
      };
    },
  };
}

describe('isMissingColumnError', () => {
  it('recognises 42703 for the named column', () => {
    expect(isMissingColumnError(missingAlertSize, 'alert_size')).toBe(true);
  });

  it('does not match a different missing column', () => {
    expect(isMissingColumnError(missingAlertSize, 'display_order')).toBe(false);
  });

  it('ignores unrelated errors, so real failures still surface', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' }, 'alert_size')).toBe(
      false
    );
    expect(isMissingColumnError(null, 'alert_size')).toBe(false);
  });
});

describe('selectItems', () => {
  it('asks for alert_size first and reports it as supported', async () => {
    const client = stubClient();
    const result = await selectItems(client, 'id, name');

    expect(result.error).toBeNull();
    expect(result.alertSizeSupported).toBe(true);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].cols).toContain('alert_size');
  });

  it('retries without alert_size when the column is missing', async () => {
    const client = stubClient({ failOn: (cols) => cols.includes('alert_size') });
    const result = await selectItems(client, 'id, name');

    // The page still loads — this is the whole point of the fallback.
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: '1' }]);
    expect(result.alertSizeSupported).toBe(false);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].cols).not.toContain('alert_size');
  });

  it('surfaces unrelated errors instead of masking them behind a retry', async () => {
    const other = { code: '42501', message: 'permission denied' };
    const client = {
      from: () => ({
        select: () => ({
          order() {
            return this;
          },
          then: (resolve) => Promise.resolve({ data: null, error: other }).then(resolve),
        }),
      }),
    };

    const result = await selectItems(client, 'id, name');
    expect(result.error).toEqual(other);
  });

  it('passes the builder through the apply callback', async () => {
    const client = stubClient();
    const apply = vi.fn((query) => query.order('name'));
    await selectItems(client, 'id, name', apply);
    expect(apply).toHaveBeenCalledOnce();
  });
});

describe('saveItem', () => {
  it('inserts with alert_size when the column exists', async () => {
    const client = stubClient();
    const result = await saveItem(client, { name: 'Rice', alert_size: 10 });

    expect(result.error).toBeNull();
    expect(result.alertSizeSupported).toBe(true);
    expect(client.calls[0].body).toHaveProperty('alert_size', 10);
  });

  it('drops alert_size and retries the insert when the column is missing', async () => {
    const client = stubClient({ failOn: (keys) => keys.includes('alert_size') });
    const result = await saveItem(client, { name: 'Rice', alert_size: 10 });

    // The item is still created; only the threshold is discarded.
    expect(result.error).toBeNull();
    expect(result.alertSizeSupported).toBe(false);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].body).not.toHaveProperty('alert_size');
    expect(client.calls[1].body).toHaveProperty('name', 'Rice');
  });

  it('drops alert_size and retries the update when the column is missing', async () => {
    const client = stubClient({ failOn: (keys) => keys.includes('alert_size') });
    const result = await saveItem(client, { name: 'Rice', alert_size: 10 }, 'item-1');

    expect(result.error).toBeNull();
    expect(result.alertSizeSupported).toBe(false);
    expect(client.calls[0].op).toBe('update');
    expect(client.calls[1].body).not.toHaveProperty('alert_size');
  });

  it('does not retry on an unrelated failure', async () => {
    const duplicate = { code: '23505', message: 'duplicate key' };
    const client = {
      from: () => ({
        insert: () => ({
          select: () => ({ single: async () => ({ data: null, error: duplicate }) }),
        }),
      }),
    };

    const result = await saveItem(client, { name: 'Rice', alert_size: 10 });
    expect(result.error).toEqual(duplicate);
    expect(result.alertSizeSupported).toBe(true);
  });
});
