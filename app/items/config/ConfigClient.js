'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FolderOpen,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { UNITS } from '@/lib/constants';
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

const BLANK_ITEM = {
  name: '',
  shortcut_code: '',
  category_id: '',
  size: '',
  unit: 'count',
  is_important: false,
  display_order: 0,
  opening_stock: '',
};

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

const ITEM_COLUMNS = [
  { key: 'display_order', label: 'Order', align: 'right' },
  { key: 'name', label: 'Item', align: 'left' },
  { key: 'shortcut_code', label: 'Code', align: 'left' },
  { key: 'category_name', label: 'Category', align: 'left' },
  { key: 'size', label: 'Size', align: 'left' },
  { key: 'unit', label: 'Unit', align: 'left' },
  { key: 'current_stock', label: 'Stock', align: 'right' },
];

export default function ConfigClient() {
  const supabase = createClient();

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [newCategory, setNewCategory] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryQuery, setCategoryQuery] = useState('');

  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [sort, setSort] = useState({ key: 'display_order', dir: 'asc' });

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState(BLANK_ITEM);
  const [editingItemId, setEditingItemId] = useState(null);
  const [savingItem, setSavingItem] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [categoriesRes, itemsRes] = await Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase
        .from('items')
        .select(
          'id, name, shortcut_code, category_id, size, unit, current_stock, is_important, display_order, categories(name)'
        )
        .order('display_order', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    if (categoriesRes.error || itemsRes.error) {
      setError((categoriesRes.error || itemsRes.error).message);
    } else {
      setCategories(categoriesRes.data ?? []);
      // Flatten the embedded category so it sorts and filters like any other
      // column, and coerce stock to a number so it sorts numerically.
      setItems(
        (itemsRes.data ?? []).map((row) => ({
          ...row,
          current_stock: Number(row.current_stock ?? 0),
          category_name: row.categories?.name ?? '',
        }))
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((category) => [category.id, category.name]));
    return (id) => map.get(id) ?? 'Uncategorised';
  }, [categories]);

  const units = useMemo(
    () => [...new Set(items.map((item) => item.unit).filter(Boolean))].sort(),
    [items]
  );

  const visibleCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, categoryQuery]);

  const visibleItems = useMemo(() => {
    const q = filters.q.trim().toLowerCase();

    const filtered = items.filter((row) => {
      if (
        q &&
        ![row.name, row.shortcut_code, row.size, row.unit, row.category_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      ) {
        return false;
      }
      if (filters.name && !row.name?.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }
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
  }, [items, filters, sort]);

  const filtersActive = useMemo(
    () => Object.values(filters).some((value) => value !== ''),
    [filters]
  );

  function toggleSort(key) {
    setSort((current) => nextSort(current, key));
  }

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 3500);
  }

  /* ----------------------------- categories ----------------------------- */

  async function addCategory(event) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;

    setSavingCategory(true);
    const { error: insertError } = await supabase.from('categories').insert([{ name }]);
    setSavingCategory(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewCategory('');
    flash(`Category "${name}" added.`);
    load();
  }

  async function renameCategory(category) {
    const name = editingCategory?.name?.trim();
    if (!name) return;

    const { error: updateError } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', category.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingCategory(null);
    flash('Category renamed.');
    load();
  }

  async function deleteCategory(category) {
    const members = items.filter((item) => item.category_id === category.id).length;
    const warning = members
      ? `Delete "${category.name}"? ${members} item(s) will become Uncategorised.`
      : `Delete "${category.name}"?`;
    if (!window.confirm(warning)) return;

    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', category.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    flash('Category deleted.');
    load();
  }

  /* -------------------------------- items -------------------------------- */

  function openCreateItem() {
    setEditingItemId(null);
    setFormError('');
    // Slot new items after the current highest, so they land at the end.
    const nextOrder = items.reduce((max, item) => Math.max(max, item.display_order ?? 0), 0) + 1;
    setItemForm({ ...BLANK_ITEM, display_order: nextOrder });
    setItemModalOpen(true);
  }

  function openEditItem(item) {
    setEditingItemId(item.id);
    setFormError('');
    setItemForm({
      name: item.name ?? '',
      shortcut_code: item.shortcut_code ?? '',
      category_id: item.category_id ?? '',
      size: item.size ?? '',
      unit: item.unit ?? 'count',
      is_important: Boolean(item.is_important),
      display_order: item.display_order ?? 0,
      opening_stock: '',
    });
    setItemModalOpen(true);
  }

  async function saveItem(event) {
    event.preventDefault();
    setFormError('');

    const name = itemForm.name.trim();
    if (!name) {
      setFormError('Name is required.');
      return;
    }

    const payload = {
      name,
      shortcut_code: itemForm.shortcut_code.trim() || null,
      category_id: itemForm.category_id || null,
      size: itemForm.size.trim() || null,
      unit: itemForm.unit || null,
      is_important: itemForm.is_important,
      display_order: Number(itemForm.display_order) || 0,
    };

    setSavingItem(true);

    if (editingItemId) {
      const { error: updateError } = await supabase
        .from('items')
        .update(payload)
        .eq('id', editingItemId);
      setSavingItem(false);

      if (updateError) {
        setFormError(friendlyItemError(updateError));
        return;
      }
      flash(`"${name}" updated.`);
    } else {
      const { data: created, error: insertError } = await supabase
        .from('items')
        .insert([payload])
        .select('id')
        .single();

      if (insertError) {
        setSavingItem(false);
        setFormError(friendlyItemError(insertError));
        return;
      }

      // An opening balance is a stock movement, so it goes through the RPC and
      // lands in the audit log as INITIAL rather than being written directly.
      const opening = Number(itemForm.opening_stock);
      if (created && opening > 0) {
        const { error: rpcError } = await supabase.rpc('adjust_stock', {
          p_item_id: created.id,
          p_action: 'INITIAL',
          p_quantity: opening,
          p_notes: 'Opening balance',
        });
        if (rpcError) {
          setSavingItem(false);
          setFormError(`Item created, but the opening stock failed: ${rpcError.message}`);
          load();
          return;
        }
      }

      setSavingItem(false);
      flash(`"${name}" created.`);
    }

    setItemModalOpen(false);
    load();
  }

  async function deleteItem(item) {
    if (
      !window.confirm(
        `Delete "${item.name}"? Its history will be removed too. This cannot be undone.`
      )
    ) {
      return;
    }

    const { error: deleteError } = await supabase.from('items').delete().eq('id', item.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    flash('Item deleted.');
    load();
  }

  function friendlyItemError(err) {
    if (err.code === '23505') return 'That shortcut code is already used by another item.';
    if (err.code === '42501') return 'Your role is not allowed to change the catalogue.';
    return err.message;
  }

  if (loading) return <Spinner label="Loading catalogue" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Item configuration</h1>
          <p className="text-sm text-slate-500">
            {visibleItems.length} of {items.length} items · {categories.length} categories
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            placeholder="Search items…"
            aria-label="Search items"
            className="w-52"
          />
          <Select
            value={filters.important}
            onChange={(event) => setFilters({ ...filters, important: event.target.value })}
            aria-label="Filter by importance"
            className="w-36"
          >
            <option value="">All items</option>
            <option value="yes">Important</option>
            <option value="no">Normal</option>
          </Select>
          {filtersActive && (
            <Button variant="secondary" onClick={() => setFilters(BLANK_FILTERS)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
          <Button onClick={openCreateItem}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New item
          </Button>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ------------------------------ categories ------------------------------ */}
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <FolderOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Categories</h2>
            <Badge className="ml-auto">{categories.length}</Badge>
          </div>

          <form onSubmit={addCategory} className="flex gap-2 border-b border-slate-100 p-4">
            <Input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="e.g. Vegetables"
              aria-label="New category name"
            />
            <Button type="submit" loading={savingCategory} disabled={!newCategory.trim()}>
              Add
            </Button>
          </form>

          {categories.length > 6 && (
            <div className="border-b border-slate-100 px-4 pb-3">
              <Input
                value={categoryQuery}
                onChange={(event) => setCategoryQuery(event.target.value)}
                placeholder="Search categories…"
                aria-label="Search categories"
                className="py-1.5 text-xs"
              />
            </div>
          )}

          {categories.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No categories yet">
              Categories group items on the dashboard so you can plan orders.
            </EmptyState>
          ) : visibleCategories.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No matching categories">
              Nothing matches “{categoryQuery}”.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleCategories.map((category) => {
                const count = items.filter((item) => item.category_id === category.id).length;
                const editing = editingCategory?.id === category.id;

                return (
                  <li key={category.id} className="flex items-center gap-2 px-4 py-2.5">
                    {editing ? (
                      <>
                        <Input
                          value={editingCategory.name}
                          autoFocus
                          onChange={(event) =>
                            setEditingCategory({ ...editingCategory, name: event.target.value })
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') renameCategory(category);
                            if (event.key === 'Escape') setEditingCategory(null);
                          }}
                          aria-label={`Rename ${category.name}`}
                        />
                        <Button size="sm" onClick={() => renameCategory(category)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCategory(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                          {category.name}
                        </span>
                        <Badge>{count}</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Rename ${category.name}`}
                          onClick={() => setEditingCategory({ id: category.id, name: category.name })}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${category.name}`}
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => deleteCategory(category)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* -------------------------------- items -------------------------------- */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <Package className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Items</h2>
            <Badge className="ml-auto">
              {filtersActive ? `${visibleItems.length} / ${items.length}` : items.length}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  {ITEM_COLUMNS.map((column) => {
                    const active = sort.key === column.key;
                    const Icon = active
                      ? sort.dir === 'asc'
                        ? ArrowUp
                        : ArrowDown
                      : ChevronsUpDown;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        className={`px-4 py-2 font-medium ${
                          column.align === 'right' ? 'text-right' : ''
                        }`}
                        aria-sort={
                          active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
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
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>

                {/* Per-column filters, matching the Inventory table. */}
                <tr className="border-b border-slate-200 bg-white">
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2">
                    <Input
                      value={filters.name}
                      onChange={(event) => setFilters({ ...filters, name: event.target.value })}
                      placeholder="Filter"
                      aria-label="Filter by name"
                      className="py-1 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={filters.code}
                      onChange={(event) => setFilters({ ...filters, code: event.target.value })}
                      placeholder="Filter"
                      aria-label="Filter by code"
                      className="py-1 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      value={filters.category}
                      onChange={(event) =>
                        setFilters({ ...filters, category: event.target.value })
                      }
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
                  <td className="px-4 py-2">
                    <Input
                      value={filters.size}
                      onChange={(event) => setFilters({ ...filters, size: event.target.value })}
                      placeholder="Filter"
                      aria-label="Filter by size"
                      className="py-1 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
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
                  <td className="px-4 py-2">
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
                  <td className="px-4 py-2" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="tnum px-4 py-2.5 text-right text-slate-400">
                      {item.display_order}
                    </td>
                    <td className="px-4 py-2.5">
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
                    <td className="px-4 py-2.5 text-slate-500">{item.shortcut_code || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {categoryName(item.category_id)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{item.size || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.unit || '—'}</td>
                    <td className="tnum px-4 py-2.5 text-right font-medium text-slate-900">
                      {item.current_stock}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => openEditItem(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${item.name}`}
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => deleteItem(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleItems.length === 0 && (
            <EmptyState icon={Package} title={items.length ? 'No matching items' : 'No items yet'}>
              {items.length
                ? 'Try clearing the filters.'
                : 'Add your first item to start tracking stock.'}
            </EmptyState>
          )}
        </Card>
      </div>

      {/* ------------------------------ item form ------------------------------ */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editingItemId ? 'Edit item' : 'New item'}
        subtitle={editingItemId ? itemForm.name : 'Add an item to the catalogue'}
      >
        <form onSubmit={saveItem} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Name" htmlFor="item-name">
                <Input
                  id="item-name"
                  required
                  autoFocus
                  value={itemForm.name}
                  onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
                  placeholder="e.g. Basmati Rice"
                />
              </Field>
            </div>

            <Field label="Shortcut code" htmlFor="item-code" hint="Optional, must be unique">
              <Input
                id="item-code"
                value={itemForm.shortcut_code}
                onChange={(event) =>
                  setItemForm({ ...itemForm, shortcut_code: event.target.value })
                }
                placeholder="RICE-B"
              />
            </Field>

            <Field label="Category" htmlFor="item-category">
              <Select
                id="item-category"
                value={itemForm.category_id}
                onChange={(event) =>
                  setItemForm({ ...itemForm, category_id: event.target.value })
                }
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Size" htmlFor="item-size" hint="Optional, e.g. 5kg bag">
              <Input
                id="item-size"
                value={itemForm.size}
                onChange={(event) => setItemForm({ ...itemForm, size: event.target.value })}
                placeholder="5kg"
              />
            </Field>

            <Field label="Unit" htmlFor="item-unit">
              <Select
                id="item-unit"
                value={itemForm.unit}
                onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Display order"
              htmlFor="item-order"
              hint="Lower numbers show first on the dashboard"
            >
              <Input
                id="item-order"
                type="number"
                step="1"
                value={itemForm.display_order}
                onChange={(event) =>
                  setItemForm({ ...itemForm, display_order: event.target.value })
                }
              />
            </Field>

            {!editingItemId && (
              <Field label="Opening stock" htmlFor="item-opening" hint="Optional, logged as INITIAL">
                <Input
                  id="item-opening"
                  type="number"
                  step="any"
                  min="0"
                  value={itemForm.opening_stock}
                  onChange={(event) =>
                    setItemForm({ ...itemForm, opening_stock: event.target.value })
                  }
                  placeholder="0"
                />
              </Field>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={itemForm.is_important}
              onChange={(event) =>
                setItemForm({ ...itemForm, is_important: event.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span className="text-sm text-slate-700">
              Important &mdash; pin this to the dashboard
            </span>
          </label>

          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setItemModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingItem}>
              {editingItemId ? 'Save changes' : 'Create item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
