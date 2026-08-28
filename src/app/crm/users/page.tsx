'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { dateTime } from '@/lib/format';
import { useCrmUser } from '@/components/crm/CrmShell';

type Role = { id: string; key: string; name: string; rank: number; permissions: { permissionId: string }[]; _count: { users: number } };
type Permission = { id: string; key: string; group: string; label: string; isDanger: boolean };

export default function TeamPage() {
  const me = useCrmUser();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [roleEditing, setRoleEditing] = useState<Role | null>(null);
  const [roleSet, setRoleSet] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [usersResponse, rolesResponse] = await Promise.all([fetch('/api/users'), fetch('/api/roles')]);
    if (usersResponse.ok) setUsers((await usersResponse.json()).data.rows);
    if (rolesResponse.ok) {
      const payload = await rolesResponse.json();
      setRoles(payload.data.roles);
      setPermissions(payload.data.permissions);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Your own rank, read from the roles list rather than the session, because the
   * session carries a role key and the comparison below needs the number.
   */
  const myRank = useMemo(() => roles.find((role) => role.key === me?.role)?.rank ?? Number.MAX_SAFE_INTEGER, [roles, me]);

  /**
   * You cannot act on yourself, or on anyone senior to you. Hiding the checkbox
   * rather than letting the click fail keeps the refusal in one place — the API
   * enforces the same two rules, this just avoids offering the action.
   */
  const selectable = useCallback(
    (row: any) => row.id !== me?.id && (row.role?.rank ?? 0) >= myRank,
    [me, myRank],
  );

  const selectableUsers = useMemo(() => users.filter(selectable), [users, selectable]);
  const allSelected = selectableUsers.length > 0 && selected.length === selectableUsers.length;

  /** Runs one request per row and reports the first refusal, so a partial run still says why. */
  async function runOnSelected(label: string, request: (id: string) => Promise<Response>) {
    setBusy(true);
    setNotice(null);
    let failure: string | null = null;
    let done = 0;

    for (const id of selected) {
      const response = await request(id);
      if (response.ok) done += 1;
      else {
        const payload = await response.json().catch(() => ({}));
        failure ??= payload.error ?? `Could not ${label} one account`;
      }
    }

    setBusy(false);
    setSelected([]);
    setNotice(failure ?? `${done} account${done === 1 ? '' : 's'} ${label}.`);
    await load();
  }

  function deactivateSelected() {
    if (!selected.length) return;
    if (!confirm(`Deactivate ${selected.length} account${selected.length > 1 ? 's' : ''}? They will be signed out and lose access, but their records stay attributed to them.`)) return;
    return runOnSelected('deactivated', (id) =>
      fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      }),
    );
  }

  function deleteSelected() {
    if (!selected.length) return;
    if (
      !confirm(
        `Permanently delete ${selected.length} account${selected.length > 1 ? 's' : ''}? This cannot be undone. Accounts that still have properties, leads or other work against them will be refused — deactivate those instead.`,
      )
    ) {
      return;
    }
    return runOnSelected('deleted', (id) => fetch(`/api/users/${id}?hard=1`, { method: 'DELETE' }));
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const isNew = !editing?.id;
    const response = await fetch(isNew ? '/api/users' : `/api/users/${editing.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Could not save');
      return;
    }
    setEditing(null);
    await load();
  }

  async function saveRole() {
    if (!roleEditing) return;
    const response = await fetch('/api/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: roleEditing.id, permissionIds: roleSet }),
    });
    if (response.ok) {
      setNotice(`${roleEditing.name} updated. Anyone holding it will be re-checked on their next request.`);
      setRoleEditing(null);
      await load();
    } else {
      const payload = await response.json();
      setNotice(payload.error ?? 'Could not update the role');
    }
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    (acc[permission.group] ??= []).push(permission);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl">Team</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Deactivating keeps a person&rsquo;s records attributed to them. Deleting is for accounts that were never real.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setForm({ isActive: true }); setEditing({ id: null }); }}>
          Add person
        </button>
      </header>

      {notice && <p className="plate p-3 text-sm">{notice}</p>}

      {selected.length > 0 && (
        <div className="plate flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <button type="button" className="btn btn-ghost py-2 text-sm" disabled={busy} onClick={deactivateSelected}>
            Deactivate
          </button>
          <button
            type="button"
            className="btn btn-ghost py-2 text-sm text-[var(--danger)]"
            disabled={busy}
            onClick={deleteSelected}
          >
            {busy ? 'Working…' : 'Delete permanently'}
          </button>
          <button type="button" className="btn btn-ghost py-2 text-sm" disabled={busy} onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      <div className="plate overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="h-4 w-4 rounded"
                  checked={allSelected}
                  disabled={selectableUsers.length === 0}
                  onChange={(e) => setSelected(e.target.checked ? selectableUsers.map((u) => u.id) : [])}
                />
              </th>
              {['Code', 'Name', 'Email', 'Role', 'Last signed in', 'State', ''].map((head) => (
                <th key={head} className="table-head px-4 py-2.5 text-left font-normal">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className={`border-b last:border-0 ${selected.includes(user.id) ? 'bg-[var(--brand-soft)]' : ''}`}
              >
                <td className="px-4 py-2">
                  {selectable(user) ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${user.name}`}
                      className="h-4 w-4 rounded"
                      checked={selected.includes(user.id)}
                      onChange={(e) =>
                        setSelected((current) => (e.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id)))
                      }
                    />
                  ) : (
                    <span className="sr-only">This account cannot be selected</span>
                  )}
                </td>
                <td className="px-4 py-2"><span className="mono text-xs">{user.code}</span></td>
                <td className="px-4 py-2">
                  {user.name}
                  {user.id === me?.id && <span className="badge ml-2">you</span>}
                </td>
                <td className="px-4 py-2 text-[var(--muted)]">{user.email}</td>
                <td className="px-4 py-2"><span className="badge">{user.role?.name}</span></td>
                <td className="px-4 py-2 text-xs">{user.lastLoginAt ? dateTime(user.lastLoginAt) : 'Never'}</td>
                <td className="px-4 py-2">{user.isActive ? 'Active' : 'Deactivated'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="text-sm text-[var(--brand)] hover:underline"
                    onClick={() => {
                      setForm({ name: user.name, email: user.email, phone: user.phone ?? '', roleId: user.role?.id, isActive: user.isActive });
                      setEditing(user);
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">No team accounts.</td></tr>}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="display text-xl">Roles and permissions</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Permissions are stored in the database, so this is configuration rather than a code change.
          Super Admin always keeps everything.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.id} className="plate p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-medium">{role.name}</p>
                <span className="mono text-xs text-[var(--muted)]">{role._count.users} people</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{role.permissions.length} permissions</p>
              {role.key !== 'SUPER_ADMIN' && (
                <button
                  type="button"
                  className="btn btn-ghost mt-3 py-1.5 text-xs"
                  onClick={() => {
                    setRoleEditing(role);
                    setRoleSet(role.permissions.map((p) => p.permissionId));
                  }}
                >
                  Edit permissions
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* User drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setEditing(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-[var(--plate)] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="display text-lg">{editing.id ? 'Edit person' : 'Add person'}</h2>
            <form onSubmit={saveUser} className="mt-4 space-y-4">
              <div><label className="label" htmlFor="u-name">Name</label>
                <input id="u-name" className="field" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label" htmlFor="u-email">Email</label>
                <input id="u-email" type="email" className="field" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div><label className="label" htmlFor="u-phone">Phone</label>
                <input id="u-phone" className="field" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label" htmlFor="u-role">Role</label>
                <select id="u-role" className="field" value={form.roleId ?? ''} onChange={(e) => setForm({ ...form, roleId: e.target.value })} required>
                  <option value="">Select</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select></div>
              <div><label className="label" htmlFor="u-password">{editing.id ? 'New password (optional)' : 'Starting password'}</label>
                <input id="u-password" type="password" className="field" value={form.password ?? ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="mt-1 text-xs text-[var(--muted)]">Changing this signs the person out everywhere.</p></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Account active
              </label>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex gap-2 border-t pt-4">
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role drawer */}
      {roleEditing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setRoleEditing(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-[var(--plate)] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="display text-lg">{roleEditing.name} permissions</h2>
            <div className="mt-4 space-y-5">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <p className="eyebrow">{group}</p>
                  <div className="mt-2 space-y-1.5">
                    {items.map((permission) => (
                      <label key={permission.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={roleSet.includes(permission.id)}
                          onChange={(e) =>
                            setRoleSet((current) =>
                              e.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id),
                            )
                          }
                        />
                        <span>
                          {permission.label}
                          {permission.isDanger && <span className="badge ml-2">sensitive</span>}
                          <span className="mono block text-[10px] text-[var(--muted)]">{permission.key}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2 border-t pt-4">
              <button type="button" className="btn btn-primary" onClick={saveRole}>Save permissions</button>
              <button type="button" className="btn btn-ghost" onClick={() => setRoleEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
