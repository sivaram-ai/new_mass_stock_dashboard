'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Pencil, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select, Spinner } from '@/components/ui';

const BLANK_USER = { fullName: '', email: '', password: '', roleId: '' };
const BLANK_ROLE = { roleName: '', description: '' };
const BLANK_EDIT = { id: '', email: '', fullName: '', password: '', roleId: '' };

export default function AdminClient() {
  const supabase = createClient();

  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [roleForm, setRoleForm] = useState(BLANK_ROLE);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleNotice, setRoleNotice] = useState('');

  const [userForm, setUserForm] = useState(BLANK_USER);
  const [userBusy, setUserBusy] = useState(false);
  const [userError, setUserError] = useState('');
  const [userNotice, setUserNotice] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(BLANK_EDIT);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  /**
   * Every /api/admin/* call carries the caller's access token; the route
   * verifies it belongs to an Admin before touching the service-role client.
   */
  const authedFetch = useCallback(
    async (url, options = {}) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          ...options.headers,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      return payload;
    },
    [supabase]
  );

  const load = useCallback(async () => {
    try {
      const [rolesRes, usersRes] = await Promise.all([
        authedFetch('/api/admin/roles'),
        authedFetch('/api/admin/users'),
      ]);
      setRoles(rolesRes.data ?? []);
      setUsers(usersRes.data ?? []);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function createRole(event) {
    event.preventDefault();
    setRoleError('');
    setRoleNotice('');
    setRoleBusy(true);

    try {
      await authedFetch('/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          roleName: roleForm.roleName.trim(),
          description: roleForm.description.trim(),
        }),
      });
      setRoleNotice(`Role "${roleForm.roleName.trim()}" created.`);
      setRoleForm(BLANK_ROLE);
      load();
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setRoleBusy(false);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    setUserError('');
    setUserNotice('');

    if (userForm.password.length < 8) {
      setUserError('Password must be at least 8 characters.');
      return;
    }

    setUserBusy(true);
    try {
      await authedFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: userForm.fullName.trim(),
          email: userForm.email.trim(),
          password: userForm.password,
          roleId: userForm.roleId,
        }),
      });
      setUserNotice(`${userForm.email.trim()} can now sign in.`);
      setUserForm(BLANK_USER);
      load();
    } catch (err) {
      setUserError(err.message);
    } finally {
      setUserBusy(false);
    }
  }

  function openEditUser(user) {
    setEditError('');
    setEditForm({
      id: user.id,
      email: user.email,
      fullName: user.full_name ?? '',
      // Always blank: this is a "set a new password" box, never a reveal of the
      // existing one. Left empty, the password is untouched.
      password: '',
      roleId: user.custom_roles?.id ?? '',
    });
    setEditOpen(true);
  }

  async function saveUser(event) {
    event.preventDefault();
    setEditError('');
    setUserNotice('');

    if (editForm.password && editForm.password.length < 8) {
      setEditError('Password must be at least 8 characters.');
      return;
    }

    // Send only what the route should change.
    const payload = { fullName: editForm.fullName.trim(), roleId: editForm.roleId };
    if (editForm.password) payload.password = editForm.password;

    setEditBusy(true);
    try {
      await authedFetch(`/api/admin/users/${editForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setUserNotice(
        `${editForm.email} updated${editForm.password ? ', including their password' : ''}.`
      );
      setEditOpen(false);
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading admin panel" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Admin control panel</h1>
        <p className="text-sm text-slate-500">Create roles and provision staff accounts.</p>
      </div>

      {loadError && <Alert tone="error">{loadError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* --------------------------------- roles --------------------------------- */}
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Roles</h2>
            <Badge className="ml-auto">{roles.length}</Badge>
          </div>

          <form onSubmit={createRole} className="space-y-3 border-b border-slate-100 p-4">
            <Field label="Role name" htmlFor="role-name">
              <Input
                id="role-name"
                required
                maxLength={50}
                value={roleForm.roleName}
                onChange={(event) => setRoleForm({ ...roleForm, roleName: event.target.value })}
                placeholder="e.g. Store Keeper"
              />
            </Field>

            <Field label="Description" htmlFor="role-description" hint="Optional">
              <Input
                id="role-description"
                value={roleForm.description}
                onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                placeholder="What can this role do?"
              />
            </Field>

            {roleError && <Alert tone="error">{roleError}</Alert>}
            {roleNotice && <Alert tone="success">{roleNotice}</Alert>}

            <Button type="submit" loading={roleBusy} disabled={!roleForm.roleName.trim()}>
              Create role
            </Button>
          </form>

          <ul className="divide-y divide-slate-100">
            {roles.map((role) => (
              <li key={role.id} className="px-5 py-3">
                <p className="text-sm font-medium text-slate-900">{role.role_name}</p>
                <p className="text-xs text-slate-500">{role.description || 'No description'}</p>
              </li>
            ))}
          </ul>

          <Alert tone="info">
            <span className="block px-1 py-0.5">
              Only <strong>Admin</strong>, <strong>Manager</strong> and{' '}
              <strong>Kitchen Staff</strong> carry built-in permissions. A new role can sign in and
              read everything, but cannot edit the catalogue until you grant it in the SQL policies.
            </span>
          </Alert>
        </Card>

        {/* --------------------------------- users --------------------------------- */}
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
            <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Staff accounts</h2>
            <Badge className="ml-auto">{users.length}</Badge>
          </div>

          <form onSubmit={createUser} className="space-y-3 border-b border-slate-100 p-4">
            <Field label="Full name" htmlFor="user-name" hint="Shown in the header and history log">
              <Input
                id="user-name"
                value={userForm.fullName}
                onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })}
                placeholder="e.g. Riyas"
              />
            </Field>

            <Field label="Email" htmlFor="user-email">
              <Input
                id="user-email"
                type="email"
                required
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                placeholder="name@newmass.com"
              />
            </Field>

            <Field label="Password" htmlFor="user-password" hint="At least 8 characters">
              <Input
                id="user-password"
                type="text"
                required
                minLength={8}
                autoComplete="off"
                value={userForm.password}
                onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                placeholder="Share this with the staff member"
              />
            </Field>

            <Field label="Role" htmlFor="user-role">
              <Select
                id="user-role"
                required
                value={userForm.roleId}
                onChange={(event) => setUserForm({ ...userForm, roleId: event.target.value })}
              >
                <option value="">Select a role…</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name}
                  </option>
                ))}
              </Select>
            </Field>

            {userError && <Alert tone="error">{userError}</Alert>}
            {userNotice && <Alert tone="success">{userNotice}</Alert>}

            <Button type="submit" loading={userBusy} disabled={!userForm.roleId}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Create account
            </Button>
          </form>

          {users.length === 0 ? (
            <EmptyState icon={Users} title="No staff accounts yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.map((user) => (
                <li key={user.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {user.full_name || user.email.split('@')[0]}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone="indigo">{user.custom_roles?.role_name ?? 'No role'}</Badge>
                    <p className="mt-1 text-xs text-slate-400">
                      {format(new Date(user.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${user.email}`}
                    onClick={() => openEditUser(user)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ------------------------------ edit user ------------------------------ */}
      <Modal
        open={editOpen}
        onClose={() => {
          if (!editBusy) setEditOpen(false);
        }}
        title="Edit staff account"
        subtitle={editForm.email}
      >
        <form onSubmit={saveUser} className="space-y-4">
          <Field label="Email" htmlFor="edit-email" hint="Email cannot be changed after creation">
            <Input id="edit-email" value={editForm.email} disabled readOnly />
          </Field>

          <Field label="Full name" htmlFor="edit-name" hint="Shown in the header and history log">
            <Input
              id="edit-name"
              value={editForm.fullName}
              onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })}
              placeholder="e.g. Riyas"
            />
          </Field>

          <Field
            label="Role"
            htmlFor="edit-role"
            hint="The role is the access level — it decides what this account can do"
          >
            <Select
              id="edit-role"
              required
              value={editForm.roleId}
              onChange={(event) => setEditForm({ ...editForm, roleId: event.target.value })}
            >
              <option value="">Select a role…</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.role_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="New password"
            htmlFor="edit-password"
            hint="Leave blank to keep the current password"
          >
            <Input
              id="edit-password"
              type="text"
              minLength={8}
              autoComplete="off"
              value={editForm.password}
              onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
              placeholder="Unchanged"
            />
          </Field>

          {editError && <Alert tone="error">{editError}</Alert>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={editBusy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={editBusy} disabled={!editForm.roleId}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
