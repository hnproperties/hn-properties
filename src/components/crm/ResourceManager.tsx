'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCan } from './CrmShell';
import { inr, shortDate, dateTime, toDateInput, toLocalInput } from '@/lib/format';
import { label as labelOf } from '@/lib/constants';

export type Option = { value: string; label: string };

export type Column = {
  key: string; // dotted path, e.g. 'client.name'
  label: string;
  type?: 'text' | 'money' | 'date' | 'datetime' | 'badge' | 'mono' | 'count' | 'bool';
};

export type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'tel' | 'email' | 'number' | 'textarea' | 'select' | 'multiselect' | 'date' | 'datetime' | 'checkbox' | 'lookup';
  options?: Option[];
  lookup?: string; // name of /api/lookups?name=…
  half?: boolean;
  hint?: string;
  required?: boolean;
};

export type FilterDef = { name: string; label: string; options: Option[] };

type Props = {
  resource: string; // API segment, e.g. 'leads'
  permission: string; // permission prefix, e.g. 'lead'
  title: string;
  description?: string;
  columns: Column[];
  fields: FieldDef[];
  filters?: FilterDef[];
  fixedFilters?: Record<string, string>;
  defaults?: Record<string, unknown>;
  emptyMessage?: string;
};

const dig = (row: any, path: string) => path.split('.').reduce((value, key) => value?.[key], row);

function renderCell(row: any, column: Column) {
  const value = dig(row, column.key);
  if (value === null || value === undefined || value === '') return <span className="text-[var(--muted)]">—</span>;
  switch (column.type) {
    case 'money':
      return inr(value as number);
    case 'date':
      return shortDate(value as string);
    case 'datetime':
      return dateTime(value as string);
    case 'badge':
      return <span className="badge">{labelOf(String(value))}</span>;
    case 'mono':
      return <span className="mono text-xs">{String(value)}</span>;
    case 'bool':
      // A false boolean is a real value, not a blank, so it never reaches the
      // empty check above — render it as a dash rather than the word "false".
      return value ? <span aria-label="yes">✓</span> : <span className="text-[var(--muted)]">—</span>;
    default:
      return String(value);
  }
}

export default function ResourceManager({
  resource,
  permission,
  title,
  description,
  columns,
  fields,
  filters = [],
  fixedFilters = {},
  defaults = {},
  emptyMessage,
}: Props) {
  const can = useCan();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Record<string, Option[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const params = useMemo(() => {
    const search = new URLSearchParams({ page: String(page), perPage: '25' });
    if (query) search.set('q', query);
    for (const [key, value] of Object.entries({ ...fixedFilters, ...active })) {
      if (value) search.set(key, value);
    }
    return search.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, JSON.stringify(active), JSON.stringify(fixedFilters)]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/${resource}?${params}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not load');
      setRows(payload.data.rows ?? []);
      setTotal(payload.data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [resource, params]);

  useEffect(() => {
    load();
  }, [load]);

  // Lookup options are fetched once, when a form that needs them opens.
  useEffect(() => {
    if (!editing) return;
    const needed = fields.filter((f) => f.lookup && !lookups[f.lookup!]).map((f) => f.lookup!);
    for (const name of [...new Set(needed)]) {
      fetch(`/api/lookups?name=${name}`)
        .then((r) => r.json())
        .then((payload) => setLookups((current) => ({ ...current, [name]: payload.data ?? [] })))
        .catch(() => setLookups((current) => ({ ...current, [name]: [] })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function openCreate() {
    setForm({ ...defaults });
    setFormError(null);
    setEditing({ id: null });
  }

  function openEdit(row: any) {
    const next: Record<string, any> = {};
    for (const field of fields) {
      const value = row[field.name];
      if (value === null || value === undefined) continue;
      if (field.type === 'date') next[field.name] = toDateInput(value);
      else if (field.type === 'datetime') next[field.name] = toLocalInput(value);
      else next[field.name] = value;
    }
    setForm(next);
    setFormError(null);
    setEditing(row);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const isNew = !editing?.id;
      const response = await fetch(isNew ? `/api/${resource}` : `/api/${resource}/${editing.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details
          ? Object.entries(payload.details).map(([key, value]) => `${key}: ${(value as string[]).join(', ')}`).join(' · ')
          : '';
        throw new Error([payload.error, details].filter(Boolean).join(' — '));
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  /** Deletes each selected row and reports anything the server refused, with its reason. */
  async function removeSelected() {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} selected ${title.toLowerCase()}? This cannot be undone.`)) return;

    setBulkMessage(null);
    const failures: string[] = [];
    for (const id of selected) {
      const response = await fetch(`/api/${resource}/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        failures.push(payload.error ?? 'Could not delete one record');
      }
    }

    setSelected([]);
    await load();
    if (failures.length) setBulkMessage(failures[0]);
  }

  async function remove(row: any) {
    if (!confirm(`Delete this ${title.toLowerCase().replace(/s$/, '')}? This cannot be undone.`)) return;
    const response = await fetch(`/api/${resource}/${row.id}`, { method: 'DELETE' });
    if (response.ok) {
      await load();
      setBulkMessage(null);
    } else {
      const payload = await response.json().catch(() => ({}));
      setBulkMessage(payload.error ?? 'Could not delete');
    }
  }

  const canCreate = can(`${permission}.create`);
  const canEdit = can(`${permission}.edit`);
  const canDelete = can(`${permission}.delete`);
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-l-4 border-[var(--brand)] pl-4">
        <div>
          <h1 className="display text-2xl text-[var(--navy)]">{title}</h1>
          {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add {title.toLowerCase().replace(/s$/, '')}
          </button>
        )}
      </header>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="search">Search</label>
          <input
            id="search"
            className="field"
            placeholder="Type and press Enter"
            defaultValue={query}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setQuery((e.target as HTMLInputElement).value);
              }
            }}
          />
        </div>
        {filters.map((filter) => (
          <div key={filter.name} className="w-[170px]">
            <label className="label" htmlFor={filter.name}>{filter.label}</label>
            <select
              id={filter.name}
              className="field"
              value={active[filter.name] ?? ''}
              onChange={(e) => {
                setPage(1);
                setActive((current) => ({ ...current, [filter.name]: e.target.value }));
              }}
            >
              <option value="">All</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        ))}
        <p className="mono pb-2 text-xs text-[var(--muted)]">{total} records</p>

        {selected.length > 0 && (
          <div className="flex items-center gap-2 pb-1">
            <span className="text-sm font-medium">{selected.length} selected</span>
            <button type="button" className="btn btn-ghost py-2 text-sm text-[var(--danger)]" onClick={removeSelected}>
              Delete selected
            </button>
            <button type="button" className="btn btn-ghost py-2 text-sm" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
      </div>

      {bulkMessage && (
        <p className="mt-4 rounded-lg border border-[var(--danger)] bg-[#fdeaea] p-3 text-sm text-[var(--danger)]">{bulkMessage}</p>
      )}

      <div className="plate mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b">
              {canDelete && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className="h-4 w-4 rounded"
                    checked={rows.length > 0 && selected.length === rows.length}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} className="table-head px-4 py-2.5 text-left font-normal">{column.label}</th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length + (canDelete ? 2 : 1)} className="px-4 py-10 text-center text-[var(--muted)]">Loading…</td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={columns.length + (canDelete ? 2 : 1)} className="px-4 py-10 text-center text-[var(--danger)]">{error}</td></tr>
            )}
            {!loading && !error && !rows.length && (
              <tr>
                <td colSpan={columns.length + (canDelete ? 2 : 1)} className="px-4 py-10 text-center text-[var(--muted)]">
                  {emptyMessage ?? 'Nothing here yet.'}
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr
                key={row.id}
                style={{ animationDelay: `${Math.min(index * 22, 220)}ms` }}
                className={`row-link animate-rise border-b last:border-0 ${canEdit ? 'cursor-pointer' : ''} ${
                  selected.includes(row.id) ? 'bg-[var(--brand-soft)]' : ''
                }`}
                onClick={() => canEdit && openEdit(row)}
              >
                {canDelete && (
                  <td className="px-4 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.code ?? row.id}`}
                      className="h-4 w-4 rounded"
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((current) => (e.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))
                      }
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-2.5 align-top">{renderCell(row, column)}</td>
                ))}
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {canEdit && (
                    <button type="button" className="text-sm text-[var(--brand)] hover:underline" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" className="ml-3 text-sm text-[var(--danger)] hover:underline" onClick={() => remove(row)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="mono text-xs text-[var(--muted)]">Page {page} of {pages}</span>
          <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {/* Drawer form */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setEditing(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-[var(--plate)] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b bg-[var(--plate)] px-6 py-4">
              <h2 className="display text-lg">
                {editing.id ? `Edit ${title.toLowerCase().replace(/s$/, '')}` : `New ${title.toLowerCase().replace(/s$/, '')}`}
              </h2>
              <button type="button" className="btn btn-ghost py-1.5" onClick={() => setEditing(null)}>Close</button>
            </div>

            <form onSubmit={save} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => {
                  const options = field.lookup ? lookups[field.lookup] ?? [] : field.options ?? [];
                  const value = form[field.name] ?? '';
                  const setValue = (next: any) => setForm((current) => ({ ...current, [field.name]: next }));

                  return (
                    <div key={field.name} className={field.half ? '' : 'sm:col-span-2'}>
                      <label className="label" htmlFor={`crm-${field.name}`}>{field.label}</label>

                      {field.type === 'textarea' ? (
                        <textarea id={`crm-${field.name}`} className="field min-h-[90px]" value={value} onChange={(e) => setValue(e.target.value)} />
                      ) : field.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!form[field.name]} onChange={(e) => setValue(e.target.checked)} />
                          {field.hint ?? 'Yes'}
                        </label>
                      ) : field.type === 'select' || field.type === 'lookup' ? (
                        <select id={`crm-${field.name}`} className="field" value={value} onChange={(e) => setValue(e.target.value)} required={field.required}>
                          <option value="">Not set</option>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : field.type === 'multiselect' ? (
                        <div className="flex flex-wrap gap-2 rounded-[3px] border p-2">
                          {options.map((option) => {
                            const list: string[] = Array.isArray(form[field.name]) ? form[field.name] : [];
                            const checked = list.includes(option.value);
                            return (
                              <label key={option.value} className="flex items-center gap-1.5 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setValue(e.target.checked ? [...list, option.value] : list.filter((v) => v !== option.value))
                                  }
                                />
                                {option.label}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          id={`crm-${field.name}`}
                          type={field.type === 'datetime' ? 'datetime-local' : field.type ?? 'text'}
                          className="field"
                          value={value}
                          required={field.required}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => setValue(e.target.value)}
                        />
                      )}

                      {field.hint && field.type !== 'checkbox' && (
                        <p className="mt-1 text-xs text-[var(--muted)]">{field.hint}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {formError && <p className="text-sm text-[var(--danger)]">{formError}</p>}

              <div className="flex gap-2 border-t pt-4">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
