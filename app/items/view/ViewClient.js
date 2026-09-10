'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  History,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Star,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { canCredit } from '@/lib/constants';
import { compare, nextSort } from '@/lib/table';
import Modal from '@/components/Modal';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from '@/components/ui';

const BLANK_FILTERS = {
  q: '',
  name: '',
  code: '',
  category: '',
  size: '',
  unit: '',
  important: '',
  stock: '',
};

const COLUMNS = [
  { key: 'name', label: 'Item', align: 'left' },
  { key: 'shortcut_code', label: 'Code', align: 'left' },
  { key: 'category_name', label: 'Category', align: 'left' },
  { key: 'size', label: 'Size', align: 'left' },
  { key: 'unit', label: 'Unit', align: 'left' },
  { key: 'display_order', label: 'Order', align: 'right' },
  { key: 'current_stock', label: 'Stock', align: 'right' },
];

export default function ViewClient({ roleName }) {
  const supabase = createClient();
  const mayCredit = canCredit(roleName);

  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [sort, setSort] = useState({ key: 'display_order', dir: 'asc' });

  const [quantities, setQuantities] = useState({});
  const [busyId, setBusyId] = useState(null);

  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState('DEBIT');
  const [bulkQty, setBulkQty] = useState('1');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const [historyItem, setHistoryItem] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    const [itemsRes, categoriesRes] = await Promise.all([
      supabase
        .from('items')
        .select(
          'id, name, shortcut_code, category_id, size, unit, current_stock, is_important, display_order, categories(name)'
        ),
      supabase.from('categories').select('id, name').order('name'),
    ]);

    if (itemsRes.error || categoriesRes.error) {
      setError((itemsRes.error || categoriesRes.error).message);
    } else {
      setError('');
      // Flatten the embedded category so it can be sorted and filtered like
      // any other column.
      setRows(
        (itemsRes.data ?? []).map((row) => ({
          ...row,
          current_stock: Number(row.current_stock ?? 0),
          category_name: row.categories?.name ?? '',
        }))
      );
      setCategories(categoriesRes.data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the table live when someone else moves stock. Requires Realtime to be
  // enabled for `items`; without it this simply never fires and the table still
  // refreshes after every local action.
  useEffect(() => {
    const channel = supabase
      .channel('items-stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 3500);
  }

  const units = useMemo(
    () => [...new Set(rows.map((row) => row.unit).filter(Boolean))].sort(),
    [rows]
  );

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      if (
        q &&
        ![row.name, row.shortcut_code, row.size, row.unit, row.category_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      ) {
        return false;
      }
      if (filters.name && !row.name?.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (
        filters.code &&
        !(row.shortcut_code ?? '').toLowerCase().includes(filters.code.toLowerCase())
      ) {
        return false;
      }
      if (filters.category) {
        if (filters.category === '__none__') {
          if (row.category_id) return false;
        } else if (row.category_id !== filters.category) {
          return false;
        }
      }
      if (filters.size && !(row.size ?? '').toLowerCase().includes(filters.size.toLowerCase())) {
        return false;
      }
      if (filters.unit && row.unit !== filters.unit) return false;
      if (filters.important === 'yes' && !row.is_important) return false;
      if (filters.important === 'no' && row.is_important) return false;
      if (filters.stock === 'in' && row.current_stock <= 0) return false;
      if (filters.stock === 'out' && row.current_stock > 0) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const primary = compare(a, b, sort.key, sort.dir);
      return primary !== 0 ? primary : compare(a, b, 'name', 'asc');
    });
  }, [rows, filters, sort]);

  const filtersActive = useMemo(
    () => Object.values(filters).some((value) => value !== ''),
    [filters]
  );

  function toggleSort(key) {
    setSort((current) => nextSort(current, key));
  }

  function qtyFor(id) {
    const raw = quantities[id];
    return raw === undefined || raw === '' ? '1' : raw;
  }

  /* --------------------------- stock adjustments --------------------------- */

  async function adjust(item, action) {
    const quantity = Number(qtyFor(item.id));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a quantity greater than zero.');
      return;
    }

    setBusyId(item.id);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('adjust_stock', {
      p_item_id: item.id,
      p_action: action,
      p_quantity: quantity,
      p_notes: null,
    });

    setBusyId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    // Patch the row locally so the number moves immediately, then reconcile.
    setRows((current) =>
      current.map((row) => (row.id === item.id ? { ...row, current_stock: Number(data) } : row))
    );
    flash(
      `${action === 'CREDIT' ? 'Added' : 'Removed'} ${quantity} ${item.unit ?? ''} — ${item.name} now ${Number(data)}.`
    );
  }

  async function runBulk(event) {
    event.preventDefault();
    setBulkError('');

    const quantity = Number(bulkQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setBulkError('Enter a quantity greater than zero.');
      return;
    }

    setBulkBusy(true);
    const { data, error: rpcError } = await supabase.rpc('adjust_stock_bulk', {
      p_item_ids: [...selected],
      p_action: bulkAction,
      p_quantity: quantity,
      p_notes: bulkNotes.trim() || null,
    });
    setBulkBusy(false);

    if (rpcError) {
      // The whole batch is one transaction, so a failure means nothing changed.
      setBulkError(`${rpcError.message} — no items were changed.`);
      return;
    }

    setBulkOpen(false);
    setSelected(new Set());
    setBulkNotes('');
    flash(`${bulkAction === 'CREDIT' ? 'Credited' : 'Debited'} ${data} item(s) by ${quantity}.`);
    load();
  }

  async function openHistory(item) {
    setHistoryItem(item);
    setHistoryLoading(true);

    const { data, error: historyError } = await supabase
      .from('inventory_history_view')
      .select('id, action_type, quantity_changed, new_total, notes, user_name, created_at')
      .eq('item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setHistoryRows(historyError ? [] : (data ?? []));
    setHistoryLoading(false);
  }

  /* -------------------------------- selection ------------------------------- */

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.id));

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visible.forEach((row) => next.delete(row.id));
      } else {
        visible.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }

  function toggleOne(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) return <Spinner label="Loading items" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">
            {visible.length} of {rows.length} items
            {!mayCredit && ' · your role can debit stock only'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            placeholder="Search items…"
            aria-label="Search items"
            className="w-56"
          />
          {filtersActive && (
            <Button variant="secondary" onClick={() => setFilters(BLANK_FILTERS)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {/* Bulk action bar — only present when something is selected. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <span className="text-sm font-medium text-indigo-900">
            {selected.size} item{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {mayCredit && (
              <Button
                variant="credit"
                size="sm"
                onClick={() => {
                  setBulkAction('CREDIT');
                  setBulkError('');
                  setBulkOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Bulk credit
              </Button>
            )}
            <Button
              variant="debit"
              size="sm"
              onClick={() => {
                setBulkAction('DEBIT');
                setBulkError('');
                setBulkOpen(true);
              }}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              Bulk debit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr className="border-b border-slate-200">
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all visible items"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </th>
                {COLUMNS.map((column) => {
                  const active = sort.key === column.key;
                  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={`px-3 py-2 font-medium ${column.align === 'right' ? 'text-right' : ''}`}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 ${
                          active ? 'text-slate-900' : ''
                        }`}
                      >
                        {column.label}
                        <Icon className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Adjust stock
                </th>
              </tr>

              {/* Per-column filters. */}
              <tr className="border-b border-slate-200 bg-white">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">
                  <Input
                    value={filters.name}
                    onChange={(event) => setFilters({ ...filters, name: event.target.value })}
                    placeholder="Filter"
                    aria-label="Filter by name"
                    className="py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={filters.code}
                    onChange={(event) => setFilters({ ...filters, code: event.target.value })}
                    placeholder="Filter"
                    aria-label="Filter by code"
                    className="py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={filters.category}
                    onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                    aria-label="Filter by category"
                    className="py-1 text-xs"
                  >
                    <option value="">All</option>
                    <option value="__none__">Uncategorised</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={filters.size}
                    onChange={(event) => setFilters({ ...filters, size: event.target.value })}
                    placeholder="Filter"
                    aria-label="Filter by size"
                    className="py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={filters.unit}
                    onChange={(event) => setFilters({ ...filters, unit: event.target.value })}
                    aria-label="Filter by unit"
                    className="py-1 text-xs"
                  >
                    <option value="">All</option>
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={filters.important}
                    onChange={(event) => setFilters({ ...filters, important: event.target.value })}
                    aria-label="Filter by importance"
                    className="py-1 text-xs"
                  >
                    <option value="">All</option>
                    <option value="yes">Important</option>
                    <option value="no">Normal</option>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={filters.stock}
                    onChange={(event) => setFilters({ ...filters, stock: event.target.value })}
                    aria-label="Filter by stock level"
                    className="py-1 text-xs"
                  >
                    <option value="">All</option>
                    <option value="in">In stock</option>
                    <option value="out">Out of stock</option>
                  </Select>
                </td>
                <td className="px-3 py-2" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {visible.map((item) => {
                const busy = busyId === item.id;
                const out = item.current_stock <= 0;

                return (
                  <tr
                    key={item.id}
                    className={selected.has(item.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        aria-label={`Select ${item.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {item.is_important && (
                          <Star
                            className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                            aria-label="Important"
                          />
                        )}
                        <span className="font-medium text-slate-900">{item.name}</span>
                      </div>
                    </td>

                    <td className="px-3 py-2 text-slate-500">{item.shortcut_code || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{item.category_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{item.size || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{item.unit || '—'}</td>
                    <td className="tnum px-3 py-2 text-right text-slate-400">
                      {item.display_order}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tnum rounded-md px-2 py-1 font-semibold ${
                          out ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {item.current_stock}
                      </span>
                    </td>

                    {/* Inline actions, right-hand side of the row. */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={qtyFor(item.id)}
                          onChange={(event) =>
                            setQuantities({ ...quantities, [item.id]: event.target.value })
                          }
                          aria-label={`Quantity to adjust for ${item.name}`}
                          className="tnum w-16 py-1 text-center text-xs"
                        />
                        {mayCredit && (
                          <Button
                            size="icon"
                            variant="credit"
                            disabled={busy}
                            aria-label={`Credit ${item.name}`}
                            title="Credit (add stock)"
                            onClick={() => adjust(item, 'CREDIT')}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="debit"
                          disabled={busy}
                          aria-label={`Debit ${item.name}`}
                          title="Debit (remove stock)"
                          onClick={() => adjust(item, 'DEBIT')}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          aria-label={`History for ${item.name}`}
                          title="Check history"
                          onClick={() => openHistory(item)}
                        >
                          <History className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <EmptyState icon={Package} title={rows.length ? 'No matching items' : 'No items yet'}>
            {rows.length
              ? 'Try clearing the filters.'
              : 'Add items in Item Config to start tracking stock.'}
          </EmptyState>
        )}
      </Card>

      {/* ------------------------------ bulk modal ------------------------------ */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={bulkAction === 'CREDIT' ? 'Bulk credit' : 'Bulk debit'}
        subtitle={`${selected.size} item${selected.size === 1 ? '' : 's'} selected`}
        size="sm"
      >
        <form onSubmit={runBulk} className="space-y-4">
          <Field
            label="Quantity per item"
            htmlFor="bulk-qty"
            hint="The same amount is applied to every selected item."
          >
            <Input
              id="bulk-qty"
              type="number"
              min="0"
              step="any"
              required
              autoFocus
              value={bulkQty}
              onChange={(event) => setBulkQty(event.target.value)}
            />
          </Field>

          <Field label="Notes" htmlFor="bulk-notes" hint="Optional, saved against every row">
            <Input
              id="bulk-notes"
              value={bulkNotes}
              onChange={(event) => setBulkNotes(event.target.value)}
              placeholder="e.g. Weekly kitchen consumption"
            />
          </Field>

          <Alert tone="info">
            This runs as one transaction — if any item would go below zero, nothing is applied.
          </Alert>

          {bulkError && <Alert tone="error">{bulkError}</Alert>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={bulkAction === 'CREDIT' ? 'credit' : 'debit'}
              loading={bulkBusy}
            >
              {bulkAction === 'CREDIT' ? 'Credit' : 'Debit'} {selected.size} item
              {selected.size === 1 ? '' : 's'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ----------------------------- history modal ---------------------------- */}
      <Modal
        open={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
        title={historyItem ? `History — ${historyItem.name}` : 'History'}
        subtitle="50 most recent movements"
        size="lg"
      >
        {historyLoading ? (
          <Spinner label="Loading history" />
        ) : historyRows.length === 0 ? (
          <EmptyState icon={History} title="No movements recorded yet" />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="py-2 pr-3 font-medium">When</th>
                  <th scope="col" className="px-3 py-2 font-medium">Action</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Change</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">New total</th>
                  <th scope="col" className="px-3 py-2 font-medium">By</th>
                  <th scope="col" className="py-2 pl-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                      {format(new Date(row.created_at), 'dd MMM yyyy, HH:mm')}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={
                          row.action_type === 'CREDIT'
                            ? 'green'
                            : row.action_type === 'DEBIT'
                              ? 'amber'
                              : 'indigo'
                        }
                      >
                        {row.action_type}
                      </Badge>
                    </td>
                    <td
                      className={`tnum px-3 py-2 text-right font-medium ${
                        Number(row.quantity_changed) < 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {Number(row.quantity_changed) > 0 ? '+' : ''}
                      {Number(row.quantity_changed)}
                    </td>
                    <td className="tnum px-3 py-2 text-right text-slate-700">
                      {Number(row.new_total)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.user_name ?? 'Unknown'}</td>
                    <td className="py-2 pl-3 text-slate-500">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
